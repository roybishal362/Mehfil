/**
 * Tailoring one plan section. Each section has its own model tier, creativity and output
 * budget, and budget and vendor answers are limited to the occasion's own categories.
 */
import type { ZodType } from '../../../shared/zod';
import { deepCleanStrings } from '../../../shared/domain/merge';
import {
  IdeasSectionData,
  TimelineSectionData,
  budgetSectionSchema,
  vendorsSectionSchema,
  type AiMetaInfo,
  type SectionData,
} from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import type { AiSection } from '../../../shared/schemas/primitives';
import { getTemplate } from '../../../shared/templates';
import type { AiGateway } from '../gateway';
import { refinePrompt, sectionPrompt, systemPrompt } from '../prompts';
import { aiMeta } from './meta';

interface SectionSettings {
  smart: boolean;
  temperature: number;
  maxOutputTokens: number;
}

const SECTION_SETTINGS: Readonly<Record<AiSection, SectionSettings>> = {
  budget: { smart: false, temperature: 0.3, maxOutputTokens: 2048 },
  timeline: { smart: false, temperature: 0.4, maxOutputTokens: 3072 },
  vendors: { smart: false, temperature: 0.4, maxOutputTokens: 3072 },
  ideas: { smart: true, temperature: 0.9, maxOutputTokens: 4096 },
};

function sectionSchema(section: AiSection, brief: EventBrief): ZodType<SectionData['data']> {
  const template = getTemplate(brief.type);
  switch (section) {
    case 'budget': {
      const [first, ...rest] = template.budget.map((line) => line.category);
      return budgetSectionSchema(first ? [first, ...rest] : ['contingency']);
    }
    case 'vendors': {
      const [first, ...rest] = template.vendors.map((vendor) => vendor.category);
      return vendorsSectionSchema(first ? [first, ...rest] : ['custom']);
    }
    case 'timeline':
      return TimelineSectionData;
    case 'ideas':
      return IdeasSectionData;
  }
}

export interface SectionRequest {
  section: AiSection;
  brief: EventBrief;
  today: string;
  /** Present when the user asked for changes ("more budget-friendly"). */
  instruction?: string;
  existing?: readonly string[];
  signal?: AbortSignal;
}

export async function generateSection(
  gateway: AiGateway,
  { section, brief, today, instruction, existing = [], signal }: SectionRequest,
): Promise<{ result: SectionData; meta: AiMetaInfo }> {
  const settings = SECTION_SETTINGS[section];
  const smart = settings.smart || instruction !== undefined;
  const outcome = await gateway.json(
    {
      task: `section.${section}`,
      model: smart ? gateway.models.smart : gateway.models.fast,
      system: systemPrompt(brief.language),
      prompt: instruction
        ? refinePrompt({ section, brief, today, instruction, existing })
        : sectionPrompt(section, brief, today),
      schema: sectionSchema(section, brief),
      temperature: settings.temperature,
      maxOutputTokens: settings.maxOutputTokens,
      thinking: smart ? 'low' : 'minimal',
      timeoutMs: 25_000,
      input: { brief, today, ...(instruction ? { instruction } : {}) },
      ...(signal ? { signal } : {}),
    },
    30_000,
  );
  // Server-side sanitising before anything reaches the browser: no contacts, bounded lengths.
  const result = { section, data: deepCleanStrings(outcome.data) } as SectionData;
  return { result, meta: aiMeta(outcome, gateway.mode) };
}
