// src/types.ts
export interface Knowledge {
  id: number;
  name: string;
  source: 'user' | 'agent' | 'file';
  content: string;
  references?: number[];
  collapsed?: boolean;
  timestamp: number; // Always present, no more metadata object
}

export interface SorceryContext {
  workspaceName: string;
  availableFiles: string[];
  knowledges: Knowledge[];
  nextKnowledgeId: number;
}