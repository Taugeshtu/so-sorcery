// src/worker.ts
import { Psyche } from './psyche';
import { Backend, Models, Response as LLMResponse } from './llm';
import { Knowledge, WorkItem } from './types';
import { Block } from './utils/BlockParser';

export interface WorkerResponse {
  knowledges: Knowledge[];
  works: WorkItem[];
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
        works: [],
        rawResponse: response.content
      };
    }

    // Parse XML blocks
    const knowledges: Knowledge[] = [];
    const workItems: WorkItem[] = [];
    const responseBlock = Block.fromString(response.content);
    
    const knowledgeBlocks = responseBlock.extractAll('<knowledge>\n', '\n</knowledge>');
    for (const block of knowledgeBlocks) {
      const content = block.extracted;
      knowledges.push({
        id: -1,
        source: 'agent',
        content: content,
        collapsed: true,
        metadata: {
          source_psyche: this.psyche.name,
          timestamp: Date.now()
        }
      });
    }

    const workBlocks = responseBlock.extractAll('<work>\n', '\n</work>');
    for (const block of workBlocks) {
      const target = block.extract('<target>', '</target>');
      const extractedContent = (target.length > 0)
                      ? Block.fromString(block+"==terminator").extract('</target>', '==terminator')
                      : block;
      
      let workType: WorkItem['executor'] = 'agent';
      if (target.length >0){
        const extractedTarget = target.extracted;
        if (extractedTarget === 'user') {
          workType = 'user';
        } else if (['multiread', 'file_read', 'file_write'].includes(extractedTarget)) {
          workType = extractedTarget as WorkItem['executor'];
        }
      }
      
      if( extractedContent.length > 0 ) {
        workItems.push({
          id: -1,
          collapsed: false,
          executor: workType,
          content: extractedContent.extracted,
          status: 'cold',
          metadata: {
            source_psyche: this.psyche.name,
            timestamp: Date.now()
          }
        });
      }
    }
    
    // If we didn't parse anything, fall back to raw response
    if (knowledges.length === 0 && workItems.length === 0) {
      knowledges.push({
        id: -1,
        source: 'agent',
        content: response.content,
        collapsed: false,
        metadata: {
          source_psyche: this.psyche.name,
          timestamp: Date.now()
        }
      });
    }

    return { knowledges, works: workItems };
  }

  public getPsyche(): Psyche {
    return this.psyche;
  }
}