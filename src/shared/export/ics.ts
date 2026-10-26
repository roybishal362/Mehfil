/**
 * iCalendar (RFC 5545) export: the event, every open task as an all-day reminder with an alarm,
 * and the day-of run sheet as timed entries. Works with Google Calendar, Apple Calendar and Outlook.
 */
import type { EventPlan, ScheduleItem, Task } from '../schemas/plan';
import { addDays, clockToMinutes, compactDate, minutesToClock } from '../utils/dates';

const encoder = new TextEncoder();

/** Escapes text values: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds a content line at 75 octets (RFC 5545 §3.1). Continuation lines start with a space.
 * Splits only between characters, so multi-byte scripts such as Hindi stay intact.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines lose one octet to the space
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function localDateTime(day: string, time: string): string {
  return `${compactDate(day)}T${time.replace(':', '')}00`;
}

export interface IcsOptions {
  /** Timestamp for DTSTAMP; injected for reproducible output. */
  now: Date;
  /** Reminder title prefix, e.g. "Mehfil". */
  prefix?: string;
}

/** iCalendar priority: 1 is highest, 9 lowest. */
const ICS_PRIORITY = { high: '1', medium: '5', low: '9' } as const;

type Entry = string[];

/** Everything one calendar entry needs to know about the export as a whole. */
interface Export {
  plan: EventPlan;
  stamp: string;
  prefix: string;
}

const uid = ({ plan }: Export, id: string) => `${plan.id}-${id}@mehfil`;

function eventEntry(out: Export): Entry {
  const { brief, summary } = out.plan;
  return [
    'BEGIN:VEVENT',
    `UID:${uid(out, 'event')}`,
    `DTSTAMP:${out.stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(brief.date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(brief.endDate ?? brief.date, 1))}`,
    `SUMMARY:${escapeIcsText(brief.title)}`,
    `LOCATION:${escapeIcsText(brief.city)}`,
    ...(summary ? [`DESCRIPTION:${escapeIcsText(summary)}`] : []),
    'END:VEVENT',
  ];
}

/** An open task as an all-day reminder, with an alarm at 09:00 the day before. */
function taskEntry(out: Export, task: Task): Entry {
  return [
    'BEGIN:VEVENT',
    `UID:${uid(out, task.id)}`,
    `DTSTAMP:${out.stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(task.dueDate)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(task.dueDate, 1))}`,
    `SUMMARY:${escapeIcsText(`${out.prefix}: ${task.title}`)}`,
    ...(task.notes ? [`DESCRIPTION:${escapeIcsText(task.notes)}`] : []),
    `PRIORITY:${ICS_PRIORITY[task.priority]}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(task.title)}`,
    'TRIGGER;RELATED=START:-PT15H',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/** A run-sheet slot as a timed entry; a late slot may end after midnight. */
function slotEntry(out: Export, slot: ScheduleItem): Entry {
  const endTotal = clockToMinutes(slot.time) + Math.max(slot.durationMinutes, 1);
  const endDay = addDays(slot.day, Math.floor(endTotal / 1440));
  return [
    'BEGIN:VEVENT',
    `UID:${uid(out, slot.id)}`,
    `DTSTAMP:${out.stamp}`,
    `DTSTART:${localDateTime(slot.day, slot.time)}`,
    `DTEND:${localDateTime(endDay, minutesToClock(endTotal))}`,
    `SUMMARY:${escapeIcsText(slot.title)}`,
    ...(slot.owner ? [`DESCRIPTION:${escapeIcsText(slot.owner)}`] : []),
    `LOCATION:${escapeIcsText(out.plan.brief.city)}`,
    'END:VEVENT',
  ];
}

export function buildIcs(plan: EventPlan, { now, prefix = 'Mehfil' }: IcsOptions): string {
  const out: Export = { plan, stamp: utcStamp(now), prefix };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mehfil//Celebration Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(plan.brief.title)}`,
    ...eventEntry(out),
    ...plan.tasks.filter((task) => task.status !== 'done').flatMap((task) => taskEntry(out, task)),
    ...plan.schedule.flatMap((slot) => slotEntry(out, slot)),
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
