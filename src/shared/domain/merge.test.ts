import { describe, expect, it } from 'vitest';
import type {
  BudgetSectionData,
  IdeasSectionData,
  TimelineSectionData,
  VendorsSectionData,
} from '../schemas/ai';
import { EventPlan } from '../schemas/plan';
import { NOW, TODAY, editIds, weddingPlan } from '../test/fixtures';
import { deepCleanStrings, markSectionFailed, mergeSection, type MergeContext } from './merge';

const ctx = (): MergeContext => ({
  today: TODAY,
  now: NOW,
  makeId: editIds(),
  model: 'gemini-test',
});

const budgetData: BudgetSectionData = {
  allocations: [
    {
      category: 'catering',
      percent: 58,
      rationale: 'Food matters most at a Bengali wedding; call +91 98765 43210 for quotes',
    },
    { category: 'venue', percent: 20, rationale: 'A banquet hall with step-free access' },
    { category: 'decor', percent: 12, rationale: 'Marigold and sholapith decor' },
  ],
  assessment: { level: 'comfortable', note: 'About ₹6,000 per guest is realistic for Kolkata.' },
  savingTips: [
    { tip: 'Use seasonal marigolds instead of imported flowers.', category: 'decor' },
    { tip: '   ' },
  ],
};

describe('mergeSection: budget', () => {
  it('bounds AI percentages, keeps the exact total and cleans the rationale', () => {
    const plan = mergeSection(weddingPlan(), { section: 'budget', data: budgetData }, ctx());
    const catering = plan.budget.lines.find((l) => l.category === 'catering')!;
    expect(plan.budget.lines.reduce((s, l) => s + l.planned, 0)).toBe(1_800_000);
    // 58% exceeds the wedding catering ceiling of 45%.
    expect(catering.planned).toBeLessThanOrEqual(1_800_000 * 0.45);
    expect(catering.rationale).not.toMatch(/98765/);
    expect(catering.source).toBe('ai');
    expect(plan.budget.savingTips).toHaveLength(1);
    expect(plan.budget.assessment?.level).toBe('comfortable');
    expect(plan.ai.sections.budget).toMatchObject({ status: 'ai', model: 'gemini-test' });
    expect(EventPlan.safeParse(plan).success).toBe(true);
  });

  it('never overwrites lines the user edited', () => {
    const base = weddingPlan();
    const venue = base.budget.lines.find((l) => l.category === 'venue')!;
    const edited = {
      ...base,
      budget: {
        ...base.budget,
        lines: base.budget.lines.map((l) =>
          l.id === venue.id ? { ...l, planned: 500_000, source: 'user' as const } : l,
        ),
      },
    };
    const plan = mergeSection(edited, { section: 'budget', data: budgetData }, ctx());
    expect(plan.budget.lines.find((l) => l.id === venue.id)?.planned).toBe(500_000);
    expect(plan.budget.lines.reduce((s, l) => s + l.planned, 0)).toBe(1_800_000);
  });

  it('drops an empty assessment note', () => {
    const plan = mergeSection(
      weddingPlan(),
      { section: 'budget', data: { ...budgetData, assessment: { level: 'tight', note: ' ' } } },
      ctx(),
    );
    expect(plan.budget.assessment).toBeUndefined();
  });
});

const timelineData: TimelineSectionData = {
  tasks: [
    {
      title: 'Book a dhaki for the baraat',
      daysBefore: 60,
      priority: 'medium',
      category: 'vendors',
      notes: 'Ask for a 2-hour slot',
    },
    { title: 'Book the venue', daysBefore: 300, priority: 'high', category: 'venue' },
    {
      title: 'Arrange ramps and an accessible washroom',
      daysBefore: 30,
      priority: 'high',
      category: 'logistics',
    },
  ],
  schedule: [
    {
      dayOffset: -1,
      time: '16:00',
      durationMinutes: 120,
      title: 'Gaye Holud at home',
      owner: 'Family',
    },
    { dayOffset: 0, time: '18:30', durationMinutes: 60, title: 'Baraat arrives' },
    { dayOffset: 0, time: '19:30', durationMinutes: 90, title: 'Saat paak and shubho drishti' },
    { dayOffset: 0, time: '7pm', durationMinutes: 30, title: 'Invalid time is dropped' },
  ],
  risks: [
    {
      title: 'February fog delays guests',
      likelihood: 'medium',
      mitigation: 'Share train and flight buffers with outstation guests.',
    },
  ],
};

