/**
 * Outbound request budget: at most `limit` calls per rolling minute (per model). Staying under
 * Gemini's free-tier limits avoids piling up 429 errors; when the budget is spent, callers fail
 * fast and fall back to another model or the template plan.
 */
export class RequestsPerMinuteGuard {
  private readonly calls: number[] = [];
  private readonly limit: number;
  private readonly now: () => number;

  constructor(limit: number, now: () => number = Date.now) {
    this.limit = limit;
    this.now = now;
  }

  /** Records a call and returns true when it fits in the budget; returns false otherwise. */
  tryAcquire(): boolean {
    const now = this.now();
    const cutoff = now - 60_000;
    let expired = 0;
    for (const time of this.calls) {
      if (time > cutoff) break;
      expired += 1;
    }
    this.calls.splice(0, expired);
    if (this.calls.length >= this.limit) return false;
    this.calls.push(now);
    return true;
  }
}
