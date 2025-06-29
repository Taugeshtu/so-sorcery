// src/tools/ToolRegistry.ts
import { Tool } from './Tool';
import { Session } from '../session';

export class ToolRegistry {
  private tools: Map<string, new (session: Session) => Tool> = new Map();
  
  /**
   * Register a tool class
   */
  register(toolClass: new (session: Session) => Tool): void {
    const instance = new toolClass({} as Session); // Temporary instance for metadata
    this.tools.set(instance.name, toolClass);
  }

  /**
   * Create tool instances for a given context
   */
  createTools(context: Session): Tool[] {
    return Array.from(this.tools.values()).map(ToolClass => new ToolClass(context));
  }

  /**
   * Get available tool names and descriptions
   */
  getToolsInfo(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map(ToolClass => {
      const instance = new ToolClass({} as Session);
      return { name: instance.name, description: instance.description };
    });
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();
