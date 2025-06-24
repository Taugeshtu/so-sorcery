// src/tools/ToolRegistry.ts
import { Tool } from './Tool';
import { ContextHolder } from '../contextHolder';

export class ToolRegistry {
  private tools: Map<string, new (context: ContextHolder) => Tool> = new Map();

  /**
   * Register a tool class
   */
  register(toolClass: new (context: ContextHolder) => Tool): void {
    const instance = new toolClass({} as ContextHolder); // Temporary instance for metadata
    this.tools.set(instance.name, toolClass);
  }

  /**
   * Create tool instances for a given context
   */
  createTools(context: ContextHolder): Tool[] {
    return Array.from(this.tools.values()).map(ToolClass => new ToolClass(context));
  }

  /**
   * Get available tool names and descriptions
   */
  getToolInfo(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map(ToolClass => {
      const instance = new ToolClass({} as ContextHolder);
      return { name: instance.name, description: instance.description };
    });
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();
