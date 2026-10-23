import type { BudgetCategory, VendorCategory } from '../schemas/categories';
import type { EventType, Priority, TaskCategory } from '../schemas/primitives';

/** Text that the baseline plan can show in English, Hindi or Bengali. */
export interface LocalizedText {
  en: string;
  hi: string;
  bn: string;
}

/** Picks the plan language when a translation exists, otherwise English. */
export function pickText(value: LocalizedText, language: string): string {
  return language === 'hi' || language === 'bn' ? value[language] : value.en;
}

export interface BudgetTemplateLine {
  category: BudgetCategory;
  /** Default share of the total budget, in percent. */
  weight: number;
  /** Lowest and highest share (percent) any personalisation may assign. */
  min: number;
  max: number;
  perGuest?: boolean;
}

export interface TaskTemplate {
  key: string;
  title: LocalizedText;
  /** Ideal lead time before the event (negative = after the event). */
  daysBefore: number;
  priority: Priority;
  category: TaskCategory;
}

export interface VendorTemplate {
  category: VendorCategory;
  priority: Priority;
  /** Book at least this many days before the event. */
  leadDays: number;
  budgetCategory?: BudgetCategory;
}

export interface ScheduleTemplate {
  /** Days after the (first) event date. */
  dayOffset: number;
  time: string;
  durationMinutes: number;
  title: LocalizedText;
  /** The item that `brief.startTime` aligns to (guests arriving). */
  anchor?: boolean;
}

export interface EventTemplate {
  type: EventType;
  budget: readonly BudgetTemplateLine[];
  tasks: readonly TaskTemplate[];
  vendors: readonly VendorTemplate[];
  schedule: readonly ScheduleTemplate[];
}
