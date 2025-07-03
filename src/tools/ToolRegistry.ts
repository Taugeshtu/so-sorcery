import { SessionController } from '../session';
import { ToolDescriptor } from '../types';
import { Tool } from '../worker'

export class ToolRegistry {
  private toolDescriptors: Map<string, ToolDescriptor> = new Map();
  
  register(descriptor: ToolDescriptor): void {
    this.toolDescriptors.set(descriptor.name, descriptor);
  }
  
  initialize(): void {
    // Import tool classes dynamically to avoid circular dependencies
    // const { FileReadTool } = require('./FileReadTool');
    const { FileWriteTool } = require('./FileWriteTool');
    const { MultiReadTool } = require('./MultiReadTool');

    // this.register(FileReadTool.getDescriptor());
    this.register(FileWriteTool.getDescriptor());
    this.register(MultiReadTool.getDescriptor());
  }
  
  getTools(session: SessionController): Map<string, Tool> {
    const result: Map<string, Tool> = new Map();
    
    for (const descriptor of this.toolDescriptors.values()) {
      switch (descriptor.workerClass) {
        case 'FileReadTool':
          const { FileReadTool } = require('./FileReadTool');
          result.set(descriptor.name, new FileReadTool(session, descriptor));
          break;
        case 'FileWriteTool':
          const { FileWriteTool } = require('./FileWriteTool');
          result.set(descriptor.name, new FileWriteTool(session, descriptor));
          break;
        case 'MultiReadTool':
          const { MultiReadTool } = require('./MultiReadTool');
          result.set(descriptor.name, new MultiReadTool(session, descriptor));
          break;
        default:
          console.warn(`Unknown tool class: ${descriptor.workerClass}`);
      }
    }
    
    return result;
  }
  
  getToolsInfo(): Array<{ name: string; description: string }> {
    return Array.from(this.toolDescriptors.values()).map(descriptor => ({
      name: descriptor.name,
      description: descriptor.description
    }));
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();
