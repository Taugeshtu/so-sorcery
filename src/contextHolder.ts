// src/contextHolder.ts
import * as vscode from 'vscode';
import { Knowledge, SorceryContext } from './types';

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
      knowledges: [],
      nextKnowledgeId: 1
    };
  }

  private validateContext(parsed: any, workspaceName: string): SorceryContext {
    const context: SorceryContext = {
      workspaceName: parsed.workspaceName || workspaceName,
      availableFiles: Array.isArray(parsed.availableFiles) ? parsed.availableFiles : [],
      knowledges: Array.isArray(parsed.knowledges) ? parsed.knowledges.map(this.validateKnowledge) : [],
      nextKnowledgeId: typeof parsed.nextKnowledgeId === 'number' ? parsed.nextKnowledgeId : 1
    };

    // Ensure nextKnowledgeId is correct
    if (context.knowledges.length > 0) {
      const maxId = Math.max(...context.knowledges.map(k => k.id || 0));
      context.nextKnowledgeId = Math.max(context.nextKnowledgeId, maxId + 1);
    }

    return context;
  }
  
  private validateKnowledge(k: any): Knowledge {
    return {
      id: k.id || 0,
      name: k.name || `${k.source || 'unknown'}_${k.id || 0}`,
      source: k.source || 'user',
      content: k.content || '',
      references: Array.isArray(k.references) ? k.references : [],
      collapsed: typeof k.collapsed === 'boolean' ? k.collapsed : true, // Default to collapsed
      metadata: k.metadata || {}
    };
  }

  public updateAvailableFiles(files: string[]): void {
    this.context.availableFiles = files;
    this.saveToDocument();
  }

  public addKnowledge(source: Knowledge['source'], content: string, references?: number[]): Knowledge {
    const knowledge: Knowledge = {
      id: this.context.nextKnowledgeId,
      name: `${source}_${this.context.nextKnowledgeId}`,
      source,
      content,
      references,
      collapsed: false, // New knowledge starts expanded
      metadata: {
        timestamp: Date.now()
      }
    };

    this.context.nextKnowledgeId++;
    this.context.knowledges.push(knowledge);
    this.saveToDocument();
    return knowledge;
  }

  public addFileKnowledge(filePath: string): Knowledge | null {
    // Check if already exists
    const existing = this.context.knowledges.find(
      k => k.source === 'file' && k.metadata?.filePath === filePath
    );
    
    if (existing) {
      return null; // Already exists
    }

    const fileName = filePath.split('/').pop() || filePath;
    const knowledge: Knowledge = {
      id: this.context.nextKnowledgeId,
      name: `file_${fileName}`,
      source: 'file',
      content: `File: ${filePath}`,
      references: [],
      collapsed: true,
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

  public removeKnowledge(id: number): boolean {
    const initialLength = this.context.knowledges.length;
    this.context.knowledges = this.context.knowledges.filter(k => k.id !== id);
    
    if (this.context.knowledges.length < initialLength) {
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

  public getAvailableFiles(): string[] {
    return [...this.context.availableFiles];
  }

  public getFileKnowledges(): Knowledge[] {
    return this.context.knowledges.filter(k => k.source === 'file');
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