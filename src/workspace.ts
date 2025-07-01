import * as vscode from 'vscode';
import * as path from 'path';
import { globalState } from './extension';

export interface WorkspaceMemory {
  accumulatedCost: number;
  lastUpdated: number;
  // Future workspace-wide state can go here
  // sessionHistory?: string[];
  // globalSettings?: any;
}

export class WorkspaceController {
  private memory: WorkspaceMemory;
  private memoryFilePath: vscode.Uri | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.memory = {
      accumulatedCost: 0,
      lastUpdated: Date.now()
    };
  }

  public async initialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      console.warn('No workspace folder found for workspace controller');
      return;
    }

    this.memoryFilePath = vscode.Uri.joinPath(workspaceFolder.uri, 'sorcery.mem');
    await this.loadMemory();
  }

  private async loadMemory(): Promise<void> {
    if (!this.memoryFilePath) return;

    try {
      const content = await vscode.workspace.fs.readFile(this.memoryFilePath);
      const parsed = JSON.parse(content.toString());
      this.memory = this.validateMemory(parsed);
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
      console.log('Creating new workspace memory file');
      await this.saveMemory();
    }
  }

  private validateMemory(parsed: any): WorkspaceMemory {
    return {
      accumulatedCost: typeof parsed.accumulatedCost === 'number' ? parsed.accumulatedCost : 0,
      lastUpdated: typeof parsed.lastUpdated === 'number' ? parsed.lastUpdated : Date.now()
    };
  }

  private async saveMemory(): Promise<void> {
    if (!this.memoryFilePath) return;

    try {
      this.memory.lastUpdated = Date.now();
      const content = JSON.stringify(this.memory, null, 2);
      await vscode.workspace.fs.writeFile(this.memoryFilePath, Buffer.from(content, 'utf8'));
    } catch (error) {
      console.error('Failed to save workspace memory:', error);
    }
  }

  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveMemory();
      this.saveTimeout = null;
    }, 1000); // Save after 1 second of inactivity
  }

  // ========================= COST TRACKING =========================
  
  public addCost(amount: number): void {
    if (amount <= 0) return;
    
    this.memory.accumulatedCost += amount;
    let lifetimeCost = globalState.get<number>('sorcery.lifetimeCost', 0);
    lifetimeCost += amount;
    globalState.update('sorcery.lifetimeCost', lifetimeCost);
    
    this.debouncedSave();
  }

  public getAccumulatedCost(): number {
    return this.memory.accumulatedCost;
  }

  public resetCost(): void {
    this.memory.accumulatedCost = 0;
    this.debouncedSave();
  }

  // ========================= FUTURE EXTENSIBILITY =========================
  
  public getMemory(): Readonly<WorkspaceMemory> {
    return { ...this.memory };
  }

  // Future methods for other workspace-wide state can go here
  // public addSessionToHistory(sessionName: string): void { ... }
  // public getGlobalSetting(key: string): any { ... }
}

export const workspaceController = new WorkspaceController();