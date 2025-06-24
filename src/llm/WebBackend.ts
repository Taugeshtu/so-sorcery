// src/llm/backends/WebBackend.ts
import * as vscode from 'vscode';
import { Backend } from './Backend';
import { Model } from './Model';
import { Messages, Response, StopReason } from './types';

export interface WebRequest {
  url: string;
  headers: Record<string, string>;
  body: any;
}

export interface WebResponse {
  content: string;
  stopReason: StopReason;
  terminator?: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ErrorInfo {
  type: string;
  message: string;
  isRetryable: boolean;
}

export abstract class WebBackend extends Backend {
  protected async runStep(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): Promise<Response> {
    const request = this.buildRequest(model, maxTokens, system, messages, terminators);
    
    if (Backend['logTraffic']) {
      console.log('Request:', request.body);
    }

    let tries = 3;
    let lastError: ErrorInfo | undefined;
    
    while (tries > 0) {
      tries--;
      
      const result = await this.makeRequest(request, model);
      
      if (result.shouldRetry && tries > 0) {
        lastError = result.error;
        const delay = 5000 * (3 - tries); // exponential backoff
        await this.sleep(delay);
        continue;
      }
      
      if (result.error) {
        console.error(`API Error: ${result.error.type} - ${result.error.message}`);
        
        // Show notification based on error type
        if (result.error.isRetryable) {
          vscode.window.showWarningMessage(
            `${model.name} API temporarily unavailable: ${result.error.message}. All retries exhausted.`
          );
        } else {
          vscode.window.showErrorMessage(
            `${model.name} API error: ${result.error.message}`
          );
        }
        
        return { content: '', stopReason: StopReason.NetError };
      }
      
      return {
        content: result.response!.content,
        stopReason: result.response!.stopReason,
        terminator: result.response!.terminator
      };
    }

    // This should never happen but add notification just in case
    vscode.window.showErrorMessage(`Unexpected error in ${model.name} API handling`);
    console.error('!!!! ALARM WAKE THE FUCK UP !!!! this should never happen');
    return { content: '', stopReason: StopReason.NetError };
  }

  private async makeRequest(
    request: WebRequest,
    model: Model
  ): Promise<{
    response?: WebResponse;
    error?: ErrorInfo;
    shouldRetry: boolean;
  }> {
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorInfo = this.categorizeError(errorText, response.status);
        
        return {
          error: errorInfo,
          shouldRetry: errorInfo.isRetryable
        };
      }

      const responseText = await response.text();
      if (Backend['logTraffic']) {
        console.log('Response:', responseText);
      }

      const parsedResponse = this.parseResponse(responseText, model);
      
      model.registerUsage(
        parsedResponse.inputTokens,
        parsedResponse.outputTokens
      );

      return {
        response: parsedResponse,
        shouldRetry: false
      };

    } catch (error) {
      console.error('Network error:', error);
      return {
        error: {
          type: 'network_error',
          message: error instanceof Error ? error.message : 'Unknown network error',
          isRetryable: true
        },
        shouldRetry: true
      };
    }
  }

  protected abstract buildRequest(
    model: Model,
    maxTokens: number,
    system: string,
    messages: Messages,
    terminators?: string[]
  ): WebRequest;

  protected abstract parseResponse(responseText: string, model: Model): WebResponse;

  protected abstract categorizeError(errorText: string, statusCode: number): ErrorInfo;

  protected abstract getApiKey(): string;
}
