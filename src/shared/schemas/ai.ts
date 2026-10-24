/**
 * Contracts for everything Gemini produces and for the AI gateway's HTTP API.
 *
 * Model-output schemas are deliberately shallow. Gemini enforces enums, numeric ranges and array
 * sizes, but not string lengths, so strings are left unbounded here and trimmed by the server
 * (`cleanModelText`) instead of failing a whole answer because one sentence ran long.
 * Dates never appear in model output: the model gives day offsets and the engine computes dates.
 */
import * as z from '../zod';
import { EventBrief, PartialBrief } from './brief';
import {
  BUDGET_CATEGORIES,
  VENDOR_CATEGORIES,
  type BudgetCategory,
  type VendorCategory,
} from './categories';
import { PlanOperation } from './operations';
import {
  AiSection,
  CostLevel,
  EventType,
  IdeaKind,
  IsoDate,
  Likelihood,
  OutputLanguage,
  Priority,
  TaskCategory,
  TaskStatus,
  VendorStatus,
  requiredText,
} from './primitives';

type NonEmpty<T> = readonly [T, ...T[]];

// ------------------------------------------------------------------------------------------
// Model output: plan sections
// ------------------------------------------------------------------------------------------

export function budgetSectionSchema(categories: NonEmpty<BudgetCategory>) {
  const category = z.enum(categories as unknown as [BudgetCategory, ...BudgetCategory[]]);
  return z.object({
    allocations: z
      .array(
        z.object({
          category: category.describe('Budget category key from the allowed list'),
          percent: z.number().min(0).max(60).describe('Share of the total budget, in percent'),
          rationale: z.string().describe('One short sentence (max 20 words) explaining the share'),
        }),
      )
      .min(1)
      .max(categories.length),
    assessment: z.object({
      level: z.enum(['comfortable', 'tight', 'very_tight']),
      note: z.string().describe('One or two sentences (max 40 words) on budget feasibility'),
    }),
    savingTips: z
      .array(
        z.object({
          tip: z.string().describe('A practical saving idea (max 30 words)'),
          category: category.optional(),
        }),
      )
      .max(5),
  });
}
/** Budget section data with the full category enum (what the client receives and merges). */
export const BudgetSectionData = budgetSectionSchema(BUDGET_CATEGORIES);
export type BudgetSectionData = z.infer<typeof BudgetSectionData>;

export const TimelineSectionData = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().describe('Imperative task title (max 10 words)'),
        notes: z.string().optional().describe('Why or how, max 25 words'),
        daysBefore: z
          .number()
          .int()
          .min(-30)
          .max(400)
          .describe('How many days before the event to finish it; negative means after the event'),
        priority: Priority,
        category: TaskCategory,
      }),
    )
    .max(10),
  schedule: z
    .array(
      z.object({
        dayOffset: z
          .number()
          .int()
          .min(-1)
          .max(14)
          .describe('0 is the first event day, -1 the day before'),
        time: z.string().describe('Start time in 24-hour HH:MM'),
        durationMinutes: z.number().int().min(5).max(600),
        title: z.string().describe('What happens (max 8 words)'),
        owner: z.string().optional().describe('Who is responsible (max 4 words)'),
      }),
    )
    .min(3)
    .max(16),
  risks: z
    .array(
      z.object({
        title: z.string().describe('The risk (max 10 words)'),
        likelihood: Likelihood,
        mitigation: z.string().describe('How to reduce it (max 30 words)'),
      }),
    )
    .max(5),
});
export type TimelineSectionData = z.infer<typeof TimelineSectionData>;

export function vendorsSectionSchema(categories: NonEmpty<VendorCategory>) {
  const category = z.enum(categories as unknown as [VendorCategory, ...VendorCategory[]]);
  return z.object({
    vendors: z
      .array(
        z.object({
          category: category.describe('Vendor category key from the allowed list'),
          questions: z
            .array(z.string().describe('A question to ask this vendor (max 20 words)'))
            .min(1)
            .max(5),
          redFlags: z.array(z.string().describe('A warning sign (max 15 words)')).max(3),
          tip: z
            .string()
            .describe('One booking tip (max 30 words); never a vendor name or contact'),
        }),
      )
      .max(categories.length),
    extraCategories: z
      .array(
        z.object({
          label: z
            .string()
            .describe('A vendor type this event needs that is not in the list (max 4 words)'),
          reason: z.string().describe('Why (max 20 words)'),
          priority: Priority,
          daysBefore: z.number().int().min(1).max(365),
        }),
      )
      .max(3),
  });
}
export const VendorsSectionData = vendorsSectionSchema(VENDOR_CATEGORIES);
export type VendorsSectionData = z.infer<typeof VendorsSectionData>;

