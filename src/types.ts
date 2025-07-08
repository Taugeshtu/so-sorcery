import { ImageContent } from './llm/types';

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
  executor: string;
  status: 'cold' | 'running' | 'done' | 'failed';
  metadata: ContextItemMetadata & {
    // WorkItem-specific metadata can be added here if needed
  };
}

export interface SessionContext {
  workspaceName: string;
  items: ContextItem[];
  nextId: number;
  workerOutputs: { [workerKey: string]: string }; // Store latest raw output per worker
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

export interface ContextAwareness {
  tools?: boolean | string[];
  psyches?: boolean | string[];
  knowledge?: boolean;
  work?: "all" | "mine" | "current";
  parentOutput?: boolean;
  projectStructure?: boolean;
  files?: boolean;
  images?: boolean;
}

export interface GatheredContext {
  tools?: string;
  psyches?: string;
  items?: string;
  parentOutput?: string;
  projectStructure?: string;
  files?: string;
  images?: ImageContent[];
}

export type AutoRunMode = 'never' | 'on-run' | 'always';

export interface AutoRunConfig {
  mode: AutoRunMode;
  delay?: number; // Optional delay override
}

export interface WorkerDescriptor {
  name: string;
  displayName: string;
  description: string;
  autoRun: AutoRunConfig;
  type: 'agent' | 'tool';
}

export interface PsycheDescriptor extends WorkerDescriptor {
  type: 'agent';
  model: string;
  maxTokens: number;
  system: string;
  priming?: string;
  terminators?: string[];
  awareness?: ContextAwareness;
  post?: {
    psyche: string;
    chaining_depth: number;
  };
}

export interface ToolDescriptor extends WorkerDescriptor {
  type: 'tool';
  workerClass: string; // Class name to instantiate
}

export interface WorkResult {
  knowledges?: Knowledge[];
  works?: WorkItem[];
  error?: string;
}