describe('mergeSection: timeline', () => {
  it('adds new AI tasks, skips duplicates and schedules them with the engine', () => {
    const plan = mergeSection(weddingPlan(), { section: 'timeline', data: timelineData }, ctx());
    const aiTasks = plan.tasks.filter((t) => t.source === 'ai');
    expect(aiTasks.map((t) => t.title)).toEqual([
      'Book a dhaki for the baraat',
      'Arrange ramps and an accessible washroom',
    ]);
    expect(aiTasks.every((t) => t.dueDate >= TODAY)).toBe(true);
    expect(aiTasks[0]?.notes).toBe('Ask for a 2-hour slot');
  });

  it('replaces the run sheet, allowing the day before, and drops invalid times', () => {
    const plan = mergeSection(weddingPlan(), { section: 'timeline', data: timelineData }, ctx());
    expect(plan.schedule).toHaveLength(3);
    expect(plan.schedule[0]).toMatchObject({ day: '2027-02-13', time: '16:00', owner: 'Family' });
    expect(plan.risks).toHaveLength(1);
    expect(EventPlan.safeParse(plan).success).toBe(true);
  });

  it('keeps the template run sheet when the model returns too little', () => {
    const base = weddingPlan();
    const plan = mergeSection(
      base,
      { section: 'timeline', data: { ...timelineData, schedule: timelineData.schedule.slice(3) } },
      ctx(),
    );
    expect(plan.schedule).toEqual(base.schedule);
  });

  it('replaces earlier open AI tasks when regenerated', () => {
    const once = mergeSection(weddingPlan(), { section: 'timeline', data: timelineData }, ctx());
    const twice = mergeSection(once, { section: 'timeline', data: timelineData }, ctx());
    expect(twice.tasks.filter((t) => t.source === 'ai')).toHaveLength(2);
  });
});

const vendorsData: VendorsSectionData = {
  vendors: [
    {
      category: 'caterer',
      questions: [
        'Can you do a Jain menu?',
        'can you do a jain menu?',
        'Is service staff included?',
      ],
      redFlags: ['No tasting before booking'],
      tip: 'Book by November; email us at info@example.com',
    },
  ],
  extraCategories: [
    {
      label: 'Dhaki drummers',
      reason: 'Traditional for Bengali processions',
      priority: 'medium',
      daysBefore: 45,
    },
    {
      label: 'Caterer',
      reason: 'Duplicate of an existing vendor',
      priority: 'low',
      daysBefore: 30,
    },
  ],
};

describe('mergeSection: vendors', () => {
  it('adds questions and tips, removes contact details and duplicates', () => {
    const plan = mergeSection(weddingPlan(), { section: 'vendors', data: vendorsData }, ctx());
    const caterer = plan.vendors.find((v) => v.category === 'caterer')!;
    expect(caterer.questions).toEqual(['Can you do a Jain menu?', 'Is service staff included?']);
    expect(caterer.tip).toBe('Book by November; email us at');
    const extras = plan.vendors.filter((v) => v.source === 'ai');
    expect(extras.map((v) => v.label)).toEqual(['Dhaki drummers']);
    expect(EventPlan.safeParse(plan).success).toBe(true);
  });
});

const ideasData: IdeasSectionData = {
  summary: 'A warm two-evening celebration rooted in Bengali tradition.',
  themes: [
    {
      title: 'Shubho Alo',
      description: 'Brass diyas and marigold torans.',
      palette: ['#B91C1C', '#F59E0B', 'gold', '#FEF3C7'],
    },
    {
      title: 'Kantha Garden',
      description: 'Hand-stitched kantha textiles and greenery.',
      palette: ['#14532D', 'nope'],
    },
  ],
  ideas: [
    {
      kind: 'food',
      title: 'Mishti doi bar',
      description: 'Clay pots of mishti doi at the dessert counter.',
      costLevel: 'low',
    },
    {
      kind: 'personal',
      title: 'Grandparents’ blessing corner',
      description: 'A seated, step-free spot for elders.',
      costLevel: 'low',
    },
    {
      kind: 'decor',
      title: 'Alpana entrance',
      description: 'Rice-paste alpana designs at the entrance.',
      costLevel: 'low',
    },
    {
      kind: 'favor',
      title: 'Sandesh boxes',
      description: 'Small boxes of nolen gur sandesh.',
      costLevel: 'medium',
    },
    {
      kind: 'entertainment',
      title: 'Baul singers',
      description: 'Folk musicians during dinner.',
      costLevel: 'medium',
    },
    {
      kind: 'sustainability',
      title: 'Banana-leaf plates',
      description: 'Compostable plates for the feast.',
      costLevel: 'low',
    },
  ],
};

