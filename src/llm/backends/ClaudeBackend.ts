// src/llm/backends/ClaudeBackend.ts
import * as vscode from 'vscode';
import { Backend } from '../Backend';
import { Model } from '../Model';
import { Messages, Response, StopReason, MessageSide } from '../types';

interface ClaudeResponse {
  content: Array<{ text: string }>;
  stop_reason: string;
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeError {
  type: string;
  message: string;
}

export class ClaudeBackend extends Backend {
  private static readonly API_URL = 'https://api.anthropic.com/v1/messages';

  protected async runStep(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): Promise<Response> {
    const requestBody = this.buildRequestJSON(model, maxTokens, system, messages, terminators);
    
    if (Backend['logTraffic']) {
      console.log('Request:', requestBody);
    }

    let tries = 3;
    while (tries > 0) {
      tries--;
      
      const result = await this.requestResponse(model, requestBody);
      
      if (result.shouldRetry && tries > 0) {
        const delay = 5000 * (3 - tries); // exponential backoff
        await this.sleep(delay);
        continue;
      }
      
      return {
        content: result.response,
        stopReason: result.stopReason,
        terminator: result.terminator
      };
    }

    console.error('!!!! ALARM WAKE THE FUCK UP !!!! this should never happen');
    return { content: '', stopReason: StopReason.NetError };
  }

  private async requestResponse(
    model: Model,
    requestBody: any
  ): Promise<{
    response: string;
    stopReason: StopReason;
    terminator?: string;
    shouldRetry: boolean;
  }> {
    const config = vscode.workspace.getConfiguration('sorcery');
    const apiKey = config.get<string>('claudeApiKey');
    
    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const response = await fetch(ClaudeBackend.API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError: ClaudeError;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = { type: 'unknown_error', message: errorText };
        }

        console.error(`Error: ${parsedError.type}\n'${response.statusText}': ${parsedError.message}`);
        
        const shouldRetry = ['rate_limit_error', 'api_error', 'overloaded_error'].includes(parsedError.type);
        return {
          response: '',
          stopReason: StopReason.NetError,
          shouldRetry
        };
      }

      const responseText = await response.text();
      if (Backend['logTraffic']) {
        console.log('Response:', responseText);
      }

      const parsedResponse: ClaudeResponse = JSON.parse(responseText);
      
      let stopReason = StopReason.Natural;
      let terminator: string | undefined;
      
      if (parsedResponse.stop_reason === 'max_tokens') {
        stopReason = StopReason.Overflow;
      } else if (parsedResponse.stop_reason === 'stop_sequence') {
        stopReason = StopReason.Designed;
        terminator = parsedResponse.stop_sequence;
      }

      model.registerUsage(
        parsedResponse.usage.input_tokens,
        parsedResponse.usage.output_tokens
      );

      return {
        response: parsedResponse.content[0].text,
        stopReason,
        terminator,
        shouldRetry: false
      };

    } catch (error) {
      console.error('Network error:', error);
      return {
        response: '',
        stopReason: StopReason.NetError,
        shouldRetry: true
      };
    }
  }

  private buildRequestJSON(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): any {
    const request: any = {
      model: model.name,
      max_tokens: maxTokens,
      temperature: 0
    };

    if (system) {
      request.system = system;
    }

    if (terminators && terminators.length > 0) {
      request.stop_sequences = terminators;
    }

    request.messages = messages.map(message => {
      const role = message.side === MessageSide.User ? 'user' : 'assistant';
      
      if (!message.images || message.images.length === 0) {
        return {
          role,
          content: message.content
        };
      }

      // Handle images
      const content: any[] = [];
      
      message.images.forEach(image => {
        const mediaType = image.isPNG ? 'image/png' : 'image/jpeg';
        const base64Data = Buffer.from(image.imageBytes).toString('base64');
        
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
          }
        });
      });

      if (message.content) {
        content.push({
          type: 'text',
          text: message.content
        });
      }

      return { role, content };
    });

    return request;
  }
}