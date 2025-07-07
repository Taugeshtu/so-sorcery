// src/ContextBuilder.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Knowledge, WorkItem, SessionContext } from './types';
import { getAvailableFiles, ContextAwareness, GatheredContext as GatheredContext } from './types';
import { toolRegistry } from './tools/ToolRegistry';
import { psycheRegistry } from './PsycheRegistry';

export async function gatherContext(
  awareness: ContextAwareness,
  context: SessionContext,
  currentWorkItem?: WorkItem,
  executorName?: string,
  parentOutput?: string
): Promise<GatheredContext> {
  const assembled: GatheredContext = {};
  if (awareness.tools) assembled.tools = buildToolsContext(awareness.tools);
  if (awareness.psyches) assembled.psyches = buildPsychesContext(awareness.psyches);
  if (awareness.projectStructure) assembled.projectStructure = buildProjectStructureContext();
  if (awareness.files) assembled.files = await buildFilesContext(context);
  if (awareness.knowledge || awareness.work) {
    assembled.items = buildItemsContext(awareness, context, executorName, currentWorkItem);
  }
  if (awareness.parentOutput && parentOutput) assembled.parentOutput = `<previous_agent_output>\n${parentOutput}\n</previous_agent_output>`;
  return assembled;
}

export function bakeContext(context: GatheredContext): string {
  const parts: string[] = [];
  if (context.tools) parts.push(context.tools);
  if (context.psyches) parts.push(context.psyches);
  if (context.projectStructure) parts.push(context.projectStructure);
  if (context.files) parts.push(context.files);
  if (context.items) parts.push(context.items);
  if (context.parentOutput) parts.push(context.parentOutput);
  return parts.join('\n\n');
}

export function buildToolsContext(awareness: boolean | string[]): string {
  if (!awareness) return '';
  
  const info = toolRegistry.getToolsInfo();
  let filtered;
  
  if (awareness === true) {
    filtered = info;
  } else {
    const stringArray = awareness as string[];
    const isNegativeMask = stringArray.length > 0 && stringArray.every(item => item.startsWith('!'));
    
    if (isNegativeMask) {
      // Remove the '!' prefix and exclude those tools
      const excludeNames = stringArray.map(item => item.substring(1));
      filtered = info.filter(t => !excludeNames.includes(t.name));
    } else {
      // Positive filtering (existing behavior)
      filtered = info.filter(t => stringArray.includes(t.name));
    }
  }
  
  const bulletList = filtered.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const result = `Available Tools:\n${bulletList}`;
  return result;
}

export function buildPsychesContext(awareness: boolean | string[]): string {
  if (!awareness) return '';
  
  const info = psycheRegistry.getPsychesInfo();
  let filtered;
  
  if (awareness === true) {
    filtered = info;
  } else {
    const stringArray = awareness as string[];
    const isNegativeMask = stringArray.length > 0 && stringArray.every(item => item.startsWith('!'));
    
    if (isNegativeMask) {
      // Remove the '!' prefix and exclude those psyches
      const excludeNames = stringArray.map(item => item.substring(1));
      filtered = info.filter(p => !excludeNames.includes(p.name));
    } else {
      // Positive filtering (existing behavior)
      filtered = info.filter(p => stringArray.includes(p.name));
    }
  }
  
  const bulletList = filtered.map(p => `- ${p.name}: ${p.description}`).join('\n');
  const result = `Available Agents:\n${bulletList}`;
  return result;
}

export function buildProjectStructureContext(): string {
  const availableFiles = getAvailableFiles();
  if (availableFiles.length === 0) return '';
  
  return `Project Files index:\n${availableFiles.join('\n')}`;
}

export async function buildFilesContext(context: SessionContext): Promise<string> {
  const parts: string[] = [];
  
  for (const item of context.items) {
    if(item.type !== 'knowledge') continue;
    if(item.sourceType !== 'file') continue;
    
    let content = item.content;
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        const fullPath = path.join(workspaceRoot, item.sourceName);
        content = await fs.readFile(fullPath, 'utf-8');
      }
    } catch (error) {
      content = `[File not found]`;
    }
    
    parts.push(`<file>[${item.id}] at: ${item.sourceName}\n${content}\n</file>`);
  }
  return parts.join('\n\n');
}

export function buildItemsContext(
  awareness: ContextAwareness,
  context: SessionContext,
  executorName?: string,
  currentWorkItem?: WorkItem
): string {
  const parts: string[] = [];
  
  for (const item of context.items) {
    // Handle knowledge items
    if (item.type === 'knowledge') {
      // Skip if only work items are requested
      if (awareness.work && !awareness.knowledge) continue;
      
      // Skip file-sourced knowledge items (they're handled separately in buildFilesContext)
      if (item.sourceType === 'file') continue;
      
      const knowledge = item as Knowledge;
      const source = knowledge.sourceType === 'user'
                    ? knowledge.sourceType
                    : `${knowledge.sourceType}(${knowledge.sourceName})`;
      parts.push(`<knowledge>[${knowledge.id}] from: ${source}\ncontent:\n${knowledge.content}\n</knowledge>`);
    }
    
    // Handle work items
    if (item.type === 'work') {
      // Skip if only knowledge items are requested
      if (awareness.knowledge && !awareness.work) continue;
      
      const workItem = item as WorkItem;
      
      // Apply work filtering
      if (awareness.work) {
        switch (awareness.work) {
          case 'current':
            // Only include the current work item being executed
            if (!currentWorkItem || workItem.id !== currentWorkItem.id) continue;
            break;
          case 'mine':
            // Only include work items for the current executor
            if (!executorName || workItem.executor !== executorName) continue;
            break;
          case 'all':
            // Include all work items (no filtering)
            break;
        }
      }
      
      const source = workItem.sourceType === 'user'
                      ? workItem.sourceType
                      : `${workItem.sourceType}(${workItem.sourceName})`;
      parts.push(`<work>[${workItem.id}] from: ${source} for: ${workItem.executor}, status: ${workItem.status}\ncontent:\n${workItem.content}\n</work>`);
    }
  }
  
  return parts.join('\n');
}
