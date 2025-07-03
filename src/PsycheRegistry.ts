import { PsycheDescriptor } from './types';
import * as vscode from 'vscode';
import * as path from 'path';
import { PsycheWorker } from './worker';
import { SessionController } from './session';

class PsycheRegistry {
  private psyches: Map<string, PsycheDescriptor> = new Map();
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
    
    const psycheFile: PsycheDescriptor = JSON.parse(psycheText);
    
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

    const psyche: PsycheDescriptor = {
      ...psycheFile,
      system: systemPrompt
    };

    this.psyches.set(psyche.name, psyche);
  }

  public getPsyche(name: string): PsycheDescriptor | undefined {
    if (!this.initialized) {
      throw new Error('PsycheRegistry not initialized');
    }
    return this.psyches.get(name);
  }
  
  public getPsyches(session: SessionController): Map<string, PsycheWorker> {
    const result: Map<string, PsycheWorker> = new Map();
    
    for (const descriptor of this.psyches.values()) {
        result.set(descriptor.name, new PsycheWorker(session, descriptor));
    }
    
    return result;
  }
  
  public getPsychesInfo(): PsycheDescriptor[] {
    if (!this.initialized) {
      throw new Error('PsycheRegistry not initialized');
    }
    return Array.from(this.psyches.values());
  }
}

// Global instance
export const psycheRegistry = new PsycheRegistry();