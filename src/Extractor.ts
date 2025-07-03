import { ContextItem, Knowledge, WorkItem } from './types';
import { Block } from './utils/BlockParser';
import { BackendResponse } from './llm';

export interface ExtractionContext {
  sourceType?: ContextItem['sourceType'];
  sourceName?: string;
  timestamp?: number;
}

export interface ExtractionResult {
  knowledges: Knowledge[];
  works: WorkItem[];
  rawResponse: string;
}

export function extract(
    response: BackendResponse | string, 
    context: ExtractionContext = {}
  ): ExtractionResult {
  const rawResponse = typeof response === 'string' ? response : response.content;
  const stopReason = typeof response === 'string' ? 'designed' : response.stopReason;
  const sourceType = context.sourceType || 'agent'; // an assumption, but not a bad one
  const sourceName = context.sourceName || 'unknown';
  const timestamp = context.timestamp || Date.now();
  
  const knowledges: Knowledge[] = [];
  const workItems: WorkItem[] = [];
  
  // Parse XML blocks
  if (stopReason === 'designed') {
    const responseBlock = Block.fromString(`\n${rawResponse}\n`);
    
    const knowledgeBlocks = responseBlock.extractAll('\n<knowledge>', '</knowledge>\n');
    for (const block of knowledgeBlocks) {
      const content = block.extracted;
      knowledges.push({
        id: -1,
        type: 'knowledge',
        sourceType,
        sourceName,
        content: content,
        metadata: {
          timestamp,
          collapsed: true
        }
      });
    }
    
    const workBlocks = responseBlock.extractAll('\n<work>', '</work>\n');
    for (const block of workBlocks) {
      const target = block.extract('<target>', '</target>');
      const executor = (target.length > 0) ? target.extracted : 'user';
      const extractedContent = (target.length > 0)
                      ? Block.fromString(block.extracted + "==terminator").extract('</target>', '==terminator')
                      : block;
      
      if (extractedContent.length > 0) {
        workItems.push({
          id: -1,
          type: 'work',
          sourceType,
          sourceName,
          content: extractedContent.extracted,
          executor,
          status: 'cold',
          metadata: {
            timestamp,
            collapsed: false
          }
        });
      }
    }
  }
  
  // If it didn't terminate cleanly, or extraction failed - just return raw as knowledge
  if (stopReason !== 'designed' || (knowledges.length === 0 && workItems.length === 0)) {
    knowledges.push({
      id: -1, // Will be assigned proper ID by Session
      type: 'knowledge',
      sourceType,
      sourceName,
      content: rawResponse,
      metadata: {
        timestamp,
        collapsed: false
      }
    });
  }
  
  return { knowledges, works: workItems, rawResponse };
}