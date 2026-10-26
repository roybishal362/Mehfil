/**
 * Gemini via the official @google/genai SDK (`models.generateContent`).
 * Structured output uses `responseJsonSchema` generated from our Zod schemas; the answer is then
 * validated again with Zod, because valid JSON can still be wrong.
 */
import {
  ApiError,
  FinishReason,
  FunctionCallingConfigMode,
  GoogleGenAI,
  ThinkingLevel as SdkThinkingLevel,
  type GenerateContentResponse,
} from '@google/genai';
import { toGeminiSchema } from './json-schema';
import {
  AiError,
  type AiProvider,
  type AiResult,
  type AiUsage,
  type JsonRequest,
  type ThinkingLevel,
  type ToolRequest,
  type ToolResponse,
  withTimeout,
} from './provider';

const THINKING: Readonly<Record<ThinkingLevel, SdkThinkingLevel>> = {
  minimal: SdkThinkingLevel.MINIMAL,
  low: SdkThinkingLevel.LOW,
  medium: SdkThinkingLevel.MEDIUM,
  high: SdkThinkingLevel.HIGH,
};

/**
 * Flash-Lite models accept "minimal" thinking; larger Flash models start at "low".
 * Matters when a request falls back from one model to the other.
 */
export function thinkingFor(model: string, level: ThinkingLevel): SdkThinkingLevel {
  if (level === 'minimal' && !model.includes('lite')) return SdkThinkingLevel.LOW;
  return THINKING[level];
}

function usageOf(response: GenerateContentResponse): AiUsage {
  const meta = response.usageMetadata;
  return {
    ...(meta?.promptTokenCount !== undefined ? { inputTokens: meta.promptTokenCount } : {}),
    ...(meta?.candidatesTokenCount !== undefined
      ? { outputTokens: meta.candidatesTokenCount }
      : {}),
    ...(meta?.thoughtsTokenCount !== undefined ? { thoughtTokens: meta.thoughtsTokenCount } : {}),
  };
}

const BLOCKING_REASONS = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

/** Throws a classified error when the model refused or was cut off. */
function assertCompleted(response: GenerateContentResponse): void {
  if (response.promptFeedback?.blockReason) {
    throw new AiError('blocked', 'The request was blocked by safety filters');
  }
  const reason = response.candidates?.[0]?.finishReason;
  if (reason && BLOCKING_REASONS.has(reason)) {
    throw new AiError('blocked', 'The answer was blocked by safety filters');
  }
  if (reason === FinishReason.MAX_TOKENS) {
    throw new AiError('invalid_output', 'The answer was cut off before it finished');
  }
  if (reason === FinishReason.MALFORMED_FUNCTION_CALL) {
    throw new AiError('invalid_output', 'The model proposed a malformed change');
  }
}

/** Maps an HTTP error from Gemini to what the gateway should do about it. */
function classifyApiError(error: ApiError): AiError {
  const { status } = error;
  if (status === 429)
    return new AiError('rate_limited', 'Gemini rate limit reached', { cause: error });
  if (status === 401 || status === 403) {
    return new AiError('auth', 'Gemini rejected the API key', { cause: error });
  }
  if (status >= 400 && status < 500) {
    return new AiError('bad_request', 'Gemini rejected the request', { cause: error });
  }
  return new AiError('unavailable', 'Gemini is unavailable', { cause: error });
}

/** Maps SDK and network failures to `AiError` kinds. */
export function classifyError(error: unknown, signal: AbortSignal, parent?: AbortSignal): AiError {
  if (error instanceof AiError) return error;
  if (parent?.aborted) return new AiError('aborted', 'The request was cancelled', { cause: error });
  if (signal.aborted) {
    return new AiError('timeout', 'The model took too long to answer', { cause: error });
  }
  if (error instanceof ApiError) return classifyApiError(error);
  return new AiError('unavailable', 'Could not reach Gemini', { cause: error });
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, client?: GoogleGenAI) {
    // Retries are handled by our own fallback chain, so the SDK must not retry for a minute.
    this.client =
      client ?? new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<AiResult<T>> {
    const signal = withTimeout(request.timeoutMs, request.signal);
    try {
      const response = await this.client.models.generateContent({
        model: request.model,
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: toGeminiSchema(request.schema),
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          thinkingConfig: { thinkingLevel: thinkingFor(request.model, request.thinking) },
          abortSignal: signal,
        },
      });
      assertCompleted(response);
      let raw: unknown;
      try {
        raw = JSON.parse(response.text ?? '');
      } catch (error) {
        throw new AiError('invalid_output', 'The model did not return JSON', { cause: error });
      }
      const parsed = request.schema.safeParse(raw);
      if (!parsed.success) {
        throw new AiError('invalid_output', 'The model answer did not match the schema', {
          cause: parsed.error,
        });
      }
      return { data: parsed.data, model: request.model, usage: usageOf(response) };
    } catch (error) {
      throw classifyError(error, signal, request.signal);
    }
  }

  async generateWithTools(request: ToolRequest): Promise<AiResult<ToolResponse>> {
    const signal = withTimeout(request.timeoutMs, request.signal);
    try {
      const response = await this.client.models.generateContent({
        model: request.model,
        contents: request.contents.map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        config: {
          systemInstruction: request.system,
          tools: [
            {
              functionDeclarations: request.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parametersJsonSchema: toGeminiSchema(tool.parameters),
              })),
            },
          ],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          thinkingConfig: { thinkingLevel: thinkingFor(request.model, request.thinking) },
          abortSignal: signal,
        },
      });
      assertCompleted(response);
      const calls = (response.functionCalls ?? []).map((call) => ({
        name: call.name ?? '',
        args: call.args ?? {},
      }));
      return {
        data: { text: response.text ?? '', calls },
        model: request.model,
        usage: usageOf(response),
      };
    } catch (error) {
      throw classifyError(error, signal, request.signal);
    }
  }
}
