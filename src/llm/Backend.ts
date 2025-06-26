// src/llm/Backend.ts
import { Model } from './Model';
import { Messages, LLMResponse, StopReason, MessageSide, BackendResponse } from './types';

export abstract class Backend {
  protected static logTraffic = false;
  protected _accumulatedCost: number = 0;
  
  public getAccumulatedCost(): number {
    return this._accumulatedCost;
  }
  
  public async run(
    model: Model,
    maxTokens: number,
    system: string,
    user: string,
    priming?: string,
    terminators?: string[]
  ): Promise<BackendResponse> {
    const messages: Messages = [{ side: MessageSide.User, content: user }];
    if (priming) {
      messages.push({ side: MessageSide.Agent, content: priming });
    }
    return this.runWithMessages(model, maxTokens, system, messages, terminators);
  }

  public async runWithMessages(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): Promise<BackendResponse> {
    const messagesCopy = [...messages];
    
    let tokensToSample = maxTokens;
    let fullResponse = '';
    let trailingWhitespace = '';
    let stopReason = StopReason.Natural;
    let terminator: string | undefined;
    let inputTokensUsed = 0;
    let outputTokensUsed = 0;
    
    while (tokensToSample > 0) {
      const currentSampleSize = Math.min(tokensToSample, model.tokensLimit);
      const result = await this.runStep(model, currentSampleSize, system, messagesCopy, terminators);
      
      result.content = trailingWhitespace + result.content;
      tokensToSample -= model.tokensLimit;
      inputTokensUsed += result.inputTokens;
      outputTokensUsed += result.outputTokens;
      
      fullResponse += result.content;
      stopReason = result.stopReason;
      terminator = result.terminator;

      if (result.stopReason === StopReason.Overflow) {
        console.log(`Overflowing model's output tokens limit, trying to continue... ${tokensToSample} tokens to sample left`);
        
        // Extract trailing whitespace
        if (result.content.length > 0 && /\s/.test(result.content[result.content.length - 1])) {
          let i = result.content.length - 1;
          trailingWhitespace = '';
          while (i >= 0 && /\s/.test(result.content[i])) {
            trailingWhitespace = result.content[i] + trailingWhitespace;
            i--;
          }
          result.content = result.content.substring(0, i + 1);
        } else {
          trailingWhitespace = '';
        }

        // Append to message chain
        const lastMessage = messagesCopy[messagesCopy.length - 1];
        if (lastMessage.side === MessageSide.User) {
          messagesCopy.push({ side: MessageSide.Agent, content: result.content });
        } else {
          lastMessage.content += result.content;
        }
      } else {
        break;
      }
    }
    
    const cost = model.calculateCost( inputTokensUsed, outputTokensUsed );
    this._accumulatedCost += cost;
    return { content: fullResponse, stopReason, terminator, cost };
  }

  protected abstract runStep(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): Promise<LLMResponse>;

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}