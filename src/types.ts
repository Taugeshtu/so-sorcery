export interface ContextItemMetadata {
  timestamp: number;
  collapsed: boolean;
  error?: string;
  references?: number[];
}

export interface ContextItem {
  id: number;
  type: 'knowledge' | 'work';
  sourceType: 'user' | 'agent' | 'file' | 'system';
  sourceName: string;
  content: string;
  metadata: ContextItemMetadata;
}

export interface Knowledge extends ContextItem {
  type: 'knowledge';
  references?: number[];
  metadata: ContextItemMetadata & {
    // Knowledge-specific metadata can be added here if needed
  };
}

export interface WorkItem extends ContextItem {
  type: 'work';
  executor: 'multiread' | 'file_read' | 'file_write' | 'user' | 'agent';
  status: 'cold' | 'running' | 'done' | 'failed';
  metadata: ContextItemMetadata & {
    // WorkItem-specific metadata can be added here if needed
  };
}

export interface SessionContext {
  workspaceName: string;
  items: ContextItem[];
  nextId: number;
  workerOutputs?: { [workerKey: string]: string }; // Store latest raw output per worker
  accumulatedCost: number;
}

let availableFiles: string[] = [];
export function updateAvailableFiles(files: string[]): void {
  availableFiles.length = 0;
  availableFiles.push(...files);
}
export function getAvailableFiles(): string[] {
  return availableFiles;
}
