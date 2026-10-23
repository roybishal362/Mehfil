/**
 * The AI provider boundary. Tasks talk to this interface, never to an SDK directly, so the Gemini
 * implementation can be swapped (e.g. for the Interactions API) or replaced by the deterministic
 * mock in tests and key-less demo mode.
 */
import type { z } from 'zod';

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/** Names used in logs and by the mock to pick a fixture. */
export type AiTask =
  | 'brief'
  | 'section.budget'
  | 'section.timeline'
  | 'section.vendors'
  | 'section.ideas'
  | 'copilot'
  | 'invitation';

export interface GenerationSettings {
  task: AiTask;
  model: string;
  system: string;
  temperature: number;
  maxOutputTokens: number;
  thinking: ThinkingLevel;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Structured input behind the prompt; the mock provider reads it, Gemini never sees it. */
  input?: unknown;
}

export interface JsonRequest<T> extends GenerationSettings {
  prompt: string;
  schema: z.ZodType<T>;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: z.ZodType;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ToolRequest extends GenerationSettings {
  contents: readonly ChatTurn[];
  tools: readonly ToolDeclaration[];
}

export interface ToolCall {
  name: string;
  args: unknown;
}

export interface ToolResponse {
  text: string;
  calls: ToolCall[];
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
}

export interface AiResult<T> {
  data: T;
  model: string;
  usage: AiUsage;
}

export interface AiProvider {
  readonly name: 'gemini' | 'mock';
  generateJson<T>(request: JsonRequest<T>): Promise<AiResult<T>>;
  generateWithTools(request: ToolRequest): Promise<AiResult<ToolResponse>>;
}

export type AiErrorKind =
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'blocked'
  | 'invalid_output'
  | 'bad_request'
  | 'auth'
  | 'aborted';

/** A failure talking to the model, classified so callers can choose to retry or fall back. */
export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiError';
    this.kind = kind;
  }

  /** Worth trying again or on another model. */
  get retryable(): boolean {
    return (
      this.kind === 'rate_limited' ||
      this.kind === 'timeout' ||
      this.kind === 'unavailable' ||
      this.kind === 'invalid_output'
    );
  }
}

/** Combines a caller's abort signal with a timeout. */
export function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
