import { Tool } from '../worker';
import { WorkItem, WorkResult, ToolDescriptor } from '../types';
import { Block } from '../utils/BlockParser';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export class FileWriteTool extends Tool {
  static getDescriptor(): ToolDescriptor {
    return {
      name: 'file_write',
      displayName: 'File Write', 
      description: 'Write content to a file in the workspace. Expects content in format:\nfilepath\n```\nfile content\n```. NO LANGUAGE SPECIFICATION.',
      autoRun: {mode: 'never', delay: 0},
      type: 'tool',
      workerClass: 'FileWriteTool'
    };
  }
  
  async execute(workItem: WorkItem): Promise<WorkResult> {
    try {
      // Extract file path and content from work item
      const { filePath, content } = this.extractFileData(workItem.content);
      if (!filePath) {
        return {
          error: 'No file path specified in work item content'
        };
      }

      if (content === null) {
        return {
          error: 'No content specified in work item content'
        };
      }

      // Get workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        return {
          error: 'No workspace folder found'
        };
      }

      // Validate path is within workspace
      const fullPath = path.resolve(workspaceRoot, filePath);
      if (!fullPath.startsWith(workspaceRoot)) {
        return {
          error: 'File path must be within workspace'
        };
      }

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');

      // Create knowledge item confirming the write
      const knowledge = this.createKnowledge(
        `Successfully wrote ${content.length} characters to file: ${filePath}`
      );

      return {
        knowledges: [knowledge]
      };

    } catch (error) {
      return {
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private extractFileData(content: string): { filePath: string | null; content: string | null } {
    const trimmedContent = content.trim();
    const lines = trimmedContent.split('\n');
    
    if (lines.length >= 2) {
      const firstLine = lines[0].trim();
      const restContent = lines.slice(1).join('\n');
      const restBlock = Block.fromString(restContent);
      
      // Check if first line looks like a file path
      if (firstLine && !firstLine.includes(' ') && (firstLine.includes('.') || firstLine.includes('/'))) {
        const fileContent = restBlock.extract('```\n', '\n```').extracted;
        return {
          filePath: firstLine,
          content: fileContent
        };
      }
    }
    
    return { filePath: null, content: null };
  }
}
