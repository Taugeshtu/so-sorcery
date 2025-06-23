// src/types.ts
export interface Knowledge {
  id: number;
  name: string;
  source: 'user' | 'agent' | 'file';
  content: string;
  references?: number[]; // IDs of other knowledges this references
  collapsed?: boolean;
  metadata?: {
    filePath?: string; // for file type knowledges
    timestamp?: number;
  };
}

export interface SorceryContext {
  workspaceName: string;
  availableFiles: string[];
  knowledges: Knowledge[];
  nextKnowledgeId: number;
}