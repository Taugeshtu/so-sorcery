// src/llm/Model.ts
import { Backend } from './Backend';

export class Model {
  public runningCost: number = 0;

  constructor(
    public name: string,
    public backend: Backend,
    public tokensLimit: number,
    public costInputPerMTok: number,
    public costOutputPerMTok: number
  ) {}

  registerUsage(inputTokens: number, outputTokens: number): void {
    const inputCost = (inputTokens * this.costInputPerMTok) / 1_000_000;
    const outputCost = (outputTokens * this.costOutputPerMTok) / 1_000_000;
    this.runningCost += inputCost + outputCost;
  }
}