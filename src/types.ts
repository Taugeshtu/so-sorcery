export interface Knowledge {
  id: number;
  type: 'user-generated' | 'ai-generated' | 'file';
  content: string;
  references?: number[]; // IDs of other knowledges this references
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