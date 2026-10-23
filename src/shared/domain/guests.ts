/** Guest list arithmetic: RSVP counts, expected headcount and dietary needs. */
import type { Guest } from '../schemas/plan';
import type { DietaryNeed } from '../schemas/primitives';

export interface GuestSummary {
  /** Invitations (parties) on the list. */
  invitations: number;
  /** People invited, counting each party's size. */
  people: number;
  confirmed: number;
  maybe: number;
  declined: number;
  pending: number;
  /** People who may come: confirmed + maybe + pending. Use this for catering estimates. */
  expected: number;
  /** People per dietary need among those who may come. */
  dietary: Partial<Record<DietaryNeed, number>>;
}

export function summariseGuests(guests: readonly Guest[]): GuestSummary {
  const summary: GuestSummary = {
    invitations: guests.length,
    people: 0,
    confirmed: 0,
    maybe: 0,
    declined: 0,
    pending: 0,
    expected: 0,
    dietary: {},
  };
  for (const guest of guests) {
    summary.people += guest.partySize;
    switch (guest.rsvp) {
      case 'yes':
        summary.confirmed += guest.partySize;
        break;
      case 'maybe':
        summary.maybe += guest.partySize;
        break;
      case 'no':
        summary.declined += guest.partySize;
        break;
      case 'pending':
        summary.pending += guest.partySize;
        break;
    }
    if (guest.rsvp !== 'no' && guest.dietary) {
      summary.dietary[guest.dietary] = (summary.dietary[guest.dietary] ?? 0) + guest.partySize;
    }
  }
  summary.expected = summary.confirmed + summary.maybe + summary.pending;
  return summary;
}

/** Headcount to plan for: the guest list when one exists, otherwise the brief's estimate. */
export function planningHeadcount(guests: readonly Guest[], briefGuestCount: number): number {
  if (guests.length === 0) return briefGuestCount;
  return summariseGuests(guests).expected;
}
