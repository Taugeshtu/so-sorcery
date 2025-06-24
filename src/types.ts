// src/types.ts
export interface Knowledge {
  id: number;
  source: 'user' | 'agent' | 'file';
  content: string;
  collapsed: boolean;
  references?: number[];
  metadata?: {
    filePath?: string;
    timestamp?: number;
    psyche?: string; // which psyche generated this
  };
}

export interface WorkItem {
  id: number;
  type: 'file_read' | 'file_write' | 'user_task' | 'agent_task';
  content: string;
  metadata?: {
    filePath?: string;
    timestamp?: number;
    psyche?: string;
    completed?: boolean;
  };
}

export interface SorceryContext {
  workspaceName: string;
  availableFiles: string[];
  includedFiles: string[]; // Files actually loaded into context
  knowledges: Knowledge[];
  workItems: WorkItem[];
  nextKnowledgeId: number;
  nextWorkId: number;
}