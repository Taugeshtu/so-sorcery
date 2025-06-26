import { Knowledge, WorkItem } from './types';
import { Block } from './utils/BlockParser';
import { Response as LLMResponse } from './llm';

export interface ExtractionContext {
  source_psyche?: string;
  source_tool?: string;
  timestamp?: number;
}

export interface ExtractionResult {
  knowledges: Knowledge[];
  works: WorkItem[];
  rawResponse: string;
}

export function extract(
    response: LLMResponse | string, 
    context: ExtractionContext = {}
  ): ExtractionResult {
    const rawResponse = typeof response === 'string' ? response : response.content;
    const stopReason = typeof response === 'string' ? 'designed' : response.stopReason;
    const timestamp = context.timestamp || Date.now();
  
  // If it didn't terminate cleanly, just return raw response as knowledge
  if (stopReason !== 'designed') {
    return {
      knowledges: [{
        id: -1, // Will be assigned proper ID by ContextHolder
        source: 'agent',
        content: rawResponse,
        collapsed: false,
        metadata: {
          ...context,
          timestamp
        }
      }],
      works: [],
      rawResponse
    };
  }
  
  // Parse XML blocks
  const knowledges: Knowledge[] = [];
  const workItems: WorkItem[] = [];
  const responseBlock = Block.fromString('\n'+rawResponse+'\n');
  
  // Extract knowledge blocks
  const knowledgeBlocks = responseBlock.extractAll('\n<knowledge>', '</knowledge>\n');
  for (const block of knowledgeBlocks) {
    const content = block.extracted;
    knowledges.push({
      id: -1,
      source: 'agent',
      content: content,
      collapsed: true,
      metadata: {
        ...context,
        timestamp
      }
    });
  }
  
  // Extract work blocks
  const workBlocks = responseBlock.extractAll('\n<work>', '</work>\n');
  for (const block of workBlocks) {
    const target = block.extract('<target>', '</target>');
    const extractedContent = (target.length > 0)
                    ? Block.fromString(block.extracted + "==terminator").extract('</target>', '==terminator')
                    : block;
    
    let workType: WorkItem['executor'] = 'agent';
    if (target.length > 0) {
      const extractedTarget = target.extracted;
      if (extractedTarget === 'user') {
        workType = 'user';
      } else if (['multiread', 'file_read', 'file_write'].includes(extractedTarget)) {
        workType = extractedTarget as WorkItem['executor'];
      }
    }
    
    if (extractedContent.length > 0) {
      workItems.push({
        id: -1,
        collapsed: false,
        executor: workType,
        content: extractedContent.extracted,
        status: 'cold',
        metadata: {
          ...context,
          timestamp
        }
      });
    }
  }
  
  // If we didn't parse anything, fall back to raw response
  if (knowledges.length === 0 && workItems.length === 0) {
    knowledges.push({
      id: -1,
      source: 'agent',
      content: rawResponse,
      collapsed: false,
      metadata: {
        ...context,
        timestamp
      }
    });
  }
  
  return { knowledges, works: workItems, rawResponse };
}