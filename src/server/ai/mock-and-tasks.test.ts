import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  BriefExtraction,
  BudgetSectionData,
  CopilotRequest,
  IdeasSectionData,
  InvitationDraft,
  TimelineSectionData,
  VendorsSectionData,
} from '../../shared/schemas/ai';
import { weddingBrief, weddingBriefInput } from '../../shared/test/fixtures';
import { silentLogger } from '../logger';
import { AiGateway } from './gateway';
import { MockProvider } from './mock-provider';
import { AiError, type AiProvider, type AiTask } from './provider';
import {
  copilotTurns,
  draftInvitation,
  extractBrief,
  generateSection,
  runCopilot,
  toOperation,
  validExtractedFields,
} from './tasks';

const TODAY = '2026-10-23';
const gateway = () =>
  new AiGateway({
    provider: new MockProvider(),
    models: { smart: 'smart', fast: 'fast' },
    maxRequestsPerMinute: 100,
    logger: silentLogger,
  });

const copilotRequest = (message: string) =>
  CopilotRequest.parse({
    brief: weddingBriefInput,
    today: TODAY,
    plan: {
      budget: {
        total: 1_800_000,
        lines: [
          { id: 'line_1', name: 'Catering', planned: 560_000, spent: 0, perGuest: true },
          { id: 'line_2', name: 'Decor', planned: 210_000, spent: 0, perGuest: false },
        ],
      },
      tasks: [
        {
          id: 'task_1',
          title: 'Book the venue',
          dueDate: '2026-11-01',
          priority: 'high',
          status: 'todo',
        },
      ],
      vendors: [{ id: 'vendor_1', name: 'Venue', status: 'researching', bookBy: '2026-11-01' }],
    },
    message,
  });

