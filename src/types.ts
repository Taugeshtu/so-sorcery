// src/types.ts
export interface Knowledge {
  id: number;
  source: 'user' | 'agent' | 'file' | 'system';
  content: string;
  collapsed: boolean;
  references?: number[];
  metadata?: {
    timestamp?: number;
    source_psyche?: string; // which psyche generated this
    source_tool?: string; // which tool generated this
  };
}

export interface WorkItem {
  id: number;
  type: 'multiread' | 'file_read' | 'file_write' | 'user_task' | 'agent_task';
  content: string;
  status: 'cold' | 'wip' | 'done';
  metadata?: {
    timestamp?: number;
    source_psyche?: string; // which psyche generated this
    source_tool?: string; // which tool generated this
  };
}

export interface SorceryContext {
  workspaceName: string;
  availableFiles: string[];
  knowledges: Knowledge[];
  workItems: WorkItem[];
  nextId: number;
}