describe('mergeSection: ideas', () => {
  it('keeps favourites, validates palettes and sets the summary', () => {
    const base = weddingPlan();
    const withFavourite = {
      ...base,
      ideas: [
        {
          id: 'idea_fav',
          kind: 'decor' as const,
          title: 'Fairy lights canopy',
          description: 'Warm lights overhead.',
          favorite: true,
          source: 'ai' as const,
        },
      ],
    };
    const plan = mergeSection(withFavourite, { section: 'ideas', data: ideasData }, ctx());
    expect(plan.ideas[0]?.id).toBe('idea_fav');
    const themes = plan.ideas.filter((i) => i.kind === 'theme');
    expect(themes[0]?.palette).toEqual(['#B91C1C', '#F59E0B', '#FEF3C7']);
    expect(themes[1]?.palette).toBeUndefined();
    expect(plan.summary).toMatch(/Bengali tradition/);
    expect(EventPlan.safeParse(plan).success).toBe(true);
  });
});

describe('helpers', () => {
  it('cleans strings deep inside model output', () => {
    expect(deepCleanStrings({ a: [' x  y ', { b: 'call 9876543210 now' }], n: 3 })).toEqual({
      a: ['x y', { b: 'call now' }],
      n: 3,
    });
  });

  it('marks a failed section for retry', () => {
    expect(markSectionFailed(weddingPlan(), 'ideas').ai.sections.ideas.status).toBe('failed');
  });
});

describe('mergeSection: edge cases', () => {
  it('skips empty model text instead of storing blanks', () => {
    const vendors = mergeSection(
      weddingPlan(),
      {
        section: 'vendors',
        data: {
          vendors: [
            {
              category: 'photographer',
              questions: ['Do you shoot candids?'],
              redFlags: [],
              tip: '   ',
            },
          ],
          extraCategories: [
            { label: 'Shehnai players', reason: ' ', priority: 'low', daysBefore: 30 },
          ],
        },
      },
      ctx(),
    );
    expect(vendors.vendors.find((v) => v.category === 'photographer')?.tip).toBeUndefined();
    expect(vendors.vendors.at(-1)).toMatchObject({ label: 'Shehnai players' });
    expect(vendors.vendors.at(-1)?.tip).toBeUndefined();

    const ideas = mergeSection(
      weddingPlan(),
      {
        section: 'ideas',
        data: {
          summary: '  ',
          themes: [
            { title: ' ', description: 'No title', palette: ['#000000', '#111111', '#222222'] },
            {
              title: 'Kantha',
              description: 'Textiles',
              palette: ['#000000', '#111111', '#222222'],
            },
          ],
          ideas: [
            {
              kind: 'food',
              title: 'Kantha',
              description: 'Duplicate of the theme title',
              costLevel: 'low',
            },
            { kind: 'food', title: 'Phuchka stall', description: '', costLevel: 'low' },
            { kind: 'food', title: 'Mishti doi', description: 'Clay pots', costLevel: 'low' },
            { kind: 'decor', title: 'Alpana', description: 'Rice paste art', costLevel: 'low' },
            { kind: 'favor', title: 'Sandesh', description: 'Boxes', costLevel: 'low' },
            {
              kind: 'activity',
              title: 'Dhunuchi dance',
              description: 'Incense dance',
              costLevel: 'low',
            },
          ],
        },
      },
      ctx(),
    );
    expect(ideas.summary).toBeUndefined();
    expect(ideas.ideas.map((i) => i.title)).toEqual([
      'Kantha',
      'Mishti doi',
      'Alpana',
      'Sandesh',
      'Dhunuchi dance',
    ]);
  });

  it('keeps user run-sheet items, drops blank owners and replaces earlier AI vendors', () => {
    const base = weddingPlan();
    const withUserSlot = {
      ...base,
      schedule: [
        ...base.schedule,
        {
          id: 'slot_user',
          day: '2027-02-14',
          time: '12:00',
          durationMinutes: 30,
          title: 'Family lunch',
          source: 'user' as const,
        },
      ],
    };
    const plan = mergeSection(
      withUserSlot,
      {
        section: 'timeline',
        data: {
          ...timelineData,
          schedule: timelineData.schedule.map((s) => ({ ...s, owner: ' ' })),
        },
      },
      ctx(),
    );
    expect(plan.schedule.some((s) => s.id === 'slot_user')).toBe(true);
    expect(plan.schedule.every((s) => s.owner === undefined)).toBe(true);

    const once = mergeSection(base, { section: 'vendors', data: vendorsData }, ctx());
    const twice = mergeSection(once, { section: 'vendors', data: vendorsData }, ctx());
    expect(twice.vendors.filter((v) => v.source === 'ai')).toHaveLength(1);
  });
});
