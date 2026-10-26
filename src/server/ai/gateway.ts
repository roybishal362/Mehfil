/**
 * Resilient access to the AI provider.
 *
 * For every call: answer from cache when possible, otherwise try the requested model and then the
 * other model. Each model has a circuit breaker and a requests-per-minute budget so a struggling
 * or rate-limited model is skipped instantly. Transient failures get one jittered retry. The
 * whole call has one deadline, so users never wait on a chain of timeouts.
 */
import type { Logger } from '../logger';
import { CircuitBreaker } from '../lib/circuit-breaker';
import { TtlCache, hashKey } from '../lib/cache';
import { RequestsPerMinuteGuard } from '../lib/rpm-guard';
import {
  AiError,
  type AiProvider,
  type AiResult,
  type GenerationSettings,
  type JsonRequest,
  type ToolRequest,
  type ToolResponse,
} from './provider';

/** Bump when prompts change so cached answers from older prompts are not reused. */
const PROMPT_VERSION = 'v2';

export interface AiOutcome<T> {
  data: T;
  model: string;
  cached: boolean;
  ms: number;
}

export interface AiGatewayOptions {
  provider: AiProvider;
  models: { smart: string; fast: string };
  maxRequestsPerMinute: number;
  logger: Logger;
  cacheTtlMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Errors that say "this model is not healthy right now" (not "this request is bad"). */
const HEALTH_FAILURES = new Set(['rate_limited', 'timeout', 'unavailable']);

/** Below this, an attempt cannot finish in time, so the call fails fast instead. */
const MIN_ATTEMPT_MS = 1500;

/** Runs the request on one model within a time limit. */
type Runner<R> = (model: string, timeoutMs: number) => Promise<AiResult<R>>;

/** One model's turn in the fallback chain. */
interface ModelTurn {
  request: GenerationSettings;
  model: string;
  /** True for the second model in the chain. */
  fallback: boolean;
  /** When the whole call must be done, on the gateway's clock. */
  deadline: number;
  /** The failure so far, kept as the cause if time runs out. */
  lastError: AiError;
}

type TurnOutcome<R> = { result: AiResult<R> } | { error: AiError };

/** Rate limits, rejected requests, a circuit that just opened or a second failure: next model. */
function moveToNextModel(error: AiError, breaker: CircuitBreaker, attempt: number): boolean {
  return (
    error.kind === 'rate_limited' ||
    error.kind === 'bad_request' ||
    breaker.state === 'open' ||
    attempt === 1
  );
}

export class AiGateway {
  readonly mode: 'gemini' | 'mock';
  readonly models: { smart: string; fast: string };
  private readonly provider: AiProvider;
  private readonly maxRpm: number;
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly cache: TtlCache<AiResult<unknown>>;
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly guards = new Map<string, RequestsPerMinuteGuard>();

  constructor(options: AiGatewayOptions) {
    this.provider = options.provider;
    this.mode = options.provider.name;
    this.models = options.models;
    this.maxRpm = options.maxRequestsPerMinute;
    this.logger = options.logger;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? realSleep;
    this.random = options.random ?? Math.random;
    this.cache = new TtlCache({
      maxEntries: 300,
      ttlMs: options.cacheTtlMs ?? 30 * 60_000,
      now: this.now,
    });
  }

  /** Structured JSON generation with caching. */
  async json<T>(request: JsonRequest<T>, budgetMs: number): Promise<AiOutcome<T>> {
    const started = this.now();
    const key = await hashKey({
      version: PROMPT_VERSION,
      task: request.task,
      model: request.model,
      system: request.system,
      prompt: request.prompt,
    });
    const { value, cached } = await this.cache.getOrLoad(key, () =>
      this.withFallback(request, budgetMs, (model, timeoutMs) =>
        this.provider.generateJson({ ...request, model, timeoutMs }),
      ),
    );
    const ms = this.now() - started;
    if (cached) this.logger.info('ai.call', { task: request.task, model: value.model, cached, ms });
    // The cache stores results for any T; this call's schema produced the stored value.
    return { data: value.data as T, model: value.model, cached, ms };
  }

  /** Function-calling generation (Copilot). Conversations are not cached. */
  async tools(request: ToolRequest, budgetMs: number): Promise<AiOutcome<ToolResponse>> {
    const started = this.now();
    const result = await this.withFallback(request, budgetMs, (model, timeoutMs) =>
      this.provider.generateWithTools({ ...request, model, timeoutMs }),
    );
    return { data: result.data, model: result.model, cached: false, ms: this.now() - started };
  }

