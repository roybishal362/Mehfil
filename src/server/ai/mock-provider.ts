/**
 * Deterministic stand-in for Gemini. Used by tests, end-to-end runs and when no API key is set
 * (the UI then shows a "demo mode" note). Answers are validated with the same schemas as real
 * model output, so a fixture can never drift from the contract.
 */
import { z } from 'zod';
import { BriefRequest, CopilotRequest, InvitationRequest } from '../../shared/schemas/ai';
import { EventBrief } from '../../shared/schemas/brief';
import { IsoDate } from '../../shared/schemas/primitives';
import {
  mockBriefExtraction,
  mockBudgetSection,
  mockCopilot,
  mockIdeasSection,
  mockInvitation,
  mockTimelineSection,
  mockVendorsSection,
} from './mock-fixtures';
import {
  AiError,
  type AiProvider,
  type AiResult,
  type AiTask,
  type JsonRequest,
  type ToolRequest,
  type ToolResponse,
} from './provider';

const SectionInput = z.object({
  brief: EventBrief,
  today: IsoDate,
  instruction: z.string().optional(),
});

/** Relative latency per task, so demo mode streams sections in a natural order. */
const LATENCY_WEIGHT: Readonly<Record<AiTask, number>> = {
  brief: 0.6,
  'section.budget': 0.7,
  'section.timeline': 1,
  'section.vendors': 0.85,
  'section.ideas': 1.3,
  copilot: 0.9,
  invitation: 0.6,
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AiError('aborted', 'The request was cancelled'));
      },
      { once: true },
    );
  });
}

function fixtureFor(task: AiTask, input: unknown): unknown {
  switch (task) {
    case 'brief': {
      const { text, today, uiLanguage } = BriefRequest.parse(input);
      return mockBriefExtraction(text, today, uiLanguage);
    }
    case 'section.budget':
      return mockBudgetSection(SectionInput.parse(input).brief);
    case 'section.timeline': {
      const { brief, today } = SectionInput.parse(input);
      return mockTimelineSection(brief, today);
    }
    case 'section.vendors':
      return mockVendorsSection(SectionInput.parse(input).brief);
    case 'section.ideas': {
      const { brief, instruction } = SectionInput.parse(input);
      return mockIdeasSection(brief, instruction);
    }
    case 'invitation':
      return mockInvitation(InvitationRequest.parse(input));
    case 'copilot':
      return mockCopilot(CopilotRequest.parse(input));
  }
}

export class MockProvider implements AiProvider {
  readonly name = 'mock';
  private readonly delayMs: number;

  constructor(delayMs = 0) {
    this.delayMs = delayMs;
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<AiResult<T>> {
    await sleep(Math.round(this.delayMs * LATENCY_WEIGHT[request.task]), request.signal);
    const parsed = request.schema.safeParse(fixtureFor(request.task, request.input));
    if (!parsed.success) {
      throw new AiError(
        'invalid_output',
        `Mock fixture for ${request.task} does not match its schema`,
        {
          cause: parsed.error,
        },
      );
    }
    return { data: parsed.data, model: 'mock', usage: {} };
  }

  async generateWithTools(request: ToolRequest): Promise<AiResult<ToolResponse>> {
    await sleep(Math.round(this.delayMs * LATENCY_WEIGHT[request.task]), request.signal);
    const data = fixtureFor(request.task, request.input) as ToolResponse;
    return { data, model: 'mock', usage: {} };
  }
}
