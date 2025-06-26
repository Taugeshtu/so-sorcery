export interface ContextItemMetadata {
  timestamp: number;
  source_psyche?: string;
  source_tool?: string;
  error?: string;
}

export interface ContextItem {
  id: number;
  collapsed: boolean;
  metadata: ContextItemMetadata;
}

export interface Knowledge extends ContextItem {
  source: 'user' | 'agent' | 'file' | 'system';
  content: string;
  references?: number[];
  metadata: ContextItemMetadata & {
    // Knowledge-specific metadata can be added here if needed
  };
}

export interface WorkItem extends ContextItem {
  executor: 'multiread' | 'file_read' | 'file_write' | 'user' | 'agent';
  content: string;
  status: 'cold' | 'running' | 'done' | 'failed';
  metadata: ContextItemMetadata & {
    // WorkItem-specific metadata can be added here if needed
  };
}

export interface SorceryContext {
  workspaceName: string;
  items: ContextItem[];
  nextId: number;
  workerOutputs?: { [workerKey: string]: string }; // Store latest raw output per worker
  accumulatedCost: number;
}