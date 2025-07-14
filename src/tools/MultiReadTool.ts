import { Tool } from '../worker';
import { WorkItem, WorkResult, ToolDescriptor, ContextItem } from '../types';

export class MultiReadTool extends Tool {
  static getDescriptor(): ToolDescriptor {
    return {
      name: 'multiread',
      displayName: 'Multi-read', 
      description: 'Add multiple files to the context from the list of available project files. Provide newline-separated file paths and nothing else, and they will be added to the context.',
      autoRun: {mode: 'always'},
      type: 'tool',
      workerClass: 'MultiReadTool'
    };
  }
  
  async execute(workItem: WorkItem): Promise<WorkResult> {
    try {
      // Extract file paths from work item content
      const filePaths = this.extractFilePaths(workItem.content);
      if (filePaths.length === 0) {
        return {
          error: 'No valid file paths found in work item content'
        };
      }

      // Process each file path silently
      for (const filePath of filePaths) {
        const knowledge = this.session.emitFileKnowledge(filePath);
        if (knowledge === false) {
          return {
            error: `Requested file ${filePath} is not in available files`
          };
        } else if (knowledge === true) {
          // File already exists in context, no action needed
        } else {
          this.session.addItem(knowledge as ContextItem);
        }
      }
      return {};

    } catch (error) {
      return {
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private extractFilePaths(content: string): string[] {
    // Remove XML tags if present
    const cleanContent = content
      .replace(/<\/?path>/g, '')
      .replace(/<\/?files?>/g, '')
      .trim();

    // Split by newlines and filter out empty lines
    return cleanContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}