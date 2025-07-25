import { Knowledge, WorkItem, WorkResult, ContextAwareness } from './types'
import { WorkerDescriptor, PsycheDescriptor } from './types'
import { SessionController } from './session';
import { psycheRegistry } from './PsycheRegistry';
import { Models } from './llm/models';
import { gatherContext, buildMessages } from './ContextBuilder';
import { workspaceController } from './workspace';
import { extract } from './Extractor';
import { BackendResponse } from './llm/types';

export abstract class Worker {
  public descriptor: WorkerDescriptor;
  public isBusy: boolean;
  
  protected session: SessionController;
  
  constructor(
    session: SessionController,
    descriptor: WorkerDescriptor
  ) {
    this.descriptor = descriptor;
    this.session = session;
    this.isBusy = false;
  }
  
  public canHandle(workItem: WorkItem): boolean {
    return workItem.executor === this.descriptor.name;
  }
  abstract execute(workItem: WorkItem): Promise<WorkResult>;
}

export class PsycheWorker extends Worker {
  private executionCount: number = 0;
  
  async execute(workItem: WorkItem): Promise<WorkResult> {
    try {
      const psycheDescriptor = this.descriptor as PsycheDescriptor;
      const environment = `Workspace: ${this.session.getSession().workspaceName}\n\n`;
      
      const response = await this.runPsyche(
        psycheDescriptor.name, 
        environment, 
        workItem
      );
      
      // Extract knowledge and work items from the response
      const extracted = extract(response, { 
        sourceName: psycheDescriptor.displayName, 
        timestamp: Date.now() 
      });
      
      return {
        knowledges: extracted.knowledges,
        works: extracted.works
      };
      
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async runPsyche(
    psycheName: string,
    systemContext?: string,
    currentWorkItem?: WorkItem,
    chaining?: {
      parentOutput: string,
      currentDepth: number
    }
  ): Promise<BackendResponse> {
    const psyche = psycheRegistry.getPsyche(psycheName);
    if (!psyche) throw new Error(`Psyche ${psycheName} not found`);
    
    const model = Models[psyche.model];
    if (!model) throw new Error(`Model ${psyche.model} for ${psyche.name} not found`);
    
    // Track busy state for THIS psyche execution only
    this.executionCount++;
    this.isBusy = (this.executionCount > 0);
    this.session.notifyStateChanged();
    
    let llmResponse: BackendResponse;
    try {
      const system = systemContext ? `${systemContext}\n\n${psyche.system}` : psyche.system;
      
      const defaultAwareness: ContextAwareness = {
        projectStructure: true,
        knowledge: true,
        work: "all",
        files: true,
        parentOutput: true
      };
      const awareness = psyche.awareness ? psyche.awareness : defaultAwareness;
      const gatheredContext = await gatherContext(
        awareness, 
        this.session.getSession(), 
        currentWorkItem,
        psyche.name,
        chaining?.parentOutput
      );
      const messages = buildMessages(gatheredContext);
      
      // Use runWithMessages instead of run to support images
      llmResponse = await model.backend.runWithMessages(
        model,
        psyche.maxTokens,
        system,
        messages,
        psyche.terminators
      );
      
      // Update session state - also needs guarding for consistency
      this.session.addCost(llmResponse.cost);
      workspaceController.addCost(llmResponse.cost);
      
      this.session.getSession().workerOutputs[psyche.name] = llmResponse.content;
      this.session.notifyStateChanged();
    } finally {
      // Clear busy state immediately after THIS psyche completes its core work
      this.executionCount--;
      this.isBusy = (this.executionCount > 0);
      this.session.notifyStateChanged();
    }
    
    // Post-processing and chaining happens outside execution tracking
    // Each chained psyche will manage its own busy state independently
    if (psyche.post && llmResponse) {
      if (chaining && chaining.currentDepth === 0) {
        console.warn(`Wanting to chain further '${psyche.name}' -> '${psyche.post.psyche}', but out of depth!`);
        return llmResponse;
      }
      
      // Get the next psyche worker and call it
      const nextPsycheWorker = this.session.getPsycheWorker(psyche.post.psyche);
      if (!nextPsycheWorker) {
        throw new Error(`Next psyche ${psyche.post.psyche} not found for chaining`);
      }
      
      const nextStepDepthBudget = chaining
        ? chaining.currentDepth - 1
        : psyche.post.chaining_depth;
      const nextChain = {
        parentOutput: llmResponse.content.trim(),
        currentDepth: nextStepDepthBudget
      };
      
      // This call will manage its own busy state
      return await nextPsycheWorker.runPsyche(
        psyche.post.psyche,
        systemContext,
        currentWorkItem,
        nextChain
      );
    }
    
    return llmResponse;
  }
}

// Tool workers extend the abstract Tool class but implement Worker
export abstract class Tool extends Worker {
  protected createKnowledge(content: string, source: 'system' = 'system'): Knowledge {
    return {
      id: 0, // Will be assigned by Session
      type: 'knowledge',
      sourceType: source,
      sourceName: this.descriptor.name,
      content,
      references: [],
      metadata: {
        timestamp: Date.now(),
        collapsed: false
      }
    };
  }
  
  protected createWorkItem(
    executor: string,
    content: string, 
    tool?: string
  ): WorkItem {
    return {
      id: 0, // Will be assigned by Session
      type: 'work',
      sourceType: 'system',
      sourceName: this.descriptor.name,
      executor,
      content,
      status: 'cold',
      metadata: {
        timestamp: Date.now(),
        collapsed: false
      }
    };
  }
}
