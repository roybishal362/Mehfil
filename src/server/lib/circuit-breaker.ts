/**
 * Circuit breaker for an upstream dependency (one per Gemini model). After `failureThreshold`
 * consecutive failures it opens and rejects calls immediately for `openMs`, so users get the
 * fallback in milliseconds instead of waiting on a struggling service. Then one trial call is
 * allowed (half-open); success closes the circuit again.
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  openMs?: number;
  now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private trialInProgress = false;
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly now: () => number;

  constructor({
    failureThreshold = 3,
    openMs = 60_000,
    now = Date.now,
  }: CircuitBreakerOptions = {}) {
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
    this.now = now;
  }

  get state(): CircuitState {
    if (this.openedAt === null) return 'closed';
    return this.now() - this.openedAt >= this.openMs ? 'half_open' : 'open';
  }

  /** Whether a call may go ahead now. In half-open state only one trial call is allowed. */
  canRequest(): boolean {
    const state = this.state;
    if (state === 'closed') return true;
    if (state === 'open' || this.trialInProgress) return false;
    this.trialInProgress = true;
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
    this.trialInProgress = false;
  }

  /**
   * Ends a half-open trial that said nothing about the dependency's health (the call was
   * cancelled or rejected for its own reasons), so the next call may try again.
   */
  release(): void {
    this.trialInProgress = false;
  }

  recordFailure(): void {
    this.trialInProgress = false;
    this.failures += 1;
    if (this.openedAt !== null || this.failures >= this.failureThreshold) {
      this.openedAt = this.now();
    }
  }
}
