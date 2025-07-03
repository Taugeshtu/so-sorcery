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
  parentOutput?: string
): Promise<GatheredContext> {
  const assembled: GatheredContext = {};
  if (awareness.tools) assembled.tools = buildToolsContext(awareness.tools);
  if (awareness.psyches) assembled.psyches = buildPsychesContext(awareness.psyches);
  if (awareness.projectStructure) assembled.projectStructure = buildProjectStructureContext();
  if (awareness.files) assembled.files = await buildFilesContext(context);
  if (awareness.items) assembled.items = buildItemsContext(awareness.items, context);
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
  const filtered = (awareness === true)
                        ? info
                        : info.filter(t => (awareness as string[]).includes(t.name));
  const bulletList = filtered.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const result = `Available Tools:\n${bulletList}`
  return result;
}

export function buildPsychesContext(awareness: boolean | string[]): string {
  if (!awareness) return '';
  
  const info = psycheRegistry.getPsychesInfo();
  const filtered = (awareness === true)
                        ? info
                        : info.filter(p => (awareness as string[]).includes(p.name));
  const bulletList = filtered.map(p => `- ${p.name}: ${p.description}`).join('\n');
  const result = `Available Agents:\n${bulletList}`
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
  awareness: "all" | "knowledge" | "work",
  context: SessionContext
): string {
  const parts: string[] = [];
  
  for (const item of context.items) {
    // Filter based on awareness setting
    if (awareness === "knowledge" && item.type !== 'knowledge') continue;
    if (awareness === "work" && item.type !== 'work') continue;
    
    if (item.type === 'knowledge') {
      const knowledge = item as Knowledge;
      if (item.sourceType === 'file') continue;
      
      const source = knowledge.sourceType === 'user'
                    ? knowledge.sourceType
                    // for agent and system source types (files take a different route altogether)
                    : `${knowledge.sourceType}(${knowledge.sourceName})`;
      parts.push(`<knowledge>[${knowledge.id}] from: ${source}\ncontent:\n${knowledge.content}\n</knowledge>`);
    }
    if (item.type === 'work') {
      const workItem = item as WorkItem;
      const source = workItem.sourceType === 'user'
                      ? workItem.sourceType
                      // for agent and system source types (files take a different route altogether)
                      : `${workItem.sourceType}(${workItem.sourceName})`;
      parts.push(`<work>[${workItem.id}] from: ${source} for: ${workItem.executor}, status: ${workItem.status}\ncontent:\n${workItem.content}\n</work>`);
    }
  }
  
  return parts.join('\n');
}
