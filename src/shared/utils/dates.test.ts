import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  clampDate,
  clockToMinutes,
  compactDate,
  diffDays,
  isIsoDate,
  localToday,
  maxDate,
  minDate,
  minutesToClock,
  weekday,
} from './dates';

describe('isIsoDate', () => {
  it.each(['2026-01-31', '2028-02-29', '2027-12-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });
  it.each(['2027-02-29', '2026-13-01', '2026-00-10', '26-01-01', '2026-1-1', 'tomorrow', ''])(
    'rejects %s',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe('addDays / diffDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(diffDays('2027-02-14', '2026-10-23')).toBe(114);
  });

  it('is unaffected by daylight-saving transitions', () => {
    // 29 March 2026 is the EU DST switch; date-only maths must still give exactly one day.
    expect(diffDays('2026-03-30', '2026-03-29')).toBe(1);
  });

  it('round-trips for any offset (property)', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true }),
        fc.integer({ min: -2000, max: 2000 }),
        (date, offset) => {
          const iso = date.toISOString().slice(0, 10);
          const moved = addDays(iso, offset);
          expect(isIsoDate(moved)).toBe(true);
          expect(diffDays(moved, iso)).toBe(offset);
        },
      ),
    );
  });
});

describe('min/max/clamp', () => {
  it('orders ISO dates lexicographically', () => {
    expect(minDate('2026-05-01', '2026-04-30')).toBe('2026-04-30');
    expect(maxDate('2026-05-01', '2026-04-30')).toBe('2026-05-01');
    expect(clampDate('2026-01-01', '2026-02-01', '2026-03-01')).toBe('2026-02-01');
    expect(clampDate('2026-04-01', '2026-02-01', '2026-03-01')).toBe('2026-03-01');
    expect(clampDate('2026-02-15', '2026-02-01', '2026-03-01')).toBe('2026-02-15');
  });
});

describe('localToday', () => {
  it('uses the local calendar date, not UTC', () => {
    const lateEvening = new Date(2026, 9, 23, 23, 30); // local time
    expect(localToday(lateEvening)).toBe('2026-10-23');
  });
});

describe('formatting helpers', () => {
  it('computes weekday and compact dates', () => {
    expect(weekday('2027-02-14')).toBe(0); // a Sunday
    expect(compactDate('2027-02-14')).toBe('20270214');
  });

  it('converts between clock strings and minutes, wrapping at midnight', () => {
    expect(clockToMinutes('19:45')).toBe(1185);
    expect(minutesToClock(1185)).toBe('19:45');
    expect(minutesToClock(1440 + 30)).toBe('00:30');
    expect(minutesToClock(-30)).toBe('23:30');
  });
});
