import * as vscode from 'vscode';
import { Knowledge, SessionContext, WorkItem, ContextItem, getAvailableFiles, ContextAwareness } from './types';
import { psycheRegistry } from './psyche';
import { toolRegistry } from './tools/ToolRegistry';
import { Tool } from './tools/Tool';
import { extract, ExtractionResult } from './Extractor';
import { assembleContext, formatAwarenessContext as bakeContext } from './ContextBuilder';
import { BackendResponse } from './llm/types';
import { Models } from './llm/models';

export class Session {
  private context: SessionContext;
  private document: vscode.TextDocument;
  private tools: Tool[];
  private pendingExecutions: Map<number, NodeJS.Timeout> = new Map();
  private onStateChanged?: () => void;
  
  constructor(document: vscode.TextDocument, workspaceName: string, onStateChanged?: () => void) {
    this.document = document;
    this.context = this.loadFromDocument(workspaceName);
    this.tools = toolRegistry.createTools(this);
    this.onStateChanged = onStateChanged;
    
    // Initialize with all known psyches
    const psycheNames = psycheRegistry.getAllPsyches().map( p => p.name );
    for (const psycheName of psycheNames) {
      if (!(psycheName in this.context.workerOutputs)) {
        this.context.workerOutputs[psycheName] = '';
      }
    }
  }
  
