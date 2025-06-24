import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Knowledge, SorceryContext, WorkItem, ContextItem } from './types';
import { Worker, WorkerResponse } from './worker';
import { getPsyche } from './psyche';
import { toolRegistry } from './tools/ToolRegistry';
import { Tool } from './tools/Tool';

export class ContextHolder {
  private context: SorceryContext;
  private document: vscode.TextDocument;
  private tools: Tool[];

  constructor(document: vscode.TextDocument, workspaceName: string) {
    this.document = document;
    this.context = this.loadFromDocument(workspaceName);
    this.tools = toolRegistry.createTools(this);
  }

  private loadFromDocument(workspaceName: string): SorceryContext {
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
      availableFiles: [],
      items: [],
      nextId: 1
    };
  }

  private validateContext(parsed: any, workspaceName: string): SorceryContext {
    const context: SorceryContext = {
      workspaceName: parsed.workspaceName || workspaceName,
      availableFiles: Array.isArray(parsed.availableFiles) ? parsed.availableFiles : [],
      items: [],
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1
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
      collapsed: item.collapsed || false,
      metadata: {
        timestamp: item.metadata?.timestamp || Date.now(),
        source_psyche: item.metadata?.source_psyche,
        source_tool: item.metadata?.source_tool,
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
          source: item.source || 'user',
          content: item.content || '',
          references: Array.isArray(item.references) ? item.references : []
        } as Knowledge;
      }
    }

    // Default to Knowledge if unclear
    return {
      ...baseItem,
      source: 'user',
      content: '',
      references: []
    } as Knowledge;
  }

  public updateAvailableFiles(files: string[]): void {
    this.context.availableFiles = files;
    this.saveToDocument();
  }

  public async includeFileInContext(filePath: string): Promise<Knowledge | null> {
    // Check if file is available
    if (!this.context.availableFiles.includes(filePath)) {
      return null;
    }

    // Check if already included by looking for existing file knowledge
    const existingKnowledge = this.context.items.find(item => 
      this.isKnowledge(item) && item.source === 'file' && item.content === filePath
    ) as Knowledge;
    
    if (existingKnowledge) {
      return existingKnowledge;
    }
    
    // Add new file knowledge
    const knowledge = this.addKnowledge('file', filePath, []);
    return knowledge;
  }

  public removeFileFromContext(filePath: string): boolean {
    // Find and remove the file knowledge
    const knowledge = this.context.items.find(item => 
      this.isKnowledge(item) && item.source === 'file' && item.content === filePath
    );

    if (knowledge) {
      return this.removeItem(knowledge.id);
    }

    return false;
  }

  public addItem(item: ContextItem): ContextItem {
    item.id = this.context.nextId++;
    this.context.items.push(item);
    this.saveToDocument();
    return item;
  }

  public addKnowledge(
    source: Knowledge['source'], 
    content: string, 
    references?: number[]
  ): Knowledge {
    const knowledge: Knowledge = {
      id: this.context.nextId,
      collapsed: false,
      source,
      content,
      references: references || [],
      metadata: {
        timestamp: Date.now()
      }
    };

    return this.addItem(knowledge) as Knowledge;
  }

  public addWorkItem(
    executor: WorkItem['executor'],
    content: string,
    psyche?: string,
    tool?: string
  ): WorkItem {
    const workItem: WorkItem = {
      id: this.context.nextId,
      collapsed: false,
      executor,
      content,
      status: 'cold',
      metadata: {
        timestamp: Date.now(),
        source_psyche: psyche,
        source_tool: tool
      }
    };

    return this.addItem(workItem) as WorkItem;
  }

  public async runAgent(userInput: string, psycheName: string = 'project_assistant'): Promise<WorkerResponse> {
    const psyche = getPsyche(psycheName);
    if (!psyche) {
      throw new Error(`Psyche ${psycheName} not found`);
    }

    // Build context for the agent
    const systemEnvironment = this.buildSystemEnvironment();
    const worker = new Worker(psyche, systemEnvironment);
    
    const knowledgeBlob = await this.buildKnowledgeBlob();

    try {
      const response = await worker.step(knowledgeBlob);

      // Add knowledges to context
      for (const knowledge of response.knowledges) {
        this.addItem(knowledge);
      }

      // Add work items to context
      for (const workItem of response.workItems) {
        this.addItem(workItem);
      }

      this.saveToDocument();
      return response;
    } catch (error) {
      console.error('Agent run failed:', error);
      throw error;
    }
  }

  private buildSystemEnvironment(): string {
    const toolInfo = this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    return `Workspace: ${this.context.workspaceName}\n\nAvailable Tools:\n${toolInfo}`;
  }
  
  private async buildKnowledgeBlob(): Promise<string> {
    const parts: string[] = [];

    if (this.context.availableFiles.length > 0) {
      parts.push(`Available files:\n${this.context.availableFiles.join('\n')}`);
    }
    
    const knowledges = this.context.items.filter(this.isKnowledge) as Knowledge[];
    if (knowledges.length > 0) {
      parts.push('\n\n');
      for (const knowledge of knowledges) {
        // For file knowledge, read the current file content
        if (knowledge.source === 'file') {
          let content = knowledge.content;
          try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
              const fullPath = path.join(workspaceRoot, knowledge.content);
              content = await fs.readFile(fullPath, 'utf-8');
            }
          } catch (error) {
            content = `[File not found]`;
          }
          parts.push(`\n<knowledge>[${knowledge.id}] from: ${knowledge.content}\ncontent:\n${content}\n</knowledge>`);
        }
        else {
          const source = knowledge.metadata?.source_psyche
                        ? `${knowledge.source}(${knowledge.metadata.source_psyche})`
                        : knowledge.source;
          parts.push(`\n<knowledge>[${knowledge.id}] from: ${source}\ncontent:\n${knowledge.content}\n</knowledge>`);
        }
      }
    }

    return parts.join('');
  }

  public removeItem(id: number): boolean {
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
      workItem.metadata = { timestamp: Date.now() };
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

      if (result.workItems) {
        for (const newWorkItem of result.workItems) {
          this.addItem(newWorkItem);
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
  
  public toggleItemCollapse(id: number): boolean {
    const item = this.context.items.find(item => item.id === id);
    if (item) {
      item.collapsed = !item.collapsed;
      this.saveToDocument();
      return true;
    }
    return false;
  }

  public getContext(): SorceryContext {
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

  public getAvailableFiles(): string[] {
    return [...this.context.availableFiles];
  }
  
  public getAvailableTools(): Array<{ name: string; description: string }> {
    return this.tools.map(t => ({ name: t.name, description: t.description }));
  }

  private isKnowledge(item: ContextItem): item is Knowledge {
    return 'source' in item;
  }

  private isWorkItem(item: ContextItem): item is WorkItem {
    return 'executor' in item;
  }

  private async saveToDocument(): Promise<void> {
    try {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        this.document.positionAt(0),
        this.document.positionAt(this.document.getText().length)
      );
      
      edit.replace(this.document.uri, fullRange, JSON.stringify(this.context, null, 2));
      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      console.error('Failed to save context to document:', error);
      vscode.window.showErrorMessage('Failed to save context to .sorcery file');
    }
  }
}