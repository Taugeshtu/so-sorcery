// src/psyche.ts
export interface Psyche {
  name: string;
  displayName: string;
  description: string;
  model: string;
  maxTokens: number;
  system: string;
  priming?: string;
  terminators?: string[];
}

// Built-in psyches - we'll expand this as needed
export const BuiltInPsyches: Record<string, Psyche> = {
  project_assistant: {
    name: 'project_assistant',
    displayName: 'Project Assistant',
    description: 'Main coding assistant for project work',
    model: 'claude-3-5-sonnet-20240620',
    maxTokens: 4096,
    system: `You are a project assistant. You help with code analysis, planning, and implementation.

Your responses should be structured using XML tags:
- <knowledge>...</knowledge> for insights, analysis, or information
- <work>...</work> for specific tasks, file operations, or actions to be taken

You have access to the current project context including files and previous knowledge.
Be concise but thorough in your analysis.`,
    terminators: ['</response>']
  }
};

export function getPsyche(name: string): Psyche | undefined {
  return BuiltInPsyches[name];
}

export function getAllPsycheNames(): string[] {
  return Object.keys(BuiltInPsyches);
}