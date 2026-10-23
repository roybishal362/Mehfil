import { describe, expect, it } from 'vitest';
import { ClockTime } from '../schemas/primitives';
import { ALL_TEMPLATES, getTemplate } from './index';
import { pickText } from './types';

describe.each(ALL_TEMPLATES.map((t) => [t.type, t] as const))('%s template', (_type, template) => {
  const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

  it('has budget weights that sum to 100 within feasible bounds', () => {
    expect(sum(template.budget.map((l) => l.weight))).toBe(100);
    expect(sum(template.budget.map((l) => l.min))).toBeLessThanOrEqual(100);
    expect(sum(template.budget.map((l) => l.max))).toBeGreaterThanOrEqual(100);
    for (const line of template.budget) {
      expect(line.weight).toBeGreaterThanOrEqual(line.min);
      expect(line.weight).toBeLessThanOrEqual(line.max);
    }
  });

  it('has unique budget categories, task keys and vendor categories', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(template.budget.map((l) => l.category))).toBe(true);
    expect(unique(template.tasks.map((t) => t.key))).toBe(true);
    expect(unique(template.vendors.map((v) => v.category))).toBe(true);
  });

  it('links every vendor to a budget line that exists', () => {
    const categories = new Set(template.budget.map((l) => l.category));
    for (const vendor of template.vendors) {
      expect(vendor.budgetCategory && categories.has(vendor.budgetCategory)).toBe(true);
    }
  });

  it('has exactly one schedule anchor and valid times', () => {
    expect(template.schedule.filter((s) => s.anchor)).toHaveLength(1);
    for (const slot of template.schedule) expect(ClockTime.safeParse(slot.time).success).toBe(true);
  });

  it('translates every task and schedule title into Hindi and Bengali', () => {
    for (const { title } of [...template.tasks, ...template.schedule]) {
      expect(title.hi).toMatch(/[ऀ-ॿ]/);
      expect(title.bn).toMatch(/[ঀ-৿]/);
      expect(title.en).toMatch(/^[A-Z]/);
    }
  });
});

describe('templates', () => {
  it('looks up templates by event type', () => {
    expect(getTemplate('birthday').type).toBe('birthday');
  });

  it('picks the plan language and falls back to English', () => {
    const text = { en: 'Book the venue', hi: 'वेन्यू बुक करें', bn: 'ভেন্যু বুক করুন' };
    expect(pickText(text, 'hi')).toBe(text.hi);
    expect(pickText(text, 'bn')).toBe(text.bn);
    expect(pickText(text, 'ta')).toBe(text.en);
  });
});
