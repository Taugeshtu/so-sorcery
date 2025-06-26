// src/llm/models.ts
import { Model } from './Model';
import { ClaudeBackend } from './backends/ClaudeBackend';
import { OpenAIBackend } from './backends/OpenAIBackend';

const claude = new ClaudeBackend();
const openai = new OpenAIBackend();

export function getSessionCost(): number {
  return claude.getAccumulatedCost() + openai.getAccumulatedCost();
}

export const Models: Record<string, Model> = {
  // Anthropic Claude 4
  'claude-opus-4-20250514': new Model('claude-opus-4-20250514', claude, 200_000, 15, 75),
  'claude-sonnet-4-20250514': new Model('claude-sonnet-4-20250514', claude, 200_000, 3, 15),
  // Claude 3 series
  'claude-opus-3-20240307': new Model('claude-opus-3-20240307', claude, 200_000, 1.5, 75),
  'claude-3-7-sonnet-20250219': new Model('claude-3-7-sonnet-20250219', claude, 200_000, 3, 15),
  'claude-3-5-haiku-latest': new Model('claude-3-5-haiku-latest', claude, 200_000, 0.08, 4.0),
  'claude-haiku-3-20240307': new Model('claude-haiku-3-20240307', claude, 200_000, 0.03, 1.25),

  // OpenAI GPT‑4.1 family
  'gpt-4.1': new Model('gpt-4.1', openai, 1_000_000, 2.0, 8.0),
  'gpt-4.1-mini': new Model('gpt-4.1-mini', openai, 1_000_000, 0.4, 1.6),
  'gpt-4.1-nano': new Model('gpt-4.1-nano', openai, 1_000_000, 0.1, 0.4),
  // OpenAI legacy/fallback
  'gpt-4o-2024-05-13': new Model('gpt-4o-2024-05-13', openai, 128_000, 2.5, 10),
  'gpt-4o-mini-2024-07-18': new Model('gpt-4o-mini-2024-07-18', openai, 128_000, 0.15, 0.6),
  'gpt-3.5-turbo': new Model('gpt-3.5-turbo', openai, 4_096, 0.5, 1.5)
};
