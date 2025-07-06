import { Tool } from '../worker';
import { WorkItem, WorkResult, ToolDescriptor } from '../types';

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

      const results: string[] = [];
      const errors: string[] = [];

      // Process each file path
      for (const filePath of filePaths) {
        try {
          const knowledge = this.session.emitFileKnowledge(filePath);
          if (knowledge) {
            this.session.addItem( knowledge );
            results.push(`Added ${filePath} to context (ID: ${knowledge.id})`);
          } else {
            errors.push(`File not available or already in context: ${filePath}`);
          }
        } catch (error) {
          errors.push(`Failed to add ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Create summary knowledge
      const summaryParts: string[] = [];
      if (results.length > 0) {
        summaryParts.push(`Successfully added ${results.length} files to context:`);
        summaryParts.push(...results.map(r => `- ${r}`));
      }
      if (errors.length > 0) {
        summaryParts.push(`\nErrors (${errors.length}):`);
        summaryParts.push(...errors.map(e => `- ${e}`));
      }

      const summaryKnowledge = this.createKnowledge(
        summaryParts.join('\n'),
        'system'
      );

      return {
        knowledges: [summaryKnowledge],
        error: errors.length > 0 ? `${errors.length} files failed to load` : undefined
      };

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
