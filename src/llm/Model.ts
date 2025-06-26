// src/llm/Model.ts
import { Backend } from './Backend';

export class Model {
  constructor(
    public name: string,
    public backend: Backend,
    public tokensLimit: number,
    public costInputPerMTok: number,
    public costOutputPerMTok: number
  ) {}
  
  calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens * this.costInputPerMTok) / 1_000_000;
    const outputCost = (outputTokens * this.costOutputPerMTok) / 1_000_000;
    return inputCost + outputCost;
  }
}