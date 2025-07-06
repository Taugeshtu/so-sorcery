import { Tool } from '../worker';
import { WorkItem, WorkResult, ToolDescriptor } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export class FileReadTool extends Tool {
  static getDescriptor(): ToolDescriptor {
    return {
      name: 'file_read',
      displayName: 'File Read', 
      description: 'Read the contents of a file from the workspace and add them as a standalone synthetic knowledge',
      autoRun: {mode: 'always', delay: 0},
      type: 'tool',
      workerClass: 'FileReadTool'
    };
  }
  
  async execute(workItem: WorkItem): Promise<WorkResult> {
    try {
      // Extract file path from work item content
      const filePath = this.extractFilePath(workItem.content);
      if (!filePath) {
        return {
          error: 'No file path specified in work item content'
        };
      }

      // Get workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        return {
          error: 'No workspace folder found'
        };
      }

      // Read file
      const fullPath = path.join(workspaceRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Create knowledge item for the file
      const knowledge = this.createKnowledge(
        `File: ${filePath}\n\n${content}`
      );

      return {
        knowledges: [knowledge]
      };

    } catch (error) {
      return {
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private extractFilePath(content: string): string | null {
    // Try to extract from XML-like syntax first
    const xmlMatch = content.match(/<path>(.*?)<\/path>/);
    if (xmlMatch) {
      return xmlMatch[1].trim();
    }

    // Fall back to treating entire content as file path
    const trimmed = content.trim();
    if (trimmed && !trimmed.includes('\n')) {
      return trimmed;
    }

    return null;
  }
}
