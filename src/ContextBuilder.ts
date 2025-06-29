// src/ContextBuilder.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Knowledge, WorkItem, SessionContext } from './types';
import { getAvailableFiles, ContextAwareness, AssembledContext } from './types';
import { toolRegistry } from './tools/ToolRegistry';
import { psycheRegistry } from './psyche';

export async function assembleContext(
  awareness: ContextAwareness,
  context: SessionContext,
  parentOutput?: string
): Promise<AssembledContext> {
  const assembled: AssembledContext = {};
  if (awareness.tools) assembled.tools = buildToolsContext(awareness.tools);
  if (awareness.psyches) assembled.psyches = buildPsychesContext(awareness.psyches);
  if (awareness.items) assembled.items = await buildItemsContext(awareness.items, context);
  if (awareness.parent_output && parentOutput) assembled.parent_output = parentOutput;
  if (awareness.project_structure) assembled.project_structure = buildProjectStructureContext();
  if (awareness.files) assembled.files = buildFilesContext(context);
  return assembled;
}

export function formatAwarenessContext(awarenessContext: AssembledContext): string {
  const parts: string[] = [];
  
  if (awarenessContext.project_structure) {
    parts.push(awarenessContext.project_structure);
  }
  
  if (awarenessContext.tools) {
    parts.push(awarenessContext.tools);
  }
  
  if (awarenessContext.psyches) {
    parts.push(awarenessContext.psyches);
  }
  
  if (awarenessContext.files) {
    parts.push(`\n${awarenessContext.files}`);
  }
  
  if (awarenessContext.parent_output) {
    parts.push(`\nParent Output:\n${awarenessContext.parent_output}`);
  }
  
  if (awarenessContext.items) {
    parts.push(`\n${awarenessContext.items}`);
  }
  
  return parts.join('');
}

export function buildToolsContext(awareness: boolean | string[]): string {
  if (!awareness) return '';
  
  const info = toolRegistry.getToolsInfo();
  const filtered = (awareness === true)
                        ? info
                        : info.filter(t => (awareness as string[]).includes(t.name));
  const bulletList = filtered.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const result = `\nAvailable Tools:\n${bulletList}`
  return result;
}

export function buildPsychesContext(awareness: boolean | string[]): string {
  if (!awareness) return '';
  
  const info = psycheRegistry.getAllPsyches();
  const filtered = (awareness === true)
                        ? info
                        : info.filter(p => (awareness as string[]).includes(p.name));
  const bulletList = filtered.map(p => `- ${p.name}: ${p.description}`).join('\n');
  const result = `\nAvailable Agents:\n${bulletList}`
  return result;
}

export async function buildItemsContext(
  awareness: "all" | "knowledge" | "work",
  context: SessionContext
): Promise<string> {
  const parts: string[] = [];
  
  for (const item of context.items) {
    const isKnowledge = 'source' in item;
    const isWorkItem = 'executor' in item;
    
    // Filter based on awareness setting
    if (awareness === "knowledge" && !isKnowledge) continue;
    if (awareness === "work" && !isWorkItem) continue;
    
    if (isKnowledge) {
      const knowledge = item as Knowledge;
      if (knowledge.sourceType === 'file') {
        let content = knowledge.content;
        try {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (workspaceRoot) {
            const fullPath = path.join(workspaceRoot, knowledge.content);
            content = await fs.readFile(fullPath, 'utf-8');
          }
        } catch (error) {
          content = `[File not found]`;
        }
        
        // TODO: don't actually read files lol wtf :D
        parts.push(`<file>[${knowledge.id}] at: ${knowledge.content}\n${content}\n</file>`);
      } else {
        const source = knowledge.sourceType === 'user'
                      ? knowledge.sourceType
                      // for agent and system source types (files take a different route altogether)
                      : `${knowledge.sourceType}(${knowledge.sourceName})`;
        parts.push(`<knowledge>[${knowledge.id}] from: ${source}\ncontent:\n${knowledge.content}\n</knowledge>`);
      }
    } else if (isWorkItem) {
      const workItem = item as WorkItem;
      const source = workItem.sourceType === 'user'
                      ? workItem.sourceType
                      // for agent and system source types (files take a different route altogether)
                      : `${workItem.sourceType}(${workItem.sourceName})`;
      parts.push(`<work>[${workItem.id}] from: ${source} for executor: ${workItem.executor}, status: ${workItem.status}\ncontent:\n${workItem.content}\n</work>`);
    }
  }
  
  return parts.join('\n');
}

export function buildProjectStructureContext(): string {
  const availableFiles = getAvailableFiles();
  if (availableFiles.length === 0) return '';
  
  return `Files index:\n${availableFiles.join('\n')}`;
}

export function buildFilesContext(context: SessionContext): string {
  // Get files that are actually in context (file knowledge items)
  const filePaths = context.items
    .filter(i => i.type === "knowledge")
    .filter(k => k.sourceType === 'file')
    .map(k => k.sourceName);
  
  if (filePaths.length === 0) return '';
  
  return `Files in context:\n${filePaths.join('\n')}`;
}
