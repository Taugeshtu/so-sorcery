// src/llm/backends/OpenAIBackend.ts
import * as vscode from 'vscode';
import { Backend } from '../Backend';
import { Model } from '../Model';
import { Messages, Response, StopReason, MessageSide } from '../types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface OpenAIError {
  error: {
    type: string;
    message: string;
    code?: string;
  };
}

export class OpenAIBackend extends Backend {
  private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';

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
    const apiKey = config.get<string>('openAIApiKey');
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(OpenAIBackend.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError: OpenAIError;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = { error: { type: 'unknown_error', message: errorText } };
        }

        console.error(`Error: ${parsedError.error.type}\n'${response.statusText}': ${parsedError.error.message}`);
        
        // OpenAI retry conditions
        const shouldRetry = [
          'rate_limit_exceeded',
          'server_error',
          'service_unavailable'
        ].includes(parsedError.error.type) || 
        response.status >= 500 ||
        response.status === 429;

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

      const parsedResponse: OpenAIResponse = JSON.parse(responseText);
      const choice = parsedResponse.choices[0];
      
      let stopReason = StopReason.Natural;
      let terminator: string | undefined;
      
      if (choice.finish_reason === 'length') {
        stopReason = StopReason.Overflow;
      } else if (choice.finish_reason === 'content_filter') {
        stopReason = StopReason.ContentFilter;
      } else if (choice.finish_reason === 'stop') {
        // OpenAI doesn't tell us which stop sequence was hit, but we can try to figure it out
        stopReason = StopReason.Designed;
        // We'd need to check the end of the response against our terminators
        // For now, just mark it as designed stop
      }

      model.registerUsage(
        parsedResponse.usage.prompt_tokens,
        parsedResponse.usage.completion_tokens
      );

      return {
        response: choice.message.content || '',
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

    if (terminators && terminators.length > 0) {
      request.stop = terminators.slice(0, 4); // OpenAI supports max 4 stop sequences
    }

    // Build messages array
    const openaiMessages: OpenAIMessage[] = [];

    // Add system message if provided
    if (system) {
      openaiMessages.push({
        role: 'system',
        content: system
      });
    }

    // Convert our messages to OpenAI format
    messages.forEach(message => {
      const role = message.side === MessageSide.User ? 'user' : 'assistant';
      
      if (!message.images || message.images.length === 0) {
        openaiMessages.push({
          role,
          content: message.content
        });
      } else {
        // Handle images - OpenAI uses different format than Claude
        const content: Array<{
          type: 'text' | 'image_url';
          text?: string;
          image_url?: { url: string };
        }> = [];

        message.images.forEach(image => {
          const mediaType = image.isPNG ? 'image/png' : 'image/jpeg';
          const base64Data = Buffer.from(image.imageBytes).toString('base64');
          const dataUrl = `data:${mediaType};base64,${base64Data}`;
          
          content.push({
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          });
        });

        if (message.content) {
          content.push({
            type: 'text',
            text: message.content
          });
        }

        openaiMessages.push({
          role,
          content
        });
      }
    });

    request.messages = openaiMessages;
    return request;
  }
}