// src/llm/backends/ClaudeBackend.ts
import * as vscode from 'vscode';
import { WebBackend, WebRequest, WebResponse, ErrorInfo } from '../WebBackend';
import { Model } from '../Model';
import { Messages, StopReason, MessageSide } from '../types';

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

export class ClaudeBackend extends WebBackend {
  private static readonly API_URL = 'https://api.anthropic.com/v1/messages';

  protected buildRequest(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): WebRequest {
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

    return {
      url: ClaudeBackend.API_URL,
      headers: {
        'x-api-key': this.getApiKey(),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: request
    };
  }

  protected parseResponse(responseText: string, model: Model): WebResponse {
    const parsedResponse: ClaudeResponse = JSON.parse(responseText);
    
    let stopReason = StopReason.Natural;
    let terminator: string | undefined;
    
    if (parsedResponse.stop_reason === 'max_tokens') {
      stopReason = StopReason.Overflow;
    } else if (parsedResponse.stop_reason === 'stop_sequence') {
      stopReason = StopReason.Designed;
      terminator = parsedResponse.stop_sequence;
    }

    return {
      content: parsedResponse.content[0].text,
      stopReason,
      terminator,
      inputTokens: parsedResponse.usage.input_tokens,
      outputTokens: parsedResponse.usage.output_tokens
    };
  }

  protected categorizeError(errorText: string, statusCode: number): ErrorInfo {
    let parsedError: ClaudeError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { type: 'unknown_error', message: errorText };
    }

    const isRetryable = [
      'rate_limit_error',
      'api_error', 
      'overloaded_error'
    ].includes(parsedError.type) || statusCode >= 500;

    return {
      type: parsedError.type,
      message: parsedError.message,
      isRetryable
    };
  }

  protected getApiKey(): string {
    const config = vscode.workspace.getConfiguration('sorcery');
    const apiKey = config.get<string>('claudeApiKey');
    
    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }
    
    return apiKey;
  }
}
