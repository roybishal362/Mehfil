/** Vendor checklist engine: book-by dates, pipeline counts and spend from booked quotes. */
import type { BudgetCategory } from '../schemas/categories';
import type { Vendor, VendorOption } from '../schemas/plan';
import type { VendorStatus } from '../schemas/primitives';
import { VENDOR_STATUSES } from '../schemas/primitives';
import type { EventTemplate } from '../templates/types';
import { zipWith } from '../utils/collections';
import { diffDays } from '../utils/dates';
import type { IdFactory } from '../utils/ids';
import { scheduleLeadTimes } from './timeline';

/** Creates the vendor checklist for a template, with book-by dates fitted to the time left. */
export function createVendors(
  template: EventTemplate,
  eventDate: string,
  today: string,
  makeId: IdFactory,
): Vendor[] {
  // `eventDate` anchors the book-by dates; vendors that cannot wait are pulled toward today.
  const dates = scheduleLeadTimes(
    template.vendors.map((v) => v.leadDays),
    eventDate,
    today,
  );
  return zipWith(template.vendors, dates, (vendor, scheduled) => ({
    id: makeId('vendor'),
    category: vendor.category,
    priority: vendor.priority,
    bookBy: scheduled.dueDate,
    status: 'not_started',
    questions: [],
    redFlags: [],
    options: [],
    ...(vendor.budgetCategory ? { budgetCategory: vendor.budgetCategory } : {}),
    source: 'template',
  }));
}

/** How far along each status is, used for readiness scoring. */
export const STATUS_PROGRESS: Readonly<Record<VendorStatus, number>> = {
  not_started: 0,
  researching: 0.1,
  contacted: 0.25,
  quoted: 0.5,
  booked: 0.9,
  paid: 1,
};

export function isSecured(vendor: Pick<Vendor, 'status'>): boolean {
  return vendor.status === 'booked' || vendor.status === 'paid';
}

/** Number of vendors at each status, in pipeline order. */
export function vendorPipeline(vendors: readonly Vendor[]): Record<VendorStatus, number> {
  const counts = Object.fromEntries(VENDOR_STATUSES.map((s) => [s, 0])) as Record<
    VendorStatus,
    number
  >;
  for (const vendor of vendors) counts[vendor.status] += 1;
  return counts;
}

/** The option the user picked, if any. */
export function selectedOption(vendor: Vendor): VendorOption | undefined {
  return vendor.options.find((option) => option.id === vendor.selectedOptionId);
}

/** The lowest quote among the options, to highlight in comparisons. */
export function cheapestOption(vendor: Vendor): VendorOption | undefined {
  let best: VendorOption | undefined;
  let bestQuote = Infinity;
  for (const option of vendor.options) {
    if (option.quote !== undefined && option.quote < bestQuote) {
      best = option;
      bestQuote = option.quote;
    }
  }
  return best;
}

/** Spend committed by a vendor: the selected quote once the vendor is booked or paid. */
export function committedAmount(vendor: Vendor): number {
  if (!isSecured(vendor)) return 0;
  return selectedOption(vendor)?.quote ?? 0;
}

/** Booked quotes summed per budget category, so the budget reflects vendor commitments. */
export function committedByCategory(
  vendors: readonly Vendor[],
): Partial<Record<BudgetCategory, number>> {
  const committed: Partial<Record<BudgetCategory, number>> = {};
  for (const vendor of vendors) {
    const amount = committedAmount(vendor);
    if (amount > 0 && vendor.budgetCategory) {
      committed[vendor.budgetCategory] = (committed[vendor.budgetCategory] ?? 0) + amount;
    }
  }
  return committed;
}

export type VendorState = 'secured' | 'overdue' | 'due_soon' | 'open';

/** Whether a vendor still needs booking and how urgent that is. */
export function vendorState(
  vendor: Pick<Vendor, 'status' | 'bookBy'>,
  today: string,
  soonDays = 14,
): VendorState {
  if (isSecured(vendor)) return 'secured';
  const daysLeft = diffDays(vendor.bookBy, today);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= soonDays) return 'due_soon';
  return 'open';
}