export const IdeasSectionData = z.object({
  summary: z
    .string()
    .describe('Two or three warm sentences describing the celebration plan (max 70 words)'),
  themes: z
    .array(
      z.object({
        title: z.string().describe('Evocative theme name (max 6 words)'),
        description: z.string().describe('Decor, mood and signature moment (max 45 words)'),
        palette: z.array(z.string().describe('A #RRGGBB colour')).min(3).max(5),
      }),
    )
    .min(2)
    .max(3),
  ideas: z
    .array(
      z.object({
        kind: z.enum(IdeaKind.options.filter((k) => k !== 'theme') as [IdeaKind, ...IdeaKind[]]),
        title: z.string().describe('Short idea title (max 8 words)'),
        description: z.string().describe('Concrete, specific suggestion (max 40 words)'),
        costLevel: CostLevel,
      }),
    )
    .min(6)
    .max(14),
});
export type IdeasSectionData = z.infer<typeof IdeasSectionData>;

export type SectionData =
  | { section: 'budget'; data: BudgetSectionData }
  | { section: 'timeline'; data: TimelineSectionData }
  | { section: 'vendors'; data: VendorsSectionData }
  | { section: 'ideas'; data: IdeasSectionData };

export const SECTION_DATA_SCHEMAS = {
  budget: BudgetSectionData,
  timeline: TimelineSectionData,
  vendors: VendorsSectionData,
  ideas: IdeasSectionData,
} as const;

// ------------------------------------------------------------------------------------------
// Model output: brief extraction and invitations
// ------------------------------------------------------------------------------------------

export const BRIEF_KEY_FIELDS = ['type', 'date', 'city', 'guestCount', 'budget'] as const;

export const BriefExtraction = z.object({
  brief: z
    .object({
      type: EventType,
      subtype: z.string().describe('e.g. "Bengali Hindu wedding" or "7th birthday" (max 6 words)'),
      title: z.string().describe('A short celebratory title (max 8 words)'),
      date: z.string().describe('First event day as YYYY-MM-DD, resolved against today'),
      endDate: z.string().describe('Last day as YYYY-MM-DD for multi-day events'),
      startTime: z.string().describe('Start time as 24-hour HH:MM'),
      city: z.string(),
      venueType: z.enum([
        'banquet_hall',
        'hotel',
        'outdoor',
        'home',
        'community_hall',
        'restaurant',
        'religious_venue',
        'destination',
        'other',
      ]),
      guestCount: z.number().int().min(1).max(5000),
      budget: z
        .number()
        .int()
        .min(0)
        .describe('Total budget in whole currency units (18 lakh = 1800000)'),
      currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD']),
      styles: z.array(z.string()).max(6),
      traditions: z.string(),
      dietary: z.array(
        z.enum([
          'vegetarian',
          'vegan',
          'jain',
          'halal',
          'no_onion_garlic',
          'gluten_free',
          'nut_free',
          'non_vegetarian',
        ]),
      ),
      accessibility: z.string(),
      mustHaves: z.string(),
      avoid: z.string(),
      language: OutputLanguage,
    })
    .partial(),
  missing: z.array(z.enum(BRIEF_KEY_FIELDS)).describe('Key details the description did not give'),
  question: z
    .string()
    .optional()
    .describe('One friendly question asking for the most important missing detail'),
});
export type BriefExtraction = z.infer<typeof BriefExtraction>;

export const INVITATION_TONES = ['warm', 'formal', 'playful', 'traditional'] as const;
export const INVITATION_CHANNELS = ['whatsapp', 'email', 'card', 'social'] as const;

export const InvitationDraft = z.object({
  variants: z
    .array(
      z.object({
        label: z.string().describe('2-4 word name for this version'),
        text: z.string().describe('The invitation text, ready to send'),
      }),
    )
    .min(2)
    .max(3),
});
export type InvitationDraft = z.infer<typeof InvitationDraft>;

// ------------------------------------------------------------------------------------------
// AI gateway API: requests and responses
// ------------------------------------------------------------------------------------------

export const UiLanguage = z.enum(['en', 'hi', 'bn']);
export type UiLanguage = z.infer<typeof UiLanguage>;

export const BriefRequest = z.object({
  text: requiredText(1500),
  today: IsoDate,
  uiLanguage: UiLanguage.default('en'),
});
export type BriefRequest = z.infer<typeof BriefRequest>;

export const BriefResponse = z.object({
  brief: PartialBrief,
  missing: z.array(z.enum(BRIEF_KEY_FIELDS)),
  question: z.string().optional(),
});
export type BriefResponse = z.infer<typeof BriefResponse>;

export const PersonalizeRequest = z.object({
  brief: EventBrief,
  today: IsoDate,
  sections: z.array(AiSection).min(1).max(4).default(['budget', 'timeline', 'vendors', 'ideas']),
});
export type PersonalizeRequest = z.infer<typeof PersonalizeRequest>;

export const RefineRequest = z.object({
  section: AiSection,
  brief: EventBrief,
  today: IsoDate,
  instruction: requiredText(300),
  /** Titles already in the section, so the model offers something new. */
  existing: z.array(requiredText(160)).max(40).default([]),
});
export type RefineRequest = z.infer<typeof RefineRequest>;

