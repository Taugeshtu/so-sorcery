import * as vscode from 'vscode';
import * as path from 'path';

export interface Psyche {
  name: string;
  displayName: string;
  description: string;
  model: string;
  maxTokens: number;
  system: string;
  priming?: string;
  terminators?: string[];
}

interface PsycheFile {
  name: string;
  displayName: string;
  description: string;
  model: string;
  maxTokens: number;
  system?: string; // Optional in file, will be loaded from .system file if empty
  priming?: string;
  terminators?: string[];
}

class PsycheManager {
  private psyches: Map<string, Psyche> = new Map();
  private initialized = false;
  private extensionUri?: vscode.Uri;

  public async initialize(extensionUri: vscode.Uri): Promise<void> {
    this.extensionUri = extensionUri;
    await this.loadAllPsyches();
    this.initialized = true;
  }

  private async loadAllPsyches(): Promise<void> {
    if (!this.extensionUri) {
      throw new Error('Extension URI not set');
    }

    const resourcesUri = vscode.Uri.joinPath(this.extensionUri, 'resources');
    
    try {
      const files = await vscode.workspace.fs.readDirectory(resourcesUri);
      const psycheFiles = files
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.psyche'))
        .map(([name]) => name);

      for (const fileName of psycheFiles) {
        try {
          await this.loadPsycheFromFile(fileName);
        } catch (error) {
          console.error(`Failed to load psyche from ${fileName}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to read resources directory:', error);
    }
  }

  private async loadPsycheFromFile(fileName: string): Promise<void> {
    if (!this.extensionUri) {
      throw new Error('Extension URI not set');
    }

    const psycheUri = vscode.Uri.joinPath(this.extensionUri, 'resources', fileName);
    const psycheData = await vscode.workspace.fs.readFile(psycheUri);
    const psycheText = new TextDecoder().decode(psycheData);
    
    const psycheFile: PsycheFile = JSON.parse(psycheText);
    
    // Load system prompt if not provided in the psyche file
    let systemPrompt = psycheFile.system || '';
    if (!systemPrompt) {
      const baseName = path.basename(fileName, '.psyche');
      const systemFileName = `${baseName}.system`;
      const systemUri = vscode.Uri.joinPath(this.extensionUri, 'resources', systemFileName);
      
      try {
        const systemData = await vscode.workspace.fs.readFile(systemUri);
        systemPrompt = new TextDecoder().decode(systemData);
      } catch (error) {
        console.warn(`No system file found for ${baseName}, using empty system prompt`);
      }
    }

    const psyche: Psyche = {
      ...psycheFile,
      system: systemPrompt
    };

    this.psyches.set(psyche.name, psyche);
  }

  public getPsyche(name: string): Psyche | undefined {
    if (!this.initialized) {
      throw new Error('PsycheManager not initialized');
    }
    return this.psyches.get(name);
  }

  public getAllPsycheNames(): string[] {
    if (!this.initialized) {
      throw new Error('PsycheManager not initialized');
    }
    return Array.from(this.psyches.keys());
  }

  public getAllPsyches(): Psyche[] {
    if (!this.initialized) {
      throw new Error('PsycheManager not initialized');
    }
    return Array.from(this.psyches.values());
  }

  // Method to add user-generated psyches at runtime
  public addPsyche(psyche: Psyche): void {
    this.psyches.set(psyche.name, psyche);
  }
}

// Global instance
const psycheManager = new PsycheManager();

// Export functions that match the original API
export async function initializePsyches(extensionUri: vscode.Uri): Promise<void> {
  await psycheManager.initialize(extensionUri);
}

export function getPsyche(name: string): Psyche | undefined {
  return psycheManager.getPsyche(name);
}

export function getAllPsycheNames(): string[] {
  return psycheManager.getAllPsycheNames();
}

export function getAllPsyches(): Psyche[] {
  return psycheManager.getAllPsyches();
}

export function addPsyche(psyche: Psyche): void {
  psycheManager.addPsyche(psyche);
}