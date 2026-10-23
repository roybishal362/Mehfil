/**
 * Links into Google services that need no API key: "Add to Google Calendar" templates and
 * Google Maps searches for real vendors near the event. Mehfil never invents vendor names;
 * it sends people to real listings instead.
 */
import type { VendorCategory } from '../schemas/categories';
import type { EventType } from '../schemas/primitives';
import { addDays, clockToMinutes, compactDate, minutesToClock } from '../utils/dates';

export interface CalendarLinkInput {
  title: string;
  /** All-day item on `date`, or a timed item when `time` is set. */
  date: string;
  endDate?: string;
  time?: string;
  durationMinutes?: number;
  details?: string;
  location?: string;
}

/** Google Calendar "create event" link, pre-filled. */
export function googleCalendarLink(input: CalendarLinkInput): string {
  let dates: string;
  if (input.time) {
    const start = clockToMinutes(input.time);
    const end = start + Math.max(input.durationMinutes ?? 60, 1);
    const endDay = addDays(input.date, Math.floor(end / 1440));
    dates = `${compactDate(input.date)}T${input.time.replace(':', '')}00/${compactDate(endDay)}T${minutesToClock(end).replace(':', '')}00`;
  } else {
    dates = `${compactDate(input.date)}/${compactDate(addDays(input.endDate ?? input.date, 1))}`;
  }
  const params = new URLSearchParams({ action: 'TEMPLATE', text: input.title, dates });
  if (input.details) params.set('details', input.details);
  if (input.location) params.set('location', input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** What to search for on Google Maps for each vendor category. */
const SEARCH_TERMS: Readonly<Record<Exclude<VendorCategory, 'custom'>, string>> = {
  venue: 'banquet halls',
  caterer: 'caterers',
  photographer: 'photographers',
  decorator: 'event decorators',
  officiant: 'priests for ceremonies',
  makeup_artist: 'makeup artists',
  mehendi_artist: 'mehendi artists',
  music_dj: 'DJs',
  invitations_printer: 'invitation card printers',
  transport: 'car rentals',
  cake_baker: 'cake shops',
  entertainer: 'party entertainers',
  pandal_tent: 'tent house and pandal decorators',
  sound_lighting: 'sound and lighting rental',
  performers: 'live music bands',
  security: 'event security services',
  cleaning: 'event cleaning services',
};

const OCCASION_WORD: Readonly<Record<EventType, string>> = {
  wedding: 'wedding',
  birthday: 'birthday party',
  community: 'event',
  other: 'party',
};

/** The Google Maps query for a vendor category, e.g. "wedding photographers in Kolkata". */
export function vendorSearchQuery(
  category: VendorCategory,
  eventType: EventType,
  city: string,
  customLabel?: string,
): string {
  const term = category === 'custom' ? (customLabel ?? 'event services') : SEARCH_TERMS[category];
  const occasionSpecific: readonly VendorCategory[] = [
    'venue',
    'photographer',
    'decorator',
    'makeup_artist',
    'caterer',
    'cake_baker',
  ];
  const prefix = occasionSpecific.includes(category) ? `${OCCASION_WORD[eventType]} ` : '';
  return `${prefix}${term} in ${city}`.replace(/\s+/g, ' ').trim();
}

/** Google Maps search URL (Maps URLs API; no key needed). */
export function googleMapsSearchLink(query: string): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query }).toString()}`;
}

/** A WhatsApp share link with pre-filled text. */
export function whatsAppLink(text: string): string {
  return `https://wa.me/?${new URLSearchParams({ text }).toString()}`;
}
