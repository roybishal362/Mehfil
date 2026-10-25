/**
 * Plan operations: the only way a plan changes. The UI, the Copilot and imports all produce
 * these, so every mutation is validated, previewable as a diff and undoable.
 */
import * as z from '../zod';
import { MAX_GUESTS, MIN_BUDGET, PartialBrief } from './brief';
import { Guest, Idea, LIMITS, ScheduleItem, VendorOption } from './plan';
import {
  DietaryNeed,
  Id,
  IsoDate,
  Money,
  Priority,
  RsvpStatus,
  TaskCategory,
  TaskStatus,
  VendorStatus,
  requiredText,
  text,
} from './primitives';

/** Brief fields that can be edited in place. Budget and guest count have dedicated operations. */
const BriefPatch = PartialBrief.omit({ type: true, budget: true, guestCount: true });
export type BriefPatch = z.infer<typeof BriefPatch>;

const TaskInput = z.object({
  title: requiredText(120),
  dueDate: IsoDate,
  priority: Priority.default('medium'),
  category: TaskCategory.default('planning'),
  notes: text(500).optional(),
});

const TaskPatch = z
  .object({
    title: requiredText(120),
    dueDate: IsoDate,
    priority: Priority,
    status: TaskStatus,
    category: TaskCategory,
    notes: text(500),
  })
  .partial();

const LinePatch = z
  .object({ label: text(60), planned: Money, spent: Money, paid: Money, notes: text(300) })
  .partial();

const VendorPatch = z
  .object({
    status: VendorStatus,
    bookBy: IsoDate,
    priority: Priority,
    notes: text(300),
    selectedOptionId: Id.nullable(),
  })
  .partial();

const VendorOptionInput = VendorOption.omit({ id: true });
const IdeaInput = Idea.pick({
  kind: true,
  title: true,
  description: true,
  palette: true,
  costLevel: true,
});
const GuestInput = Guest.omit({ id: true });
/**
 * Written out rather than `GuestInput.partial()`: in Zod 4 a partial schema still fills in
 * defaults, which would reset a guest's RSVP and party size on every unrelated edit.
 */
const GuestPatch = z
  .object({
    name: requiredText(80),
    group: text(40),
    partySize: z.number().int().min(1).max(20),
    rsvp: RsvpStatus,
    dietary: DietaryNeed,
    contact: text(100),
    notes: text(200),
  })
  .partial();
const ScheduleInput = ScheduleItem.omit({ id: true, source: true });

export const PlanOperation = z.discriminatedUnion('type', [
  z.object({ type: z.literal('brief.update'), patch: BriefPatch }),
  z.object({ type: z.literal('task.add'), task: TaskInput }),
  z.object({ type: z.literal('task.update'), id: Id, patch: TaskPatch }),
  z.object({ type: z.literal('task.remove'), id: Id }),
  z.object({
    type: z.literal('budget.setTotal'),
    total: Money.min(MIN_BUDGET),
    protectIds: z.array(Id).max(LIMITS.budgetLines).default([]),
  }),
  z.object({ type: z.literal('budget.updateLine'), id: Id, patch: LinePatch }),
  z.object({
    type: z.literal('budget.addLine'),
    line: z.object({ label: requiredText(60), planned: Money }),
  }),
  z.object({ type: z.literal('budget.removeLine'), id: Id }),
  z.object({
    type: z.literal('guests.setCount'),
    guestCount: z.number().int().min(1).max(MAX_GUESTS),
    keepBudget: z.boolean(),
  }),
  z.object({ type: z.literal('vendor.update'), id: Id, patch: VendorPatch }),
  z.object({
    type: z.literal('vendor.add'),
    vendor: z.object({ label: requiredText(60), priority: Priority, bookBy: IsoDate }),
  }),
  z.object({ type: z.literal('vendor.remove'), id: Id }),
  z.object({ type: z.literal('vendor.addOption'), vendorId: Id, option: VendorOptionInput }),
  z.object({
    type: z.literal('vendor.updateOption'),
    vendorId: Id,
    optionId: Id,
    patch: VendorOptionInput.partial(),
  }),
  z.object({ type: z.literal('vendor.removeOption'), vendorId: Id, optionId: Id }),
  z.object({ type: z.literal('idea.add'), idea: IdeaInput }),
  z.object({
    type: z.literal('idea.update'),
    id: Id,
    patch: z.object({ favorite: z.boolean() }).partial(),
  }),
  z.object({ type: z.literal('idea.remove'), id: Id }),
  z.object({ type: z.literal('guest.add'), guest: GuestInput }),
  z.object({ type: z.literal('guest.update'), id: Id, patch: GuestPatch }),
  z.object({ type: z.literal('guest.remove'), id: Id }),
  z.object({
    type: z.literal('guests.import'),
    guests: z.array(GuestInput).max(LIMITS.guests),
  }),
  z.object({ type: z.literal('schedule.add'), item: ScheduleInput }),
  z.object({ type: z.literal('schedule.update'), id: Id, patch: ScheduleInput.partial() }),
  z.object({ type: z.literal('schedule.remove'), id: Id }),
  z.object({ type: z.literal('risk.remove'), id: Id }),
]);
export type PlanOperation = z.infer<typeof PlanOperation>;
/** Input form (defaults may be omitted), e.g. when the UI builds an operation. */
export type PlanOperationInput = z.input<typeof PlanOperation>;

/** Operations the Copilot may propose. Everything else needs a direct user action. */
export const COPILOT_OPERATION_TYPES = [
  'task.add',
  'task.update',
  'task.remove',
  'budget.setTotal',
  'budget.updateLine',
  'budget.addLine',
  'guests.setCount',
  'vendor.update',
  'idea.add',
  'schedule.add',
] as const satisfies readonly PlanOperation['type'][];
