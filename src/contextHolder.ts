// contextHolder.ts
import * as vscode from 'vscode';
import { Knowledge, SorceryContext } from './types';

export class ContextHolder {
  private context: SorceryContext;
  private document: vscode.TextDocument;

  constructor(document: vscode.TextDocument, workspaceName: string) {
    this.document = document;
    
    // Try to parse existing content, or create new context
    try {
      const existingContent = document.getText();
      if (existingContent.trim()) {
        const parsed = JSON.parse(existingContent);
        this.context = this.validateAndFixContext(parsed, workspaceName);
      } else {
        this.context = this.createNewContext(workspaceName);
      }
    } catch (error) {
      console.warn('Failed to parse existing .sorcery file, creating new context:', error);
      this.context = this.createNewContext(workspaceName);
    }
  }

  private validateAndFixContext(parsed: any, workspaceName: string): SorceryContext {
    // Ensure we have a valid context structure
    const context: SorceryContext = {
      workspaceName: parsed.workspaceName || workspaceName,
      availableFiles: Array.isArray(parsed.availableFiles) ? parsed.availableFiles : [],
      knowledges: Array.isArray(parsed.knowledges) ? parsed.knowledges : [],
      nextKnowledgeId: typeof parsed.nextKnowledgeId === 'number' ? parsed.nextKnowledgeId : 1
    };

    // Ensure nextKnowledgeId is at least 1 more than the highest existing ID
    if (context.knowledges.length > 0) {
      const maxId = Math.max(...context.knowledges.map(k => k.id || 0));
      context.nextKnowledgeId = Math.max(context.nextKnowledgeId, maxId + 1);
    }

    return context;
  }

  private createNewContext(workspaceName: string): SorceryContext {
    return {
      workspaceName,
      availableFiles: [],
      knowledges: [],
      nextKnowledgeId: 1
    };
  }

  public updateAvailableFiles(files: string[]): void {
    this.context.availableFiles = files;
    this.saveToDocument();
  }

  public addFileKnowledge(filePath: string): boolean {
    // Ensure knowledges is an array
    if (!Array.isArray(this.context.knowledges)) {
      this.context.knowledges = [];
    }

    // Check if file knowledge already exists
    const existingFileKnowledge = this.context.knowledges.find(
      k => k.type === 'file' && k.metadata?.filePath === filePath
    );

    if (existingFileKnowledge) {
      return false; // Already exists
    }

    // Create new file knowledge
    const newKnowledge: Knowledge = {
      id: this.context.nextKnowledgeId++,
      type: 'file',
      content: `File: ${filePath}`,
      metadata: {
        filePath,
        timestamp: Date.now()
      }
    };

    this.context.knowledges.push(newKnowledge);
    this.saveToDocument();
    return true; // Successfully added
  }

  public addKnowledge(type: Knowledge['type'], content: string, references?: number[]): Knowledge {
    // Ensure knowledges is an array
    if (!Array.isArray(this.context.knowledges)) {
      this.context.knowledges = [];
    }

    const newKnowledge: Knowledge = {
      id: this.context.nextKnowledgeId++,
      type,
      content,
      references,
      metadata: {
        timestamp: Date.now()
      }
    };

    this.context.knowledges.push(newKnowledge);
    this.saveToDocument();
    return newKnowledge;
  }

  public getContext(): SorceryContext {
    return { ...this.context }; // Return a copy
  }

  public getKnowledges(): Knowledge[] {
    // Ensure we always return an array
    if (!Array.isArray(this.context.knowledges)) {
      console.warn('knowledges was not an array, fixing it');
      this.context.knowledges = [];
    }
    return [...this.context.knowledges]; // Return a copy
  }

  public getFileKnowledges(): Knowledge[] {
    const knowledges = this.getKnowledges(); // This will ensure it's an array
    return knowledges.filter(k => k.type === 'file');
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