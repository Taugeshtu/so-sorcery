import * as vscode from 'vscode';
import { Knowledge, SessionContext, WorkItem, ContextItem, getAvailableFiles, ContextAwareness } from './types';
import { psycheRegistry } from './PsycheRegistry';
import { toolRegistry } from './tools/ToolRegistry';
import { PsycheWorker, Tool, Worker } from './worker';

export class SessionController {
  private context: SessionContext;
  private document: vscode.TextDocument;
  private tools: Map<string, Tool>;
  private psyches: Map<string, PsycheWorker>;
  private executors: Map<string, Worker> = new Map();
  private pendingExecutions: Map<number, NodeJS.Timeout> = new Map();
  private onStateChanged?: () => void;
  
  constructor(document: vscode.TextDocument, workspaceName: string, onStateChanged?: () => void) {
    this.document = document;
    this.context = this.loadFromDocument(workspaceName);
    this.tools = toolRegistry.getTools(this);
    this.psyches = psycheRegistry.getPsyches(this);
    for (const tool of this.tools.values())
      this.executors.set(tool.descriptor.name, tool);
    for (const psyche of this.psyches.values())
      this.executors.set(psyche.descriptor.name, psyche);
    
    this.onStateChanged = onStateChanged;
    
    // Initialize with all known psyches
    for (const psycheName of this.psyches.keys()) {
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
      workerOutputs: parsed.workerOutputs || {},
      inputDraft: parsed.inputDraft || ''
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
      sourceType: item.sourceType || item.source || 'user', // Handle legacy 'source'
      sourceName: item.sourceName || 'system',
      content: item.content || '',
      metadata: {
        timestamp: item.metadata?.timestamp || Date.now(),
        collapsed: item.metadata?.collapsed || item.collapsed || false,
        error: item.metadata?.error
      }
    };
    
    // Check if it's a WorkItem first (more specific)
    if (item.type === 'work') {
      return {
        ...baseItem,
        type: 'work',
        executor: item.executor || 'user',
        status: item.status || 'cold'
      } as WorkItem;
    } else {
      // Default to Knowledge
      return {
        ...baseItem,
        type: 'knowledge',
        references: Array.isArray(item.references) ? item.references : []
      } as Knowledge;
    }
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
  
  // returns false if the path is not in available files; true if already added; and new KnowledgeItem if neither of those
  public emitFileKnowledge(filePath: string): Knowledge | Boolean {
    if (!getAvailableFiles().includes(filePath)) {
      return false;
    }
    
    const existingKnowledge = this.context.items.find(item => 
      item.type === 'knowledge' && item.sourceType === 'file' && item.sourceName === filePath
    ) as Knowledge;
    
    if (existingKnowledge) {
      return true;
    }
    
    return this.emitKnowledge('file', filePath, '');
  }
  
  private parseAtMention(content: string): { isWorkItem: boolean; executor?: string; workContent?: string } {
    // Check if content starts with @
    if (!content.startsWith('@')) {
      return { isWorkItem: false };
    }
    
    // Extract the mention part (everything up to first space or end of string)
    const mentionMatch = content.match(/^@(\S+)(?:\s+(.*))?$/s);
    if (!mentionMatch) {
      return { isWorkItem: false };
    }
    
    const mentionTarget = mentionMatch[1];
    const workContent = mentionMatch[2] || '';
    
    // Check against executor names (exact match)
    if (this.executors.has(mentionTarget)) {
      return {
        isWorkItem: true,
        executor: mentionTarget,
        workContent: workContent
      };
    }
    
    // Check against psyche display names
    for (const psyche of psycheRegistry.getPsychesInfo()) {
      if (psyche.displayName === mentionTarget) {
        return {
          isWorkItem: true,
          executor: psyche.name,
          workContent: workContent
        };
      }
    }
    
    // Check against tool display names
    for (const tool of this.tools.values()) {
      if (tool.descriptor.displayName === mentionTarget) {
        return {
          isWorkItem: true,
          executor: tool.descriptor.name,
          workContent: workContent
        };
      }
    }
    
    return { isWorkItem: false };
  }
  
  // Modify the existing addItem method
  public addItem(item: ContextItem): ContextItem {
    // Check for @ mentions in user knowledge items
    if (item.type === 'knowledge' && item.sourceType === 'user') {
      const parseResult = this.parseAtMention(item.content);
      
      if (parseResult.isWorkItem && parseResult.executor) {
        // Convert to work item
        const workItem: WorkItem = {
          id: -1, // Will be assigned below
          type: 'work',
          sourceType: 'user',
          sourceName: 'user',
          content: parseResult.workContent || '',
          executor: parseResult.executor,
          status: 'cold',
          metadata: {
            timestamp: Date.now(),
            collapsed: false
          }
        };
        
        // Assign ID and add to context
        workItem.id = this.context.nextId++;
        this.context.items.push(workItem);
        
        // Schedule auto-execution
        this.tryScheduleAutoExecution(workItem);
        
        this.saveToDocument();
        return workItem;
      }
    }
    
    // Original addItem logic for non-@ mentions
    item.id = this.context.nextId++;
    this.context.items.push(item);
    
    // If it's a work item, schedule auto-execution
    if (item.type === 'work') {
      this.tryScheduleAutoExecution(item as WorkItem);
    }
    
    this.saveToDocument();
    return item;
  }
  
  public removeFileFromContext(filePath: string): boolean {
    // Find and remove the file knowledge
    const knowledge = this.context.items.find(item => 
      item.type === 'knowledge' && item.sourceType === 'file' && item.sourceName === filePath
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
        if (item.metadata.references) {
          item.metadata.references = item.metadata.references.filter(refId => refId !== id);
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
  
  updateInputDraft(draft: string) {
    this.context.inputDraft = draft;
    this.saveToDocument();
  }
  
  // ========================= WORK =========================
  private tryScheduleAutoExecution(workItem: WorkItem): void {
    const executor = this.executors.has(workItem.executor) ? this.executors.get(workItem.executor) : null;
    if (!executor || executor.descriptor.autoRun.mode !== 'always') {
      return;
    }
    
    // Get configured delay
    const config = vscode.workspace.getConfiguration('sorcery');
    const delay = (executor.descriptor.autoRun.delay)
                  ? executor.descriptor.autoRun.delay
                  : config.get<number>('autoRunDelay', 2000);
    
    // Schedule execution
    const timeout = setTimeout(async () => {
      // Remove from pending map
      this.pendingExecutions.delete(workItem.id);
      
      // Double-check item still exists
      const currentWorkItem = this.context.items.find(item => item.id === workItem.id) as WorkItem;
      if (!currentWorkItem) {
        return;
      }
      
      if (currentWorkItem.status !== 'cold') {
        return;
      }
      
      try {
        await this.executeWorkItem(workItem.id);
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
    const workItem = this.context.items.find(item => item.type === 'work' && item.id === id) as WorkItem;
    
    if (workItem) {
      workItem.status = 'done';
      this.saveToDocument();
      return true;
    }
    return false;
  }
  
  
  // ========================= EXECUTIONS =========================
  private handleExecutionError(workItem: WorkItem, error: string, context?: string): void {
    // Set the work item status and metadata as before
    workItem.status = 'failed';
    workItem.metadata.error = error;
    
    // Create a knowledge item to make the error visible to users
    const errorKnowledge = this.emitKnowledge(
      'system',
      'execution_error',
      `**Execution Error for Work Item [${workItem.id}]**

**Executor:** ${workItem.executor}
**Work Content:** ${workItem.content || '(empty)'}
${context ? `**Context:** ${context}` : ''}

**Error:** ${error}

**Timestamp:** ${new Date().toISOString()}`
    );
    
    // Add references to link the error back to the failed work item
    errorKnowledge.references = [workItem.id];
    
    // Add the error knowledge to the context
    this.addItem(errorKnowledge);
  }

  private getFilteredWork(executorName: string): WorkItem[] {
    return this.context.items
      .filter(item =>
        item.type === 'work' &&
        (item as WorkItem).status === 'cold' &&
        (item as WorkItem).executor === executorName
      )
      .map(item => item as WorkItem)
      .sort((a, b) => a.id - b.id); // Oldest first
  }

  private setWorkItemsStatus(workIds: number[], status: WorkItem['status']): void {
    this.context.items.forEach(item => {
      if (item.type === 'work' && workIds.includes(item.id)) {
        (item as WorkItem).status = status;
      }
    });
  }

  private resetFailedWork(workIds: number[], executedWorkId: number): void {
    this.context.items.forEach(item => {
      if (item.type === 'work' && 
          workIds.includes(item.id) && 
          item.id !== executedWorkId &&
          (item as WorkItem).status === 'running') {
        (item as WorkItem).status = 'cold';
      }
    });
  }
  
  private async preparePatcherContext(workItem: WorkItem): Promise<string> {
    // Parse the work item content to extract file path
    // Expected format: first line is file path, rest is the patch instructions
    const lines = workItem.content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Empty patcher work item content');
    }
    
    const filePath = lines[0].trim();
    const patchInstructions = lines.slice(1).join('\n').trim();
    
    // Check if file exists in available files
    const fileExists = getAvailableFiles().includes(filePath);
    
    if (fileExists) {
      // Existing file - read current content
      try {
        const fs = require('fs');
        const path = require('path');
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          throw new Error('No workspace folder found');
        }
        
        const fullPath = path.join(workspaceRoot, filePath);
        const currentContent = fs.readFileSync(fullPath, 'utf8');
        
        // Format the enhanced work item content for Patcher
        return `**Target File:** ${filePath}

**Current Content:**
\`\`\`
${currentContent}
\`\`\`

**Requested Changes:**
${patchInstructions || workItem.content}`;
      
      } catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // New file - indicate no existing content
      return `**Target File:** ${filePath}
**File Status:** NEW FILE (does not exist yet)

**Requested Content:**
${patchInstructions || workItem.content}`;
    }
  }
  
  public async executeWorkItem(workItemId: number): Promise<boolean> {
    const workItem = this.context.items.find(item => item.type === 'work' && item.id === workItemId) as WorkItem;
    if (!workItem || workItem.status === 'running' || workItem.status === 'done') {
      return false;
    }
    
    if (!workItem.metadata) {
      workItem.metadata = { timestamp: Date.now(), collapsed: false };
    }
    
    const executor = this.executors.has(workItem.executor) ? this.executors.get(workItem.executor) : null;
    if (!executor) {
      this.handleExecutionError(workItem, 'No executor found to handle this work item', `Available executors: ${Array.from(this.executors.keys()).join(', ')}`);
      this.saveToDocument();
      return false;
    }
    
    workItem.status = 'running';
    this.saveToDocument();
    
    // Special handling for patcher - create enhanced work item for execution
    let actualWorkItem = workItem;
    if (workItem.executor === 'patcher') {
      try {
        const patcherWorkContent = await this.preparePatcherContext(workItem);
        actualWorkItem = {
          ...workItem,
          content: patcherWorkContent
        };
      } catch (patcherError) {
        const errorMessage = patcherError instanceof Error ? patcherError.message : String(patcherError);
        this.handleExecutionError(workItem, errorMessage, 'Failed to prepare patcher context');
        this.saveToDocument();
        return false;
      }
    }
    
    try {
      const result = await executor.execute(actualWorkItem);
      
      // Process results
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
      
      // Update original work item status (not the actualWorkItem)
      if (result.error) {
        this.handleExecutionError(workItem, result.error, 'Executor returned error result');
      } else {
        workItem.status = 'done';
      }
      
      this.saveToDocument();
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleExecutionError(workItem, errorMessage, 'Exception during execution');
      this.saveToDocument();
      return false;
    }
  }
  
  public async executeWorker(executorName: string): Promise<boolean> {
    const selectedWork = this.getFilteredWork(executorName);
    
    if (selectedWork.length === 0 && executorName !== 'project_assistant') {
      return false; // No work to execute
    }
    
    const executor = this.executors.get(executorName);
    if (!executor) {
      return false; // No executor found
    }
    
    const workIds = selectedWork.map(w => w.id);
    const oldestWork = selectedWork[0];
    
    try {
      // Mark all selected work as running
      this.setWorkItemsStatus(workIds, 'running');
      this.saveToDocument();
      
      // Execute the oldest work item
      const result = await executor.execute(oldestWork);
      
      // Process results
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
      
      // Update executed work item status
      if (result.error) {
        oldestWork.status = 'failed';
        oldestWork.metadata.error = result.error;
      } else {
        oldestWork.status = 'done';
      }
      
      // Reset other work items back to cold (they weren't actually executed)
      this.resetFailedWork(workIds, oldestWork.id);
      
      this.saveToDocument();
      return true;
      
    } catch (error) {
      // Reset all work items back to cold on failure
      this.resetFailedWork(workIds, -1);
      
      // Handle the error transparently
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleExecutionError(oldestWork, errorMessage, `Batch execution failure for executor: ${executorName}`);
      
      this.saveToDocument();
      return false;
    }
  }

  public async run(): Promise<void> {
    // Discover executors that have cold work and support on-run
    const eligibleExecutors = new Set<string>();
    
    for (const item of this.context.items) {
      if (item.type === 'work' && ((item as WorkItem).status === 'cold' || (item as WorkItem).status === 'failed')) {
        const workItem = item as WorkItem;
        const executor = this.executors.get(workItem.executor);
        
        if (executor && executor.descriptor.autoRun.mode === 'on-run') {
          eligibleExecutors.add(workItem.executor);
        }
      }
    }
    
    if(eligibleExecutors.size === 0)
      eligibleExecutors.add('project_assistant');
    
    // Execute all eligible executors in parallel
    const executionPromises = Array.from(eligibleExecutors).map(executorName => 
      this.executeWorker(executorName)
    );
    
    try {
      await Promise.all(executionPromises);
    } catch (error) {
      console.error('Error during batch execution:', error);
      // Individual executor failures are already handled in executeWorker
    }
  }
  
  // ========================= ACCESSOR TRASH =========================
  public getSession(): SessionContext {
    return { ...this.context };
  }
  
  public getPsycheExecutionStates(): [string, string, boolean][] {
    const states: [string, string, boolean][] = [];
    
    for (const psyche of psycheRegistry.getPsychesInfo()) {
      const worker = this.psyches.get(psyche.name);
      const isExecuting = worker ? worker.isBusy : false;
      states.push([psyche.name, psyche.displayName, isExecuting]);
    }
    
    return states;
  }
  
  public getPsycheWorker(psycheName: string): PsycheWorker | undefined {
    return this.psyches.get(psycheName);
  }
  
  public notifyStateChanged(): void {
    this.onStateChanged?.();
  }
  
  public addCost(cost: number): void {
    this.context.accumulatedCost += cost;
    this.saveToDocument();
  }
}