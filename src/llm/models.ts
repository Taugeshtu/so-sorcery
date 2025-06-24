// src/llm/models.ts
import { Model } from './Model';
import { ClaudeBackend } from './backends/ClaudeBackend';
import { OpenAIBackend } from './backends/OpenAIBackend';

const claude = new ClaudeBackend();
const openai = new OpenAIBackend();

export const Models: Record<string, Model> = {
  'claude-3-opus-20240229': new Model('claude-3-opus-20240229', claude, 4096, 15, 75),
  'claude-3-sonnet-20240229': new Model('claude-3-sonnet-20240229', claude, 4096, 3, 15),
  'claude-3-haiku-20240307': new Model('claude-3-haiku-20240307', claude, 4096, 0.25, 1.25),
  'claude-3-5-sonnet-20240620': new Model('claude-3-5-sonnet-20240620', claude, 4096, 3, 15),
  
  'gpt-3.5-turbo-0125': new Model('gpt-3.5-turbo-0125', openai, 4096, 0.5, 1.5),
  'gpt-4-turbo-2024-04-09': new Model('gpt-4-turbo-2024-04-09', openai, 4096, 10, 30),
  'gpt-4o-2024-05-13': new Model('gpt-4o-2024-05-13', openai, 4096, 5, 15),
  'gpt-4o-2024-08-06': new Model('gpt-4o-2024-08-06', openai, 4096, 2.5, 10)
};