  // ========================= FILE OPS =========================
  private async saveToDocument(): Promise<void> {
    try {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        this.document.positionAt(0),
        this.document.positionAt(this.document.getText().length)
      );
      
      edit.replace(this.document.uri, fullRange, JSON.stringify(this.context, null, 2));
      await vscode.workspace.applyEdit(edit);
      this.onStateChanged?.();
      this.document.save();
    } catch (error) {
      console.error('Failed to save context to document:', error);
      vscode.window.showErrorMessage('Failed to save context to .sorcery file');
    }
  }
  
  private loadFromDocument(workspaceName: string): SessionContext {
    try {
      const content = this.document.getText().trim();
      if (content) {
        const parsed = JSON.parse(content);
        return this.validateContext(parsed, workspaceName);
      }
    } catch (error) {
      console.warn('Failed to parse .sorcery file, creating new context:', error);
    }
    
    // Create empty context
    return {
      workspaceName,
      items: [],
      nextId: 1,
      accumulatedCost: 0,
      workerOutputs: {}
    };
  }

  private validateContext(parsed: any, workspaceName: string): SessionContext {
    const context: SessionContext = {
      workspaceName: parsed.workspaceName || workspaceName,
      items: [],
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
      accumulatedCost: typeof parsed.accumulatedCost === 'number' ? parsed.accumulatedCost : 0,
      workerOutputs: parsed.workerOutputs || {} 
    };

    // Handle legacy format with separate knowledges/workItems arrays
    const legacyKnowledges = Array.isArray(parsed.knowledges) ? parsed.knowledges : [];
    const legacyWorkItems = Array.isArray(parsed.workItems) ? parsed.workItems : [];
    const newItems = Array.isArray(parsed.items) ? parsed.items : [];

    // Combine all items
    const allItems = [...legacyKnowledges, ...legacyWorkItems, ...newItems];
    context.items = allItems.map(this.validateItem);

    // Ensure nextId is correct
    if (context.items.length > 0) {
      const maxId = Math.max(...context.items.map(item => item.id || 0));
      context.nextId = Math.max(context.nextId, maxId + 1);
    }

    return context;
  }

  private validateItem(item: any): ContextItem {
    const baseItem: ContextItem = {
      id: item.id || 0,
      type: item.type || 'knowledge',
      sourceType: item.sourceType || 'system',
      sourceName: item.sourceName || 'system',
      content: item.content || '',
      // todo: if validation failed on any field, we can maybe populate metadata.error with info??
      metadata: {
        timestamp: item.metadata?.timestamp || Date.now(),
        collapsed: item.collapsed || false,
        error: item.metadata?.error
      }
    };

    // Determine if it's a Knowledge or WorkItem based on properties
    if ('source' in item || 'content' in item) {
      if ('executor' in item || 'status' in item) {
        // It's a WorkItem
        return {
          ...baseItem,
          executor: item.executor || 'user',
          content: item.content || '',
          status: item.status || 'cold'
        } as WorkItem;
      } else {
        // It's a Knowledge
        return {
          ...baseItem,
          sourceType: item.source || 'user',
          content: item.content || '',
          references: Array.isArray(item.references) ? item.references : []
        } as Knowledge;
      }
    }

    // Default to Knowledge if unclear
    return {
      ...baseItem,
      sourceType: 'user',
      content: '',
      references: []
    } as Knowledge;
  }
  
  // ========================= ITEMS =========================
  public emitKnowledge(source: Knowledge['sourceType'], sourceName: string, content: string): Knowledge {
    const knowledge: Knowledge = {
      id: -1,
      type: 'knowledge',
      sourceType: source,
      sourceName: sourceName,
      content: content,
      references: [],
      metadata: {
        timestamp: Date.now(),
        collapsed: true
      }
    };
    return knowledge;
  }
  
  public emitFileKnowledge(filePath: string): Knowledge | null {
    if (!getAvailableFiles().includes(filePath)) {
      return null;
    }
    
    const existingKnowledge = this.context.items.find(item => 
      this.isKnowledge(item) && item.sourceType === 'file' && item.sourceName === filePath
    ) as Knowledge;
    
    if (existingKnowledge) {
      // return existingKnowledge; // UH-OH! NOT SURE THIS IS CORRECT, TODO: CHECK!!
      return null;
    }
    
    return this.emitKnowledge('file', filePath, '');
  }
  
  public addItem(item: ContextItem): ContextItem {
    // Assign ID and add to context
    item.id = this.context.nextId++;
    this.context.items.push(item);
    
    // If it's a work item, schedule auto-execution
    if (this.isWorkItem(item)) {
      this.scheduleAutoExecution(item as WorkItem);
    }
    
    this.saveToDocument();
    return item;
  }
  
  public removeFileFromContext(filePath: string): boolean {
    // Find and remove the file knowledge
    const knowledge = this.context.items.find(item => 
      this.isKnowledge(item) && item.sourceType === 'file' && item.sourceName === filePath
    );

    if (knowledge) {
      return this.removeItem(knowledge.id);
    }

    return false;
  }
  
  public removeItem(id: number): boolean {
    // Cancel any pending execution
    this.cancelPendingExecution(id);
    
    const initialLength = this.context.items.length;
    
    this.context.items = this.context.items.filter(item => item.id !== id);
    
    if (this.context.items.length < initialLength) {
      // Clean up references in knowledge items
      this.context.items.forEach(item => {
        if (this.isKnowledge(item) && item.references) {
          item.references = item.references.filter(refId => refId !== id);
        }
      });
      
      this.saveToDocument();
      return true;
    }
    
    return false;
  }
  
  public toggleItemCollapse(id: number): boolean {
    const item = this.context.items.find(item => item.id === id);
    if (item) {
      item.metadata.collapsed = !item.metadata.collapsed;
      this.saveToDocument();
      return true;
    }
    return false;
  }
  
  // ========================= WORK =========================
  private scheduleAutoExecution(workItem: WorkItem): void {
    // Find the tool that can handle this work item
    const tool = this.tools.find(t => t.canHandle(workItem));
    
    if (!tool || !tool.autoRun) {
      return; // Tool doesn't support auto-run
    }

    // Get configured delay
    const config = vscode.workspace.getConfiguration('sorcery');
    const delay = config.get<number>('autoRunDelay', 2000);

    // Schedule execution
    const timeout = setTimeout(async () => {
      // Remove from pending map
      this.pendingExecutions.delete(workItem.id);
      
      // Double-check item still exists
      const currentItem = this.context.items.find(item => item.id === workItem.id);
      if (!currentItem || !this.isWorkItem(currentItem)) {
        return; // Item was deleted, skip execution
      }

      // Execute the tool
      try {
        await this.executeToolWorkItem(workItem.id);
      } catch (error) {
        console.error('Auto-execution failed:', error);
      }
    }, delay);

    // Store timeout reference for potential cancellation
    this.pendingExecutions.set(workItem.id, timeout);
  }

  private cancelPendingExecution(workItemId: number): void {
    const timeout = this.pendingExecutions.get(workItemId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingExecutions.delete(workItemId);
    }
  }
  
  public completeWorkItem(id: number): boolean {
    const workItem = this.context.items.find(item => 
      this.isWorkItem(item) && item.id === id
    ) as WorkItem;
    
    if (workItem) {
      workItem.status = 'done';
      this.saveToDocument();
      return true;
    }
    return false;
  }
  
  public async executeToolWorkItem(workItemId: number): Promise<boolean> {
    const workItem = this.context.items.find(item => 
      this.isWorkItem(item) && item.id === workItemId
    ) as WorkItem;
    
    if (!workItem || workItem.status === 'done') {
      return false;
    }
    
    if (!workItem.metadata) {
      workItem.metadata = { timestamp: Date.now(), collapsed: false };
    }
    
    // Find appropriate tool
    const tool = this.tools.find(t => t.canHandle(workItem));
    if (!tool) {
      // Mark as failed
      workItem.status = 'failed';
      workItem.metadata.error = 'No tool found to handle this work item';
      this.saveToDocument();
      return false;
    }
    
    try {
      workItem.status = 'running';
      this.saveToDocument();
      
      const result = await tool.execute(workItem);
      // Add any items produced by the tool
      if (result.knowledges) {
        for (const knowledge of result.knowledges) {
          this.addItem(knowledge);
        }
      }
      
      if (result.works) {
        for (const newWork of result.works) {
          this.addItem(newWork);
        }
      }

      // Update work item status
      if (result.error) {
        workItem.status = 'failed';
        workItem.metadata.error = result.error;
      } else {
        workItem.status = 'done';
      }

      this.saveToDocument();
      return true;

    } catch (error) {
      workItem.status = 'failed';
      workItem.metadata.error = error instanceof Error ? error.message : String(error);
      this.saveToDocument();
      return false;
    }
  }
  
  
  // ========================= RUNNING AGENTS =========================
  private buildSystemEnvironment(): string {
    // TODO: refactor this to use ContextBuilder!
    const toolInfo = this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    return `Workspace: ${this.context.workspaceName}\n\nAvailable Tools:\n${toolInfo}`;
  }
  
  public async runPA(): Promise<ExtractionResult> {
    const paName = 'project_assistant';
    
    try {
      const environment = this.buildSystemEnvironment();
      const response = await this.runPsyche(paName, environment);
      const extracted = extract(response, { sourceName: psycheRegistry.getPsyche(paName)?.displayName, timestamp: Date.now() });
      for (const knowledge of extracted.knowledges) {
        this.addItem(knowledge);
      }
      for (const work of extracted.works) {
        this.addItem(work);
      }
      
      this.saveToDocument();
      return extracted;
    } catch (error) {
      console.error('Agent run failed:', error);
      throw error;
    }
  }
  
  private async runPsyche(
    psycheName: string,
    systemContext?: string,
    chaining?: {
      parentOutput: string,
      currentDepth: number}
  ): Promise<BackendResponse> {
    const psyche = psycheRegistry.getPsyche(psycheName);
    if (!psyche) {
      throw new Error(`Psyche ${psycheName} not found`);
    }
    
    const model = Models[psyche.model];
    if (!model) {
      throw new Error(`Model ${psyche.model} for ${psyche.name} not found`);
    }
    
    const system = systemContext? `${systemContext}\n\n${psyche.system}` : psyche.system;
    
    const defaultAwareness: ContextAwareness = {
        projectStructure: true,
        items: "all"
      };
    const awareness = psyche.awareness ? psyche.awareness : defaultAwareness;
    const assembledContext = await assembleContext(awareness, this.context, chaining?.parentOutput);
    const bakedContext = bakeContext(assembledContext);
    
    const llmResponse = await model.backend.run(
      model,
      psyche.maxTokens,
      system,
      bakedContext,
      psyche.priming,
      psyche.terminators
    );
    this.context.workerOutputs[psyche.name] = llmResponse.content;
    this.context.accumulatedCost += llmResponse.cost;
    // Check for daisy-chaining
    if (psyche.post) {
      if( chaining && chaining.currentDepth === 0 ) {
        vscode.window.showWarningMessage(`Wanting to chain further '${psyche.name}' -> '${psyche.post.psyche}', but out of depth!`);
        return llmResponse;
      }
      
      // Recursively call the next psyche with decremented chain depth
      const nextStepDepthBudget = chaining
                                  ? chaining.currentDepth - 1
                                  : psyche.post.chaining_depth;
      const nextChain = {
        parentOutput: llmResponse.content.trim(),
        currentDepth: nextStepDepthBudget
      }
      return await this.runPsyche(
        psyche.post.psyche,
        systemContext,
        nextChain
      );
    }
    
    return llmResponse;
  }
  
  
  // ========================= ACCESSOR TRASH =========================
  public getContext(): SessionContext {
    return { ...this.context };
  }

  public getItems(): ContextItem[] {
    return [...this.context.items];
  }

  public getKnowledges(): Knowledge[] {
    return this.context.items.filter(this.isKnowledge) as Knowledge[];
  }

  public getWorkItems(): WorkItem[] {
    return this.context.items.filter(this.isWorkItem) as WorkItem[];
  }
  
  public getAvailableTools(): Array<{ name: string; description: string }> {
    return this.tools.map(t => ({ name: t.name, description: t.description }));
  }
  
  public getWorkerOutput(psycheName: string): string | undefined {
    return this.context.workerOutputs?.[psycheName];
  }

  public getAllWorkerOutputs(): { [workerKey: string]: string } {
    return { ...(this.context.workerOutputs || {}) };
  }
  
  public getAccumulatedCost(): number {
    return this.context.accumulatedCost;
  }

  private isKnowledge(item: ContextItem): item is Knowledge {
    return 'source' in item;
  }

  private isWorkItem(item: ContextItem): item is WorkItem {
    return 'executor' in item;
  }
}