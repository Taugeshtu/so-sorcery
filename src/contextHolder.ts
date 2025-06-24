// src/contextHolder.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Knowledge, SorceryContext, WorkItem } from './types';
import { Worker, WorkerResponse } from './worker';
import { getPsyche } from './psyche';

export class ContextHolder {
  private context: SorceryContext;
  private document: vscode.TextDocument;

  constructor(document: vscode.TextDocument, workspaceName: string) {
    this.document = document;
    this.context = this.loadFromDocument(workspaceName);
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
      includedFiles: [],
      knowledges: [],
      workItems: [],
      nextKnowledgeId: 1,
      nextWorkId: 1
    };
  }

  private validateContext(parsed: any, workspaceName: string): SorceryContext {
    const context: SorceryContext = {
      workspaceName: parsed.workspaceName || workspaceName,
      availableFiles: Array.isArray(parsed.availableFiles) ? parsed.availableFiles : [],
      includedFiles: Array.isArray(parsed.includedFiles) ? parsed.includedFiles : [],
      knowledges: Array.isArray(parsed.knowledges) ? parsed.knowledges.map(this.validateKnowledge) : [],
      workItems: Array.isArray(parsed.workItems) ? parsed.workItems.map(this.validateWorkItem) : [],
      nextKnowledgeId: typeof parsed.nextKnowledgeId === 'number' ? parsed.nextKnowledgeId : 1,
      nextWorkId: typeof parsed.nextWorkId === 'number' ? parsed.nextWorkId : 1
    };

    // Ensure nextKnowledgeId is correct
    if (context.knowledges.length > 0) {
      const maxId = Math.max(...context.knowledges.map(k => k.id || 0));
      context.nextKnowledgeId = Math.max(context.nextKnowledgeId, maxId + 1);
    }

    // Ensure nextWorkId is correct
    if (context.workItems.length > 0) {
      const maxId = Math.max(...context.workItems.map(w => w.id || 0));
      context.nextWorkId = Math.max(context.nextWorkId, maxId + 1);
    }

    return context;
  }

  private validateKnowledge(k: any): Knowledge {
    return {
      id: k.id || 0,
      source: k.source || 'user',
      content: k.content || '',
      collapsed: k.collapsed || false, // Add this line
      references: Array.isArray(k.references) ? k.references : [],
      metadata: {
        filePath: k.metadata?.filePath,
        timestamp: k.metadata?.timestamp || Date.now(),
        psyche: k.metadata?.psyche
      }
    };
  }

  private validateWorkItem(w: any): WorkItem {
    return {
      id: w.id || 0,
      type: w.type || 'user_task',
      content: w.content || '',
      metadata: {
        filePath: w.metadata?.filePath,
        timestamp: w.metadata?.timestamp || Date.now(),
        psyche: w.metadata?.psyche,
        completed: w.metadata?.completed || false
      }
    };
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

    // Check if already included
    if (this.context.includedFiles.includes(filePath)) {
      return this.context.knowledges.find(k => 
        k.source === 'file' && k.metadata?.filePath === filePath
      ) || null;
    }

    try {
      // Read file content
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace found');
      }

      const fullPath = path.join(workspaceRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Add to included files
      this.context.includedFiles.push(filePath);

      // Create knowledge with file content
      const knowledge = this.addKnowledge('file', content, [], filePath);
      return knowledge;
    } catch (error) {
      console.error('Failed to include file in context:', error);
      return null;
    }
  }

  public removeFileFromContext(filePath: string): boolean {
    // Remove from included files
    const fileIndex = this.context.includedFiles.indexOf(filePath);
    if (fileIndex === -1) {
      return false;
    }

    this.context.includedFiles.splice(fileIndex, 1);

    // Remove associated knowledge
    const knowledge = this.context.knowledges.find(k => 
      k.source === 'file' && k.metadata?.filePath === filePath
    );

    if (knowledge) {
      this.removeKnowledge(knowledge.id);
    }

    this.saveToDocument();
    return true;
  }

  public addKnowledge(
    source: Knowledge['source'], 
    content: string, 
    references?: number[],
    filePath?: string
  ): Knowledge {
    const knowledge: Knowledge = {
      id: this.context.nextKnowledgeId,
      source,
      content,
      collapsed: false, // Add this line
      references: references || [],
      metadata: {
        filePath,
        timestamp: Date.now()
      }
    };

    this.context.nextKnowledgeId++;
    this.context.knowledges.push(knowledge);
    this.saveToDocument();
    return knowledge;
  }

  public addWorkItem(
    type: WorkItem['type'],
    content: string,
    psyche?: string,
    filePath?: string
  ): WorkItem {
    const workItem: WorkItem = {
      id: this.context.nextWorkId,
      type,
      content,
      metadata: {
        timestamp: Date.now(),
        psyche,
        filePath,
        completed: false
      }
    };

    this.context.nextWorkId++;
    this.context.workItems.push(workItem);
    this.saveToDocument();
    return workItem;
  }

  public async runAgent(userInput: string, psycheName: string = 'project_assistant'): Promise<WorkerResponse> {
    const psyche = getPsyche(psycheName);
    if (!psyche) {
      throw new Error(`Psyche ${psycheName} not found`);
    }

    // Build context for the agent
    const contextString = this.buildContextString();
    const worker = new Worker(psyche, contextString);

    try {
      const response = await worker.step(userInput);

      // Add knowledges to context
      for (const knowledge of response.knowledges) {
        knowledge.id = this.context.nextKnowledgeId++;
        this.context.knowledges.push(knowledge);
      }

      // Add work items to context
      for (const workItem of response.workItems) {
        workItem.id = this.context.nextWorkId++;
        this.context.workItems.push(workItem);
      }

      this.saveToDocument();
      return response;
    } catch (error) {
      console.error('Agent run failed:', error);
      throw error;
    }
  }

  private buildContextString(): string {
    const parts: string[] = [];

    parts.push(`Workspace: ${this.context.workspaceName}`);
    
    if (this.context.availableFiles.length > 0) {
      parts.push(`\nAvailable files:\n${this.context.availableFiles.join('\n')}`);
    }

    if (this.context.includedFiles.length > 0) {
      parts.push(`\nIncluded files:\n${this.context.includedFiles.join('\n')}`);
    }

    if (this.context.knowledges.length > 0) {
      parts.push('\nKnowledge:');
      for (const knowledge of this.context.knowledges) {
        const source = knowledge.metadata?.psyche ? 
          `${knowledge.source}(${knowledge.metadata.psyche})` : 
          knowledge.source;
        parts.push(`\n[${knowledge.id}] ${source}: ${knowledge.content}`);
      }
    }

    return parts.join('');
  }

  public removeKnowledge(id: number): boolean {
    const initialLength = this.context.knowledges.length;
    
    this.context.knowledges = this.context.knowledges.filter(k => k.id !== id);
    
    if (this.context.knowledges.length < initialLength) {
      // Clean up references
      this.context.knowledges.forEach(knowledge => {
        if (knowledge.references) {
          knowledge.references = knowledge.references.filter(refId => refId !== id);
        }
      });
      
      this.saveToDocument();
      return true;
    }
    
    return false;
  }

  public completeWorkItem(id: number): boolean {
    const workItem = this.context.workItems.find(w => w.id === id);
    if (workItem && workItem.metadata) {
      workItem.metadata.completed = true;
      this.saveToDocument();
      return true;
    }
    return false;
  }
  
  public toggleKnowledgeCollapse(id: number): boolean {
    const knowledge = this.context.knowledges.find(k => k.id === id);
    if (knowledge) {
      knowledge.collapsed = !knowledge.collapsed;
      this.saveToDocument();
      return true;
    }
    return false;
  }

  public getContext(): SorceryContext {
    return { ...this.context };
  }

  public getKnowledges(): Knowledge[] {
    return [...this.context.knowledges];
  }

  public getWorkItems(): WorkItem[] {
    return [...this.context.workItems];
  }

  public getAvailableFiles(): string[] {
    return [...this.context.availableFiles];
  }

  public getIncludedFiles(): string[] {
    return [...this.context.includedFiles];
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