  private breaker(model: string): CircuitBreaker {
    let breaker = this.breakers.get(model);
    if (!breaker) {
      breaker = new CircuitBreaker({ now: this.now });
      this.breakers.set(model, breaker);
    }
    return breaker;
  }

  private guard(model: string): RequestsPerMinuteGuard {
    let guard = this.guards.get(model);
    if (!guard) {
      guard = new RequestsPerMinuteGuard(this.maxRpm, this.now);
      this.guards.set(model, guard);
    }
    return guard;
  }

  /** Tries the requested model, then the other one, within one overall deadline. */
  private async withFallback<R>(
    request: GenerationSettings,
    budgetMs: number,
    run: Runner<R>,
  ): Promise<AiResult<R>> {
    const deadline = this.now() + budgetMs;
    let lastError = new AiError('unavailable', 'No model is available right now');
    for (const [index, model] of this.fallbackChain(request.model).entries()) {
      const turn: ModelTurn = { request, model, fallback: index > 0, deadline, lastError };
      const outcome = await this.tryModel(turn, run);
      if ('result' in outcome) return outcome.result;
      lastError = outcome.error;
    }
    throw lastError;
  }

  private fallbackChain(model: string): string[] {
    const other = model === this.models.smart ? this.models.fast : this.models.smart;
    return other === model ? [model] : [model, other];
  }

  /** A model whose circuit is open, or whose budget for the minute is spent, is skipped. */
  private async tryModel<R>(turn: ModelTurn, run: Runner<R>): Promise<TurnOutcome<R>> {
    const breaker = this.breaker(turn.model);
    // In half-open state this request is the one trial call that decides the model's health.
    const trial = breaker.state === 'half_open';
    if (!breaker.canRequest()) {
      const message = `${turn.model} is temporarily paused after repeated failures`;
      return { error: new AiError('unavailable', message) };
    }
    try {
      if (!this.guard(turn.model).tryAcquire()) {
        const message = `${turn.model} request budget for this minute is used up`;
        return { error: new AiError('rate_limited', message) };
      }
      return await this.attempts(turn, breaker, run);
    } finally {
      // A trial that ended without a verdict (cancelled, unusable output, out of time) must not
      // keep the model locked out; the next request may try again.
      if (trial) breaker.release();
    }
  }

  /** Up to two attempts on one model, with a short jittered pause between them. */
  private async attempts<R>(
    turn: ModelTurn,
    breaker: CircuitBreaker,
    run: Runner<R>,
  ): Promise<TurnOutcome<R>> {
    let lastError = turn.lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeoutMs = Math.min(turn.request.timeoutMs, turn.deadline - this.now());
      if (timeoutMs < MIN_ATTEMPT_MS) {
        throw new AiError('timeout', 'The AI took too long to answer', { cause: lastError });
      }
      const started = this.now();
      try {
        const result = await run(turn.model, timeoutMs);
        breaker.recordSuccess();
        this.logSuccess(turn, result, { attempt, ms: this.now() - started });
        return { result };
      } catch (error) {
        lastError = this.recordFailure(turn, breaker, error, attempt);
        if (moveToNextModel(lastError, breaker, attempt)) break;
        await this.sleep(250 + Math.floor(this.random() * 500));
      }
    }
    return { error: lastError };
  }

  /** Notes a failed attempt and returns it; throws when no retry or other model can help. */
  private recordFailure(
    turn: ModelTurn,
    breaker: CircuitBreaker,
    error: unknown,
    attempt: number,
  ): AiError {
    const aiError =
      error instanceof AiError
        ? error
        : new AiError('unavailable', 'Unexpected AI failure', { cause: error });
    if (aiError.kind === 'aborted') throw aiError;
    if (HEALTH_FAILURES.has(aiError.kind)) breaker.recordFailure();
    const { task } = turn.request;
    this.logger.warn('ai.call_failed', { task, model: turn.model, attempt, kind: aiError.kind });
    // Auth problems and safety blocks will not improve on another try or model.
    if (aiError.kind === 'auth' || aiError.kind === 'blocked') throw aiError;
    return aiError;
  }

  private logSuccess(
    turn: ModelTurn,
    result: AiResult<unknown>,
    timing: { attempt: number; ms: number },
  ): void {
    this.logger.info('ai.call', {
      task: turn.request.task,
      model: result.model,
      fallback: turn.fallback,
      ...timing,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtTokens: result.usage.thoughtTokens,
    });
  }
}
