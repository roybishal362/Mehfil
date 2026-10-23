/**
 * iCalendar (RFC 5545) export: the event, every open task as an all-day reminder with an alarm,
 * and the day-of run sheet as timed entries. Works with Google Calendar, Apple Calendar and Outlook.
 */
import type { EventPlan } from '../schemas/plan';
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

export function buildIcs(plan: EventPlan, { now, prefix = 'Mehfil' }: IcsOptions): string {
  const { brief } = plan;
  const stamp = utcStamp(now);
  const uid = (id: string) => `${plan.id}-${id}@mehfil`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mehfil//Celebration Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(brief.title)}`,
  ];

  lines.push(
    'BEGIN:VEVENT',
    `UID:${uid('event')}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(brief.date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(brief.endDate ?? brief.date, 1))}`,
    `SUMMARY:${escapeIcsText(brief.title)}`,
    `LOCATION:${escapeIcsText(brief.city)}`,
    ...(plan.summary ? [`DESCRIPTION:${escapeIcsText(plan.summary)}`] : []),
    'END:VEVENT',
  );

  for (const task of plan.tasks) {
    if (task.status === 'done') continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid(task.id)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(task.dueDate)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(task.dueDate, 1))}`,
      `SUMMARY:${escapeIcsText(`${prefix}: ${task.title}`)}`,
      ...(task.notes ? [`DESCRIPTION:${escapeIcsText(task.notes)}`] : []),
      `PRIORITY:${task.priority === 'high' ? '1' : task.priority === 'medium' ? '5' : '9'}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(task.title)}`,
      // 09:00 the day before an all-day item.
      'TRIGGER;RELATED=START:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  for (const slot of plan.schedule) {
    const startMinutes = clockToMinutes(slot.time);
    const endTotal = startMinutes + Math.max(slot.durationMinutes, 1);
    const endDay = addDays(slot.day, Math.floor(endTotal / 1440));
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid(slot.id)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localDateTime(slot.day, slot.time)}`,
      `DTEND:${localDateTime(endDay, minutesToClock(endTotal))}`,
      `SUMMARY:${escapeIcsText(slot.title)}`,
      ...(slot.owner ? [`DESCRIPTION:${escapeIcsText(slot.owner)}`] : []),
      `LOCATION:${escapeIcsText(brief.city)}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
