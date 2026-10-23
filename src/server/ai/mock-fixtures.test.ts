/** The demo-mode fixtures must stay valid and react to the brief like a real model would. */
import { describe, expect, it } from 'vitest';
import {
  BriefExtraction,
  BudgetSectionData,
  CopilotRequest,
  IdeasSectionData,
  InvitationDraft,
  TimelineSectionData,
} from '../../shared/schemas/ai';
import { weddingBrief, weddingBriefInput } from '../../shared/test/fixtures';
import {
  mockBriefExtraction,
  mockBudgetSection,
  mockCopilot,
  mockIdeasSection,
  mockInvitation,
  mockTimelineSection,
} from './mock-fixtures';

const TODAY = '2026-10-23';

describe('mockBriefExtraction', () => {
  it('extracts what it can and asks about the rest', () => {
    const result = mockBriefExtraction(
      'Our anniversary dinner in Goa for 40 people, budget $5k, step-free for grandma in a wheelchair',
      TODAY,
      'bn',
    );
    expect(BriefExtraction.safeParse(result).success).toBe(true);
    expect(result.brief).toMatchObject({
      type: 'other',
      city: 'Goa',
      guestCount: 40,
      budget: 5000,
      currency: 'USD',
      title: 'Goa Celebration',
      language: 'bn',
    });
    expect(result.brief.accessibility).toMatch(/Step-free/);
    expect(result.missing).toEqual(['date']);
    expect(result.question).toBe('When is the celebration?');
  });

  it('needs no question when the description is complete', () => {
    const result = mockBriefExtraction(
      'Wedding in Kolkata on 14 Feb 2027 for 300 guests, budget ₹18 lakh',
      TODAY,
      'en',
    );
    expect(result.missing).toEqual([]);
    expect(result.question).toBeUndefined();
    expect(result.brief.currency).toBe('INR');
  });
});

describe('mockBudgetSection', () => {
  it.each([
    [1_800_000, 300, 'comfortable'],
    [1_000_000, 300, 'tight'],
    [400_000, 300, 'very_tight'],
  ] as const)('rates ₹%i for %i guests as %s', (budget, guestCount, level) => {
    const data = mockBudgetSection(weddingBrief({ budget, guestCount }));
    expect(BudgetSectionData.safeParse(data).success).toBe(true);
    expect(data.assessment.level).toBe(level);
  });

  it('judges other currencies on their own scale', () => {
    const data = mockBudgetSection(
      weddingBrief({ currency: 'USD', budget: 30_000, guestCount: 150 }),
    );
    expect(data.assessment.level).toBe('comfortable');
    expect(data.assessment.note).toContain('$200');
  });

  it('gives vegetarian menus a slightly smaller catering share', () => {
    const share = (dietary: ('vegetarian' | 'halal')[]) =>
      mockBudgetSection(weddingBrief({ dietary })).allocations.find(
        (line) => line.category === 'catering',
      )?.percent ?? 0;
    expect(share(['vegetarian'])).toBeLessThan(share(['halal']));
  });
});

describe('mockTimelineSection', () => {
  it('flags monsoon travel and short notice', () => {
    const data = mockTimelineSection(weddingBrief({ date: '2026-12-01' }), '2026-11-15');
    expect(TimelineSectionData.safeParse(data).success).toBe(true);
    expect(data.risks.map((risk) => risk.title)).toContain('Short notice limits vendor choice');
    const monsoon = mockTimelineSection(weddingBrief({ date: '2027-07-20' }), TODAY);
    expect(monsoon.risks.map((risk) => risk.title)).toContain('Monsoon rain disrupts travel');
  });

  it('adds pre-wedding ceremonies and accessibility checks when the brief mentions them', () => {
    const data = mockTimelineSection(
      weddingBrief({ traditions: 'Haldi and sangeet', accessibility: 'Wheelchair users' }),
      TODAY,
    );
    expect(data.schedule[0]).toMatchObject({
      dayOffset: -1,
      title: 'Pre-wedding ceremony with family',
    });
    expect(data.tasks.map((task) => task.title)).toContain(
      'Confirm ramps and an accessible washroom at the venue',
    );
    const plain = mockTimelineSection(
      weddingBrief({ traditions: '', accessibility: '', type: 'birthday' }),
      TODAY,
    );
    expect(plain.schedule.some((item) => item.dayOffset === -1)).toBe(false);
  });
});

describe('mockIdeasSection', () => {
  it('matches the menu to dietary needs', () => {
    const veg = mockIdeasSection(weddingBrief());
    const mixed = mockIdeasSection(weddingBrief({ dietary: [] }));
    expect(IdeasSectionData.safeParse(mixed).success).toBe(true);
    expect(veg.ideas[0]?.title).toBe('Regional vegetarian thali');
    expect(mixed.ideas[0]?.title).toBe('Regional speciality counter');
    expect(
      mockIdeasSection(weddingBrief({ type: 'community', venueType: 'outdoor' })).summary,
    ).toContain('community celebration');
  });
});

describe('mockInvitation', () => {
  it('uses the hosts, time and venue only when given', () => {
    const full = mockInvitation({
      brief: weddingBrief({ startTime: '19:00' }),
      tone: 'warm',
      channel: 'card',
      language: 'en',
      hosts: 'The Sen family',
      venueName: 'Taj Bengal',
    });
    expect(InvitationDraft.safeParse(full).success).toBe(true);
    expect(full.variants[0]?.text).toContain('The Sen family warmly invite you');
    expect(full.variants[0]?.text).toContain('2027-02-14 at 19:00 in Taj Bengal, Kolkata');
    const bare = mockInvitation({
      brief: weddingBrief(),
      tone: 'warm',
      channel: 'card',
      language: 'en',
    });
    expect(bare.variants[0]?.text).toMatch(/^warmly invite you to .* on 2027-02-14 in Kolkata\./);
  });
});

describe('mockCopilot', () => {
  const request = (message: string, done = false) =>
    CopilotRequest.parse({
      brief: weddingBriefInput,
      today: TODAY,
      plan: {
        budget: {
          total: 1_800_000,
          lines: [{ id: 'line_1', name: 'Catering', planned: 560_000, spent: 0, perGuest: true }],
        },
        tasks: [
          {
            id: 'task_1',
            title: 'Book the venue',
            dueDate: '2026-11-01',
            priority: 'high',
            status: done ? 'done' : 'todo',
          },
        ],
        vendors: [],
      },
      message,
    });

  it('reads amounts the way people write them', () => {
    const call = mockCopilot(request('Please reduce the budget by 2.5 lakh.')).calls[0];
    expect(call).toEqual({
      name: 'set_budget_total',
      args: { total: 1_550_000, protectLineIds: [] },
    });
    expect(mockCopilot(request('Save 50k')).calls[0]?.args).toMatchObject({ total: 1_750_000 });
  });

  it('adds tasks whatever the capitalisation', () => {
    expect(mockCopilot(request('Add a task: Book the dhaki')).calls[0]).toMatchObject({
      name: 'add_task',
      args: { title: 'Book the dhaki' },
    });
  });

  it('celebrates when everything is done', () => {
    expect(mockCopilot(request('What next?', true)).text).toBe(
      'Everything on your list is done. Enjoy the celebration!',
    );
  });
});
