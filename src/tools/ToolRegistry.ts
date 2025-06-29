// src/tools/ToolRegistry.ts
import { Tool } from './Tool';
import { SessionController } from '../session';

export class ToolRegistry {
  private tools: Map<string, new (session: SessionController) => Tool> = new Map();
  
  /**
   * Register a tool class
   */
  register(toolClass: new (session: SessionController) => Tool): void {
    const instance = new toolClass({} as SessionController); // Temporary instance for metadata
    this.tools.set(instance.name, toolClass);
  }

  /**
   * Create tool instances for a given context
   */
  createTools(context: SessionController): Tool[] {
    return Array.from(this.tools.values()).map(ToolClass => new ToolClass(context));
  }

  /**
   * Get available tool names and descriptions
   */
  getToolsInfo(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map(ToolClass => {
      const instance = new ToolClass({} as SessionController);
      return { name: instance.name, description: instance.description };
    });
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();
