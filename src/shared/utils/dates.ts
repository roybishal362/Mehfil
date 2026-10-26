/**
 * Date-only arithmetic on `YYYY-MM-DD` strings.
 * Everything runs in UTC on calendar dates, so time zones and daylight-saving shifts can never
 * move a due date. "Today" always comes from the caller (the browser's local date), never from
 * the server's clock.
 */

const DAY_MS = 86_400_000;

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

/** Adds (or subtracts) whole days. */
export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + Math.trunc(days) * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(to: string, from: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Earlier of two dates. */
export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Later of two dates. */
export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Clamps a date into the inclusive range [lo, hi]. */
export function clampDate(iso: string, lo: string, hi: string): string {
  return minDate(maxDate(iso, lo), hi);
}

/** The local calendar date of `now` in the runtime's time zone (use in the browser only). */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

/** Day of the week, 0 = Sunday. */
export function weekday(iso: string): number {
  return new Date(toUtcMs(iso)).getUTCDay();
}

/** Compact `YYYYMMDD` form used by iCalendar and Google Calendar links. */
export function compactDate(iso: string): string {
  return iso.replaceAll('-', '');
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A 24-hour `HH:MM` time, such as 07:30 or 19:00. */
export function isClockTime(value: string): boolean {
  return CLOCK.test(value);
}

/** Converts `HH:MM` to minutes after midnight. */
export function clockToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Converts minutes after midnight (wrapping past 24h) to `HH:MM`. */
export function minutesToClock(total: number): string {
  const wrapped = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const m = String(wrapped % 60).padStart(2, '0');
  return `${h}:${m}`;
}
