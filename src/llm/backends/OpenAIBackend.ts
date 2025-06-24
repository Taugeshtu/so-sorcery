// src/llm/backends/OpenAIBackend.ts
import * as vscode from 'vscode';
import { WebBackend, WebRequest, WebResponse, ErrorInfo } from '../WebBackend';
import { Model } from '../Model';
import { Messages, StopReason, MessageSide } from '../types';

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

export class OpenAIBackend extends WebBackend {
  private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';

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

    return {
      url: OpenAIBackend.API_URL,
      headers: {
        'Authorization': `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: request
    };
  }

  protected parseResponse(responseText: string, model: Model): WebResponse {
    const parsedResponse: OpenAIResponse = JSON.parse(responseText);
    const choice = parsedResponse.choices[0];
    
    let stopReason = StopReason.Natural;
    let terminator: string | undefined;
    
    if (choice.finish_reason === 'length') {
      stopReason = StopReason.Overflow;
    } else if (choice.finish_reason === 'content_filter') {
      stopReason = StopReason.ContentFilter;
    } else if (choice.finish_reason === 'stop') {
      stopReason = StopReason.Designed;
      // OpenAI doesn't tell us which stop sequence was hit
    }

    return {
      content: choice.message.content || '',
      stopReason,
      terminator,
      inputTokens: parsedResponse.usage.prompt_tokens,
      outputTokens: parsedResponse.usage.completion_tokens
    };
  }

  protected categorizeError(errorText: string, statusCode: number): ErrorInfo {
    let parsedError: OpenAIError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { error: { type: 'unknown_error', message: errorText } };
    }

    const isRetryable = [
      'rate_limit_exceeded',
      'server_error',
      'service_unavailable'
    ].includes(parsedError.error.type) || 
    statusCode >= 500 ||
    statusCode === 429;

    return {
      type: parsedError.error.type,
      message: parsedError.error.message,
      isRetryable
    };
  }

  protected getApiKey(): string {
    const config = vscode.workspace.getConfiguration('sorcery');
    const apiKey = config.get<string>('openAIApiKey');
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    return apiKey;
  }
}
