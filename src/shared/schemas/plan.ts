/**
 * The event plan and its parts. Every edit — from the UI or the Copilot — produces a value
 * that still satisfies these schemas, and stored plans are re-validated when loaded.
 */
import * as z from '../zod';
import { EventBrief } from './brief';
import { BudgetCategory, VendorCategory } from './categories';
import {
  AiSection,
  ClockTime,
  CostLevel,
  Currency,
  DietaryNeed,
  HexColor,
  Id,
  IdeaKind,
  IsoDate,
  Likelihood,
  Money,
  Priority,
  RsvpStatus,
  Source,
  TaskCategory,
  TaskStatus,
  VendorStatus,
  requiredText,
  text,
} from './primitives';

export const PLAN_SCHEMA_VERSION = 1;

export const LIMITS = {
  budgetLines: 40,
  savingTips: 6,
  tasks: 300,
  vendors: 40,
  vendorOptions: 10,
  ideas: 80,
  guests: 2000,
  schedule: 80,
  risks: 20,
} as const;

export const BudgetLine = z.object({
  id: Id,
  category: BudgetCategory,
  /** Custom label; template lines are labelled by the UI from `category`. */
  label: text(60).optional(),
  planned: Money,
  /** Amount committed or spent so far (e.g. a booked vendor quote). */
  spent: Money.default(0),
  /** Amount already paid out (deposits, settled invoices). */
  paid: Money.default(0),
  /** Scales with the guest count (catering, favours, invitations). */
  perGuest: z.boolean().default(false),
  source: Source,
  rationale: text(200).optional(),
  notes: text(300).optional(),
});
export type BudgetLine = z.infer<typeof BudgetLine>;

export const SavingTip = z.object({
  id: Id,
  tip: requiredText(220),
  category: BudgetCategory.optional(),
});
export type SavingTip = z.infer<typeof SavingTip>;

export const BudgetAssessment = z.object({
  level: z.enum(['comfortable', 'tight', 'very_tight']),
  note: requiredText(260),
});
export type BudgetAssessment = z.infer<typeof BudgetAssessment>;

export const Budget = z.object({
  currency: Currency,
  total: Money,
  lines: z.array(BudgetLine).max(LIMITS.budgetLines),
  savingTips: z.array(SavingTip).max(LIMITS.savingTips).default([]),
  assessment: BudgetAssessment.optional(),
});
export type Budget = z.infer<typeof Budget>;

export const Task = z.object({
  id: Id,
  title: requiredText(120),
  notes: text(500).optional(),
  dueDate: IsoDate,
  /** Ideal lead time before the event; negative values are follow-ups after it. */
  daysBefore: z.number().int().min(-90).max(730),
  priority: Priority,
  status: TaskStatus,
  category: TaskCategory,
  /** True when the ideal lead time had already passed and the date was pulled in. */
  compressed: z.boolean().default(false),
  source: Source,
});
export type Task = z.infer<typeof Task>;

export const VendorOption = z.object({
  id: Id,
  name: requiredText(80),
  phone: text(30).optional(),
  email: text(100).optional(),
  website: text(200).optional(),
  quote: Money.optional(),
  notes: text(300).optional(),
});
export type VendorOption = z.infer<typeof VendorOption>;

export const Vendor = z.object({
  id: Id,
  category: VendorCategory,
  label: text(60).optional(),
  priority: Priority,
  bookBy: IsoDate,
  status: VendorStatus,
  questions: z.array(requiredText(160)).max(8).default([]),
  redFlags: z.array(requiredText(160)).max(5).default([]),
  tip: text(220).optional(),
  options: z.array(VendorOption).max(LIMITS.vendorOptions).default([]),
  selectedOptionId: Id.optional(),
  /** Budget line that this vendor's booked quote counts against. */
  budgetCategory: BudgetCategory.optional(),
  notes: text(300).optional(),
  source: Source,
});
export type Vendor = z.infer<typeof Vendor>;

export const Idea = z.object({
  id: Id,
  kind: IdeaKind,
  title: requiredText(80),
  description: requiredText(420),
  palette: z.array(HexColor).max(5).optional(),
  costLevel: CostLevel.optional(),
  favorite: z.boolean().default(false),
  source: Source,
});
export type Idea = z.infer<typeof Idea>;

export const Guest = z.object({
  id: Id,
  name: requiredText(80),
  group: text(40).optional(),
  partySize: z.number().int().min(1).max(20).default(1),
  rsvp: RsvpStatus.default('pending'),
  dietary: DietaryNeed.optional(),
  contact: text(100).optional(),
  notes: text(200).optional(),
});
export type Guest = z.infer<typeof Guest>;

export const ScheduleItem = z.object({
  id: Id,
  day: IsoDate,
  time: ClockTime,
  durationMinutes: z.number().int().min(0).max(720),
  title: requiredText(100),
  owner: text(60).optional(),
  notes: text(200).optional(),
  source: Source,
});
export type ScheduleItem = z.infer<typeof ScheduleItem>;

export const Risk = z.object({
  id: Id,
  title: requiredText(100),
  likelihood: Likelihood,
  mitigation: requiredText(300),
  source: Source,
});
export type Risk = z.infer<typeof Risk>;

export const SectionMeta = z.object({
  status: z.enum(['template', 'ai', 'failed']),
  model: text(60).optional(),
  updatedAt: z.iso.datetime().optional(),
});
export type SectionMeta = z.infer<typeof SectionMeta>;

export const AiMeta = z.object({
  sections: z.record(AiSection, SectionMeta),
});
export type AiMeta = z.infer<typeof AiMeta>;

export const EventPlan = z.object({
  id: Id,
  schemaVersion: z.literal(PLAN_SCHEMA_VERSION),
  brief: EventBrief,
  summary: text(800).optional(),
  budget: Budget,
  tasks: z.array(Task).max(LIMITS.tasks),
  vendors: z.array(Vendor).max(LIMITS.vendors),
  ideas: z.array(Idea).max(LIMITS.ideas),
  guests: z.array(Guest).max(LIMITS.guests),
  schedule: z.array(ScheduleItem).max(LIMITS.schedule),
  risks: z.array(Risk).max(LIMITS.risks),
  ai: AiMeta,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  revision: z.number().int().min(0),
});
export type EventPlan = z.infer<typeof EventPlan>;
