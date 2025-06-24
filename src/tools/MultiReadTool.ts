// src/tools/MultiReadTool.ts
import { Tool, ToolResult } from './Tool';
import { WorkItem } from '../types';

export class MultiReadTool extends Tool {
  get name(): string {
    return 'multiread';
  }
  
  get description(): string {
    return 'Add multiple files to the context from the list of available files. Provide newline-separated file paths.';
  }

  async execute(workItem: WorkItem): Promise<ToolResult> {
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
          const knowledge = await this.context.includeFileInContext(filePath);
          if (knowledge) {
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
