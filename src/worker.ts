// src/worker.ts
import { Psyche } from './psyche';
import { Backend, Models, Response as LLMResponse } from './llm';
import { Knowledge, WorkItem } from './types';

export interface WorkerResponse {
  knowledges: Knowledge[];
  workItems: WorkItem[];
  rawResponse?: string; // for when parsing fails
}

export class Worker {
  private psyche: Psyche;
  private systemPrompt: string;

  constructor(psyche: Psyche, systemContext?: string) {
    this.psyche = psyche;
    this.systemPrompt = systemContext 
      ? `${systemContext}\n\n${psyche.system}`
      : psyche.system;
  }

  public async step(userInput: string): Promise<WorkerResponse> {
    const model = Models[this.psyche.model];
    if (!model) {
      throw new Error(`Model ${this.psyche.model} not found`);
    }

    const llmResponse = await model.backend.run(
      model,
      this.psyche.maxTokens,
      this.systemPrompt,
      userInput,
      this.psyche.priming,
      this.psyche.terminators
    );

    return this.parseResponse(llmResponse);
  }

  private parseResponse(response: LLMResponse): WorkerResponse {
    // If it didn't terminate cleanly, just return raw response as knowledge
    if (response.stopReason !== 'designed') {
      return {
        knowledges: [{
          id: 0, // Will be assigned proper ID by ContextHolder
          source: 'agent',
          content: response.content,
          collapsed: false, // Add this
          metadata: {
            source_psyche: this.psyche.name,
            timestamp: Date.now()
          }
        }],
        workItems: [],
        rawResponse: response.content
      };
    }

    // Parse XML blocks
    const knowledges: Knowledge[] = [];
    const workItems: WorkItem[] = [];

    // Extract <knowledge>...</knowledge> blocks
    const knowledgeRegex = /<knowledge>([\s\S]*?)<\/knowledge>/g;
    let match;
    while ((match = knowledgeRegex.exec(response.content)) !== null) {
      knowledges.push({
        id: 0, // Will be assigned proper ID by ContextHolder
        source: 'agent',
        content: match[1].trim(),
        collapsed: false, // Add this
        metadata: {
          source_psyche: this.psyche.name,
          timestamp: Date.now()
        }
      });
    }

    // Extract <work>...</work> blocks
    const workRegex = /<work>([\s\S]*?)<\/work>/g;
    while ((match = workRegex.exec(response.content)) !== null) {
      const workContent = match[1].trim();
      const targetMatch = workContent.match(/<target>([\s\S]*?)<\/target>/);
      
      let workType: 'user_task' | 'agent_task' = 'agent_task';
      let actualContent = workContent;
      
      if (targetMatch) {
        const target = targetMatch[1].trim().toLowerCase();
        workType = target === 'user' ? 'user_task' : 'agent_task';
        actualContent = workContent.replace(/<target>[\s\S]*?<\/target>/, '').trim();
      }
      
      workItems.push({
        id: 0, // Will be assigned proper ID by ContextHolder
        type: workType,
        content: actualContent,
        status: 'cold',
        metadata: {
          source_psyche: this.psyche.name,
          timestamp: Date.now()
        }
      });
    }
    
    // If we didn't parse anything, fall back to raw response
    if (knowledges.length === 0 && workItems.length === 0) {
      knowledges.push({
        id: 0,
        source: 'agent',
        content: response.content,
        collapsed: false, // Add this
        metadata: {
          source_psyche: this.psyche.name,
          timestamp: Date.now()
        }
      });
    }

    return { knowledges, workItems };
  }

  public getPsyche(): Psyche {
    return this.psyche;
  }
}