/** A compact, ID-bearing view of the plan that the Copilot reasons over. */
export const CopilotPlanContext = z.object({
  budget: z.object({
    total: z.number().int().min(0),
    lines: z
      .array(
        z.object({
          id: z.string().max(40),
          name: requiredText(60),
          planned: z.number().int().min(0),
          spent: z.number().int().min(0),
          perGuest: z.boolean(),
        }),
      )
      .max(40),
  }),
  tasks: z
    .array(
      z.object({
        id: z.string().max(40),
        title: requiredText(120),
        dueDate: IsoDate,
        priority: Priority,
        status: TaskStatus,
      }),
    )
    .max(80),
  vendors: z
    .array(
      z.object({
        id: z.string().max(40),
        name: requiredText(60),
        status: VendorStatus,
        bookBy: IsoDate,
      }),
    )
    .max(40),
});
export type CopilotPlanContext = z.infer<typeof CopilotPlanContext>;

export const CopilotMessage = z.object({
  role: z.enum(['user', 'assistant']),
  text: requiredText(1500),
});
export type CopilotMessage = z.infer<typeof CopilotMessage>;

export const CopilotRequest = z.object({
  brief: EventBrief,
  today: IsoDate,
  plan: CopilotPlanContext,
  history: z.array(CopilotMessage).max(8).default([]),
  message: requiredText(600),
});
export type CopilotRequest = z.infer<typeof CopilotRequest>;

export const CopilotResponse = z.object({
  reply: z.string(),
  operations: z.array(PlanOperation).max(12),
  /** Proposals the model made that failed validation and were discarded. */
  dropped: z.number().int().min(0),
});
export type CopilotResponse = z.infer<typeof CopilotResponse>;

export const InvitationRequest = z.object({
  brief: EventBrief,
  tone: z.enum(INVITATION_TONES),
  channel: z.enum(INVITATION_CHANNELS),
  language: OutputLanguage,
  hosts: z.string().trim().max(120).optional(),
  venueName: z.string().trim().max(120).optional(),
  extra: z.string().trim().max(300).optional(),
});
export type InvitationRequest = z.infer<typeof InvitationRequest>;

/** Metadata the gateway attaches to every AI answer (shown in the UI, logged on the server). */
export const AiMetaInfo = z.object({
  model: z.string(),
  /** `mock` when the gateway runs without a Gemini key; `fallback` when Gemini failed. */
  mode: z.enum(['gemini', 'mock', 'fallback']),
  cached: z.boolean(),
  ms: z.number().int().min(0),
});
export type AiMetaInfo = z.infer<typeof AiMetaInfo>;

/**
 * One line of the NDJSON stream returned by POST /api/ai/personalize. The browser validates
 * every line with this schema before merging it into a plan.
 */
export const PersonalizeEvent = z.union([
  z.object({
    type: z.literal('section'),
    section: z.literal('budget'),
    data: BudgetSectionData,
    meta: AiMetaInfo,
  }),
  z.object({
    type: z.literal('section'),
    section: z.literal('timeline'),
    data: TimelineSectionData,
    meta: AiMetaInfo,
  }),
  z.object({
    type: z.literal('section'),
    section: z.literal('vendors'),
    data: VendorsSectionData,
    meta: AiMetaInfo,
  }),
  z.object({
    type: z.literal('section'),
    section: z.literal('ideas'),
    data: IdeasSectionData,
    meta: AiMetaInfo,
  }),
  z.object({
    type: z.literal('section_error'),
    section: AiSection,
    code: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal('done'), ms: z.number().min(0) }),
]);
export type PersonalizeEvent = z.infer<typeof PersonalizeEvent>;

/** POST /api/ai/brief answers with the extracted brief plus metadata. */
export const BriefApiResponse = BriefResponse.extend({ meta: AiMetaInfo });
export type BriefApiResponse = z.infer<typeof BriefApiResponse>;

/** POST /api/ai/refine answers with one section plus metadata. */
export const RefineApiResponse = z.union([
  z.object({ section: z.literal('budget'), data: BudgetSectionData, meta: AiMetaInfo }),
  z.object({ section: z.literal('timeline'), data: TimelineSectionData, meta: AiMetaInfo }),
  z.object({ section: z.literal('vendors'), data: VendorsSectionData, meta: AiMetaInfo }),
  z.object({ section: z.literal('ideas'), data: IdeasSectionData, meta: AiMetaInfo }),
]);
export type RefineApiResponse = z.infer<typeof RefineApiResponse>;

export const CopilotApiResponse = CopilotResponse.extend({ meta: AiMetaInfo });
export type CopilotApiResponse = z.infer<typeof CopilotApiResponse>;

export const InvitationApiResponse = InvitationDraft.extend({ meta: AiMetaInfo });
export type InvitationApiResponse = z.infer<typeof InvitationApiResponse>;
