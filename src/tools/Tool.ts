// src/tools/Tool.ts
import { WorkItem, Knowledge } from '../types';
import { Session } from '../session';

export interface ToolResult {
  knowledges?: Knowledge[];
  works?: WorkItem[];
  error?: string;
}

export abstract class Tool {
  protected context: Session;
  
  constructor(context: Session) {
    this.context = context;
  }

  /**
   * Unique identifier for this tool type
   */
  abstract get name(): string;

  /**
   * Human-readable description of what this tool does
   */
  abstract get description(): string;
  
  // allows the tool to be launched automatically
  abstract get autoRun(): boolean;

  /**
   * Execute a work item using this tool
   * @param workItem The work item to execute
   * @returns Promise resolving to tool results
   */
  abstract execute(workItem: WorkItem): Promise<ToolResult>;

  /**
   * Check if this tool can handle the given work item
   * Default implementation checks if workItem.metadata.tool matches this.name
   */
  canHandle(workItem: WorkItem): boolean {
    return workItem.executor === this.name;
  }
  
  protected createKnowledge(content: string, source: 'system' = 'system'): Knowledge {
    return {
      id: 0, // Will be assigned by ContextHolder
      type: 'knowledge',
      sourceType: source,
      sourceName: this.name,
      content,
      references: [],
      metadata: {
        timestamp: Date.now(),
        collapsed: false
      }
    };
  }

  /**
   * Helper method to create work items
   */
  protected createWorkItem(
    type: WorkItem['executor'], 
    content: string, 
    tool?: string
  ): WorkItem {
    return {
      id: 0, // Will be assigned by ContextHolder
      type: 'work',
      sourceType: 'system',
      sourceName: this.name,
      executor: type,
      content,
      status: 'cold',
      metadata: {
        timestamp: Date.now(),
        collapsed: false
      }
    };
  }
}