describe('MockProvider', () => {
  const settings = {
    model: 'm',
    system: 's',
    prompt: 'p',
    temperature: 0,
    maxOutputTokens: 1,
    thinking: 'low' as const,
    timeoutMs: 1000,
  };

  const sections: [AiTask, ZodType][] = [
    ['section.budget', BudgetSectionData],
    ['section.timeline', TimelineSectionData],
    ['section.vendors', VendorsSectionData],
    ['section.ideas', IdeasSectionData],
  ];

  it.each(sections)('returns schema-valid %s data for every event type', async (task, schema) => {
    for (const type of ['wedding', 'birthday', 'community', 'other'] as const) {
      const brief = weddingBrief({
        type,
        venueType: type === 'community' ? 'outdoor' : 'banquet_hall',
        date: '2026-12-01',
      });
      const result = await new MockProvider().generateJson({
        ...settings,
        task,
        schema,
        input: { brief, today: TODAY },
      });
      expect(schema.safeParse(result.data).success).toBe(true);
    }
  });

  it('extracts a brief and asks about what is missing', async () => {
    const result = await new MockProvider().generateJson({
      ...settings,
      task: 'brief',
      schema: BriefExtraction,
      input: { text: 'A birthday party for my daughter', today: TODAY, uiLanguage: 'hi' },
    });
    expect(result.data.brief).toMatchObject({ type: 'birthday', language: 'hi' });
    expect(result.data.missing).toEqual(['date', 'city', 'guestCount', 'budget']);
    expect(result.data.question).toMatch(/When/);
  });

  it('drafts invitations', async () => {
    const result = await new MockProvider().generateJson({
      ...settings,
      task: 'invitation',
      schema: InvitationDraft,
      input: {
        brief: weddingBriefInput,
        tone: 'warm',
        channel: 'whatsapp',
        language: 'en',
        hosts: 'The Sen family',
        venueName: 'Taj Bengal',
      },
    });
    expect(result.data.variants[0]?.text).toContain('Taj Bengal');
  });

  it('understands common Copilot requests', async () => {
    const provider = new MockProvider();
    const tools = { ...settings, task: 'copilot' as const, contents: [], tools: [] };
    const more = await provider.generateWithTools({
      ...tools,
      input: copilotRequest('We now expect 50 more guests'),
    });
    expect(more.data.calls[0]).toEqual({
      name: 'set_guest_count',
      args: { guestCount: 350, keepBudget: true },
    });
    const cut = await provider.generateWithTools({
      ...tools,
      input: copilotRequest('Cut ₹1 lakh without touching food'),
    });
    expect(cut.data.calls[0]).toEqual({
      name: 'set_budget_total',
      args: { total: 1_700_000, protectLineIds: ['line_1'] },
    });
    const add = await provider.generateWithTools({
      ...tools,
      input: copilotRequest('add a task: book the shehnai players'),
    });
    expect(add.data.calls[0]?.name).toBe('add_task');
    expect(add.data.text).toBe('');
    const week = await provider.generateWithTools({
      ...tools,
      input: copilotRequest('What should I do this week?'),
    });
    expect(week.data).toEqual({ text: 'This week, focus on: Book the venue.', calls: [] });
  });

  it('rejects malformed input and honours cancellation', async () => {
    await expect(
      new MockProvider().generateJson({
        ...settings,
        task: 'section.budget',
        schema: BudgetSectionData,
        input: {},
      }),
    ).rejects.toThrow();
    const controller = new AbortController();
    const pending = new MockProvider(5000).generateJson({
      ...settings,
      task: 'section.budget',
      schema: BudgetSectionData,
      input: { brief: weddingBrief(), today: TODAY },
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(AiError);
  });
});

describe('extractBrief', () => {
  it('validates each extracted field on its own', () => {
    expect(
      validExtractedFields(
        {
          type: 'wedding',
          date: '2026-01-01',
          endDate: '2026-01-02',
          city: '  Pune ',
          guestCount: 99_999,
          title: '',
        },
        TODAY,
      ),
    ).toEqual({ type: 'wedding', city: 'Pune' });
  });

  it('returns the validated brief with metadata', async () => {
    const { response, meta } = await extractBrief(gateway(), {
      text: 'Wedding in Kolkata on 14 Feb 2027 for 300 guests, budget ₹18 lakh',
      today: TODAY,
      uiLanguage: 'en',
    });
    expect(response.brief).toMatchObject({
      type: 'wedding',
      city: 'Kolkata',
      date: '2027-02-14',
      guestCount: 300,
      budget: 1_800_000,
    });
    expect(response.missing).toEqual([]);
    expect(response.question).toBeUndefined();
    expect(meta).toMatchObject({ mode: 'mock', cached: false });
  });
});

describe('generateSection', () => {
  it('produces cleaned section data and uses the cache on repeat', async () => {
    const shared = gateway();
    const first = await generateSection(shared, {
      section: 'ideas',
      brief: weddingBrief(),
      today: TODAY,
    });
    expect(first.result.section).toBe('ideas');
    expect(IdeasSectionData.safeParse(first.result.data).success).toBe(true);
    const second = await generateSection(shared, {
      section: 'ideas',
      brief: weddingBrief(),
      today: TODAY,
    });
    expect(second.meta.cached).toBe(true);
    const refined = await generateSection(shared, {
      section: 'budget',
      brief: weddingBrief(),
      today: TODAY,
      instruction: 'more budget-friendly',
      existing: ['Venue'],
    });
    expect(refined.result.section).toBe('budget');
  });
});

describe('draftInvitation', () => {
  it('returns cleaned variants', async () => {
    const { variants } = await draftInvitation(gateway(), {
      brief: weddingBrief(),
      tone: 'formal',
      channel: 'card',
      language: 'en',
      hosts: 'The Sen family',
    });
    expect(variants.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Copilot tool calls → plan operations', () => {
  const request = copilotRequest('hi');

  it.each([
    [
      { name: 'add_task', args: { title: 'Book shehnai', dueDate: '2026-12-01', priority: 'low' } },
      'task.add',
    ],
    [
      { name: 'update_task', args: { taskId: 'task_1', status: 'done', dueDate: '2026-11-05' } },
      'task.update',
    ],
    [{ name: 'remove_task', args: { taskId: 'task_1' } }, 'task.remove'],
    [
      { name: 'set_budget_line', args: { lineId: 'line_2', planned: 150_000 } },
      'budget.updateLine',
    ],
    [{ name: 'add_budget_line', args: { label: 'Dhaki', planned: 20_000 } }, 'budget.addLine'],
    [
      {
        name: 'set_budget_total',
        args: { total: 1_700_000, protectLineIds: ['line_1', 'line_999'] },
      },
      'budget.setTotal',
    ],
    [{ name: 'set_guest_count', args: { guestCount: 350, keepBudget: true } }, 'guests.setCount'],
    [{ name: 'update_vendor', args: { vendorId: 'vendor_1', status: 'booked' } }, 'vendor.update'],
    [
      { name: 'add_idea', args: { kind: 'food', title: 'Mishti doi', description: 'Clay pots' } },
      'idea.add',
    ],
    [
      {
        name: 'add_schedule_item',
        args: { dayOffset: -1, time: '16:00', durationMinutes: 90, title: 'Gaye Holud' },
      },
      'schedule.add',
    ],
  ])('maps %o', (call, type) => {
    const op = toOperation(call, request);
    expect(op?.type).toBe(type);
    if (op?.type === 'budget.setTotal') expect(op.protectIds).toEqual(['line_1']);
    if (op?.type === 'schedule.add') expect(op.item.day).toBe('2027-02-13');
  });

  it.each([
    { name: 'drop_database', args: {} },
    { name: 'add_task', args: { title: 'Too late', dueDate: '2030-01-01', priority: 'low' } },
    { name: 'add_task', args: { title: 'In the past', dueDate: '2026-01-01', priority: 'low' } },
    { name: 'update_task', args: { taskId: 'task_404', status: 'done' } },
    { name: 'update_task', args: { taskId: 'task_1', dueDate: '1999-01-01' } },
    { name: 'remove_task', args: { taskId: 'nope' } },
    { name: 'set_budget_line', args: { lineId: 'line_404', planned: 1 } },
    { name: 'update_vendor', args: { vendorId: 'vendor_404' } },
    { name: 'update_vendor', args: { vendorId: 'vendor_1', bookBy: '1999-01-01' } },
    { name: 'add_task', args: { title: 42 } },
    {
      name: 'add_schedule_item',
      args: { dayOffset: 0, time: '7pm', durationMinutes: 30, title: 'x' },
    },
  ])('drops invalid or unsafe call %o', (call) => {
    expect(toOperation(call, request)).toBeNull();
  });

  it('drops unusable proposals and replays the conversation in order', async () => {
    const seen: string[] = [];
    const provider: AiProvider = {
      name: 'gemini',
      generateJson: () => Promise.reject(new AiError('unavailable', 'unused')),
      generateWithTools: (request) => {
        seen.push(...request.contents.map((turn) => turn.role));
        return Promise.resolve({
          data: {
            text: 'Done. Call me on 98765 43210.',
            calls: [
              { name: 'drop_database', args: {} },
              { name: 'remove_task', args: { taskId: 'task_1' } },
            ],
          },
          model: request.model,
          usage: {},
        });
      },
    };
    const custom = new AiGateway({
      provider,
      models: { smart: 'smart', fast: 'fast' },
      maxRequestsPerMinute: 100,
      logger: silentLogger,
    });
    const { response } = await runCopilot(custom, {
      ...copilotRequest('Tidy up'),
      history: [
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Hello! How can I help?' },
      ],
    });
    expect(seen).toEqual(['user', 'model', 'user']);
    expect(response.operations).toEqual([{ type: 'task.remove', id: 'task_1' }]);
    expect(response.dropped).toBe(1);
    expect(response.reply).not.toContain('98765');
  });

  it('gives Gemini a conversation that starts with the user and alternates', () => {
    const turns = copilotTurns({
      ...copilotRequest('And the decor?'),
      history: [
        { role: 'assistant', text: 'Welcome!' },
        { role: 'user', text: 'Add 50 guests' },
        // The request for this question failed, so it has no answer.
        { role: 'user', text: 'Hello?' },
        { role: 'assistant', text: '(No change proposed.)' },
      ],
    });
    expect(turns.map((turn) => turn.role)).toEqual(['user', 'model', 'user']);
    expect(turns[0]?.text).toBe('Add 50 guests\n\nHello?');
    expect(turns[2]?.text).toContain('And the decor?');
  });

  it('runs the Copilot end to end and counts dropped proposals', async () => {
    const { response } = await runCopilot(
      gateway(),
      copilotRequest('We are now expecting 350 guests'),
    );
    expect(response.operations.map((o) => o.type)).toEqual(['guests.setCount', 'task.add']);
    expect(response.dropped).toBe(0);
    expect(response.reply).toMatch(/350 guests/);
  });
});
