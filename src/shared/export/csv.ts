/**
 * CSV import and export (RFC 4180) for guest lists and budgets.
 * Exported cells that start with =, +, -, @ or a control character are prefixed with an
 * apostrophe so spreadsheet apps never execute them as formulas (CSV injection).
 */
import type { z } from 'zod';
import { Guest } from '../schemas/plan';
import { DietaryNeed, RsvpStatus } from '../schemas/primitives';

const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralises spreadsheet formulas and quotes the cell when needed. */
export function csvCell(value: string | number | undefined): string {
  let text = value === undefined ? '' : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly (readonly (string | number | undefined)[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Parses CSV text into rows. Handles quotes, escaped quotes, CRLF/LF and a UTF-8 BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\u{FEFF}/u, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const GUEST_CSV_HEADERS = [
  'Name',
  'Group',
  'Party size',
  'RSVP',
  'Dietary',
  'Contact',
  'Notes',
] as const;

export function guestsToCsv(guests: readonly Guest[]): string {
  return toCsv([
    [...GUEST_CSV_HEADERS],
    ...guests.map((g) => [g.name, g.group, g.partySize, g.rsvp, g.dietary, g.contact, g.notes]),
  ]);
}

const GuestRow = Guest.omit({ id: true });
export type GuestImport = z.infer<typeof GuestRow>;

export interface GuestImportResult {
  guests: GuestImport[];
  errors: { line: number; message: string }[];
}

const HEADER_ALIASES: Readonly<Record<string, keyof GuestImport>> = {
  name: 'name',
  'guest name': 'name',
  group: 'group',
  side: 'group',
  'party size': 'partySize',
  partysize: 'partySize',
  people: 'partySize',
  rsvp: 'rsvp',
  status: 'rsvp',
  dietary: 'dietary',
  diet: 'dietary',
  contact: 'contact',
  phone: 'contact',
  email: 'contact',
  notes: 'notes',
};

/** Reads a guest list exported by Mehfil or typed in a spreadsheet; reports bad rows by line. */
export function guestsFromCsv(text: string): GuestImportResult {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { guests: [], errors: [{ line: 1, message: 'The file is empty' }] };
  const columns = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!columns.includes('name')) {
    return { guests: [], errors: [{ line: 1, message: 'Add a "Name" column' }] };
  }
  const result: GuestImportResult = { guests: [], errors: [] };
  rows.forEach((cells, index) => {
    const record: Record<string, unknown> = {};
    columns.forEach((key, i) => {
      const raw = cells[i]?.trim().replace(/^'(?=[=+\-@])/, '');
      if (!key || !raw) return;
      if (key === 'partySize') record[key] = Number(raw);
      else if (key === 'rsvp')
        record[key] = RsvpStatus.safeParse(raw.toLowerCase()).data ?? 'pending';
      else if (key === 'dietary') {
        const value = raw.toLowerCase().replace(/[\s-]+/g, '_');
        const parsed = DietaryNeed.safeParse(value);
        if (parsed.success) record[key] = parsed.data;
      } else record[key] = raw;
    });
    const parsed = GuestRow.safeParse(record);
    if (parsed.success) result.guests.push(parsed.data);
    else
      result.errors.push({
        line: index + 2,
        message: parsed.error.issues[0]?.message ?? 'Invalid row',
      });
  });
  return result;
}
