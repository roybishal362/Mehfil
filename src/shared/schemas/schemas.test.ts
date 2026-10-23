import { describe, expect, it } from 'vitest';
import { weddingBriefInput } from '../test/fixtures';
import {
  BriefExtraction,
  BudgetSectionData,
  CopilotRequest,
  IdeasSectionData,
  PersonalizeRequest,
  RefineRequest,
  TimelineSectionData,
  budgetSectionSchema,
  vendorsSectionSchema,
} from './ai';
import { EventBrief, PartialBrief, eventSpanProblem } from './brief';
import { PlanOperation } from './operations';
import { ClockTime, HexColor, Id, IsoDate } from './primitives';

describe('primitives', () => {
  it('validate dates, times, IDs and colours', () => {
    expect(IsoDate.safeParse('2027-02-29').success).toBe(false);
    expect(IsoDate.safeParse('2028-02-29').success).toBe(true);
    expect(ClockTime.safeParse('24:00').success).toBe(false);
    expect(ClockTime.safeParse('07:05').success).toBe(true);
    expect(Id.safeParse('task_1').success).toBe(true);
    expect(Id.safeParse('<script>').success).toBe(false);
    expect(HexColor.safeParse('#B91C1C').success).toBe(true);
    expect(HexColor.safeParse('red').success).toBe(false);
  });
});

describe('EventBrief', () => {
  it('fills sensible defaults', () => {
    const brief = EventBrief.parse({
      type: 'birthday',
      title: "Aarav's 7th",
      date: '2027-01-25',
      city: 'Pune',
      guestCount: 40,
      budget: 60_000,
    });
    expect(brief).toMatchObject({
      country: 'India',
      venueType: 'banquet_hall',
      currency: 'INR',
      styles: [],
      dietary: [],
      language: 'en',
    });
  });

  it('rejects end dates before the start or more than 14 days later', () => {
    expect(EventBrief.safeParse({ ...weddingBriefInput, endDate: '2027-02-13' }).success).toBe(
      false,
    );
    expect(EventBrief.safeParse({ ...weddingBriefInput, endDate: '2027-03-14' }).success).toBe(
      false,
    );
    expect(EventBrief.safeParse({ ...weddingBriefInput, endDate: '2027-02-17' }).success).toBe(
      true,
    );
    expect(eventSpanProblem('2027-02-14', undefined)).toBeNull();
  });

  it('rejects tiny budgets, huge guest counts and blank titles', () => {
    expect(EventBrief.safeParse({ ...weddingBriefInput, budget: 500 }).success).toBe(false);
    expect(EventBrief.safeParse({ ...weddingBriefInput, guestCount: 5001 }).success).toBe(false);
    expect(EventBrief.safeParse({ ...weddingBriefInput, title: '   ' }).success).toBe(false);
  });

  it('never invents values in partial updates', () => {
    expect(PartialBrief.parse({})).toEqual({});
  });
});

describe('AI output schemas', () => {
  it('restrict budget categories to those of the event template', () => {
    const schema = budgetSectionSchema(['venue', 'catering']);
    const data = {
      allocations: [{ category: 'decor', percent: 10, rationale: 'x' }],
      assessment: { level: 'tight', note: 'x' },
      savingTips: [],
    };
    expect(schema.safeParse(data).success).toBe(false);
    expect(BudgetSectionData.safeParse(data).success).toBe(true);
  });

  it('bound numbers the model must respect', () => {
    const tooBig = {
      allocations: [{ category: 'venue', percent: 95, rationale: 'x' }],
      assessment: { level: 'tight', note: 'x' },
      savingTips: [],
    };
    expect(BudgetSectionData.safeParse(tooBig).success).toBe(false);
    expect(TimelineSectionData.safeParse({ tasks: [], schedule: [], risks: [] }).success).toBe(
      false,
    );
  });

  it('accept a realistic ideas answer', () => {
    const idea = { kind: 'food', title: 't', description: 'd', costLevel: 'low' };
    expect(
      IdeasSectionData.safeParse({
        summary: 's',
        themes: [
          { title: 'a', description: 'b', palette: ['#000000', '#111111', '#222222'] },
          { title: 'c', description: 'd', palette: ['#333333', '#444444', '#555555'] },
        ],
        ideas: Array.from({ length: 6 }, () => idea),
      }).success,
    ).toBe(true);
    expect(
      vendorsSectionSchema(['caterer']).safeParse({ vendors: [], extraCategories: [] }).success,
    ).toBe(true);
  });

  it('parse partial brief extractions', () => {
    const parsed = BriefExtraction.parse({
      brief: { type: 'wedding', city: 'Kolkata' },
      missing: ['date'],
    });
    expect(parsed.brief.city).toBe('Kolkata');
  });
});

describe('API requests', () => {
  it('apply defaults and limits', () => {
    const personalize = PersonalizeRequest.parse({ brief: weddingBriefInput, today: '2026-10-23' });
    expect(personalize.sections).toEqual(['budget', 'timeline', 'vendors', 'ideas']);
    expect(
      RefineRequest.parse({
        section: 'ideas',
        brief: weddingBriefInput,
        today: '2026-10-23',
        instruction: 'more eco-friendly',
      }).existing,
    ).toEqual([]);
    const copilot = CopilotRequest.safeParse({
      brief: weddingBriefInput,
      today: '2026-10-23',
      plan: { budget: { total: 1, lines: [] }, tasks: [], vendors: [] },
      history: Array.from({ length: 9 }, () => ({ role: 'user', text: 'hi' })),
      message: 'hello',
    });
    expect(copilot.success).toBe(false);
  });

  it('validates plan operations strictly', () => {
    expect(PlanOperation.safeParse({ type: 'task.remove', id: 'task_1' }).success).toBe(true);
    expect(PlanOperation.safeParse({ type: 'task.remove' }).success).toBe(false);
    expect(PlanOperation.safeParse({ type: 'drop.database' }).success).toBe(false);
    expect(PlanOperation.safeParse({ type: 'brief.update', patch: { budget: 1 } }).data).toEqual({
      type: 'brief.update',
      patch: {},
    });
  });
});
