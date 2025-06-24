// src/llm/types.ts
export enum MessageSide {
  System = 'system',
  User = 'user', 
  Agent = 'agent'
}

export interface ImageContent {
  imageBytes: Uint8Array;
  isPNG: boolean;
}

export interface Message {
  side: MessageSide;
  content: string;
  images?: ImageContent[];
}

export enum StopReason {
  Natural = 'natural',
  Overflow = 'overflow', 
  ContentFilter = 'content_filter',
  Designed = 'designed',
  NetError = 'net_error'
}

export interface Response {
  content: string;
  stopReason: StopReason;
  terminator?: string;
}

export type Messages = Message[];