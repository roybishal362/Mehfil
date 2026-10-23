import { describe, expect, it } from 'vitest';
import { weddingPlan } from '../test/fixtures';
import { csvCell, guestsFromCsv, guestsToCsv, parseCsv, toCsv } from './csv';
import { buildIcs, escapeIcsText, foldIcsLine } from './ics';
import { googleCalendarLink, googleMapsSearchLink, vendorSearchQuery, whatsAppLink } from './links';
import { SharedPlan, ShareId, toShareSnapshot } from './share';

const encoder = new TextEncoder();

describe('iCalendar export', () => {
  it('escapes special characters', () => {
    expect(escapeIcsText('Haldi; then lunch, at home\nBring \\ gifts')).toBe(
      'Haldi\\; then lunch\\, at home\\nBring \\\\ gifts',
    );
  });

  it('folds long lines at 75 octets without splitting Hindi characters', () => {
    const line = `SUMMARY:${'मेहमानों की सूची फ़ाइनल करें '.repeat(4)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
    expect(foldIcsLine('SHORT:line')).toBe('SHORT:line');
  });

  it('builds a calendar with the event, open tasks with alarms and the run sheet', () => {
    const plan = weddingPlan();
    const done = {
      ...plan,
      tasks: plan.tasks.map((t, i) => (i === 0 ? { ...t, status: 'done' as const } : t)),
    };
    const ics = buildIcs(done, { now: new Date('2026-10-23T10:00:00Z') });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270214');
    expect(ics).toContain('DTEND;VALUE=DATE:20270215');
    expect(ics).toContain('DTSTAMP:20261023T100000Z');
    expect(ics).toContain('TRIGGER;RELATED=START:-PT15H');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(plan.tasks.length - 1);
    expect(ics).toContain('DTSTART:20270214T183000');
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('ends a late-night run-sheet item on the next day', () => {
    const plan = weddingPlan();
    const late = {
      ...plan,
      schedule: [{ ...plan.schedule[0]!, time: '23:30', durationMinutes: 90 }],
    };
    expect(buildIcs(late, { now: new Date('2026-10-23T10:00:00Z') })).toContain(
      'DTEND:20270215T010000',
    );
  });
});

describe('Google links', () => {
  it('creates all-day and timed Google Calendar links', () => {
    const allDay = new URL(
      googleCalendarLink({
        title: 'Book the venue',
        date: '2026-11-01',
        location: 'Kolkata',
        details: 'High priority',
      }),
    );
    expect(allDay.origin).toBe('https://calendar.google.com');
    expect(allDay.searchParams.get('dates')).toBe('20261101/20261102');
    expect(allDay.searchParams.get('location')).toBe('Kolkata');

    const timed = new URL(
      googleCalendarLink({
        title: 'Baraat',
        date: '2027-02-14',
        time: '23:30',
        durationMinutes: 60,
      }),
    );
    expect(timed.searchParams.get('dates')).toBe('20270214T233000/20270215T003000');

    const multiDay = new URL(
      googleCalendarLink({ title: 'Wedding', date: '2027-02-12', endDate: '2027-02-14' }),
    );
    expect(multiDay.searchParams.get('dates')).toBe('20270212/20270215');
  });

  it('builds Google Maps vendor searches for the event city', () => {
    expect(vendorSearchQuery('photographer', 'wedding', 'Kolkata')).toBe(
      'wedding photographers in Kolkata',
    );
    expect(vendorSearchQuery('sound_lighting', 'community', 'Pune')).toBe(
      'sound and lighting rental in Pune',
    );
    expect(vendorSearchQuery('custom', 'other', 'Delhi', 'Dhaki drummers')).toBe(
      'Dhaki drummers in Delhi',
    );
    expect(vendorSearchQuery('custom', 'other', 'Delhi')).toBe('event services in Delhi');
    const url = new URL(googleMapsSearchLink('wedding caterers in Kolkata'));
    expect(url.href.startsWith('https://www.google.com/maps/search/?api=1')).toBe(true);
    expect(url.searchParams.get('query')).toBe('wedding caterers in Kolkata');
  });

  it('builds WhatsApp share links', () => {
    expect(new URL(whatsAppLink('You are invited!')).searchParams.get('text')).toBe(
      'You are invited!',
    );
  });
});

describe('CSV', () => {
  it('quotes cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('Sen, Meera')).toBe('"Sen, Meera"');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(undefined)).toBe('');
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\r\nc,d\r\n');
  });

  it('parses quoted fields, escaped quotes, line breaks and a BOM', () => {
    expect(parseCsv('\u{FEFF}Name,Notes\r\n"Sen, Meera","Says ""hi""\nsoon"\n\nTara,\n')).toEqual([
      ['Name', 'Notes'],
      ['Sen, Meera', 'Says "hi"\nsoon'],
      ['Tara', ''],
    ]);
  });

  it('round-trips a guest list and reports bad rows', () => {
    const csv = guestsToCsv([
      {
        id: 'g1',
        name: 'Meera Sen',
        group: "Bride's family",
        partySize: 2,
        rsvp: 'yes',
        dietary: 'jain',
        contact: '+91 98765 43210',
      },
    ]);
    const { guests, errors } = guestsFromCsv(`${csv}"",Friends,abc,maybe,,,\n`);
    expect(guests[0]).toEqual({
      name: 'Meera Sen',
      group: "Bride's family",
      partySize: 2,
      rsvp: 'yes',
      dietary: 'jain',
      contact: '+91 98765 43210',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(3);
  });

  it('accepts friendly header names and unknown values', () => {
    const { guests } = guestsFromCsv(
      'Guest name,Side,People,Status,Diet\nArjun,Groom,3,Attending?,No onion garlic\n',
    );
    expect(guests[0]).toMatchObject({
      name: 'Arjun',
      group: 'Groom',
      partySize: 3,
      rsvp: 'pending',
      dietary: 'no_onion_garlic',
    });
  });

  it('explains missing columns and empty files', () => {
    expect(guestsFromCsv('').errors[0]?.message).toBe('The file is empty');
    expect(guestsFromCsv('Phone\n123\n').errors[0]?.message).toBe('Add a "Name" column');
  });
});

describe('share snapshots', () => {
  const plan = {
    ...weddingPlan(),
    guests: [
      {
        id: 'g1',
        name: 'Meera Sen',
        partySize: 2,
        rsvp: 'yes' as const,
        contact: 'meera@example.com',
      },
    ],
    vendors: weddingPlan().vendors.map((v, i) =>
      i === 0
        ? {
            ...v,
            options: [{ id: 'o1', name: 'Hall A', phone: '+91 98765 43210', quote: 1 }],
            notes: 'private',
          }
        : v,
    ),
  };

  it('strips guests, contacts and private notes', () => {
    const snapshot = toShareSnapshot(plan, {
      includeBudget: true,
      now: '2026-10-23T10:00:00.000Z',
    });
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('Meera');
    expect(json).not.toContain('98765');
    expect(json).not.toContain('private');
    expect(snapshot.guests).toEqual({ confirmed: 2, expected: 2 });
    expect(SharedPlan.safeParse(snapshot).success).toBe(true);
  });

  it('can leave the budget out and falls back to the brief headcount', () => {
    const snapshot = toShareSnapshot(weddingPlan(), {
      includeBudget: false,
      now: '2026-10-23T10:00:00.000Z',
    });
    expect(snapshot.budget).toBeUndefined();
    expect(snapshot.guests.expected).toBe(300);
  });

  it('only accepts 22-character share tokens', () => {
    expect(ShareId.safeParse('aZ09_-aZ09_-aZ09_-aZ09').success).toBe(true);
    expect(ShareId.safeParse('short').success).toBe(false);
  });
});

describe('share snapshots with ideas and risks', () => {
  it('keeps ideas, risks and the run sheet but drops IDs and owners', () => {
    const base = weddingPlan();
    const plan = {
      ...base,
      ideas: [
        {
          id: 'idea_1',
          kind: 'food' as const,
          title: 'Mishti doi bar',
          description: 'Clay pots.',
          favorite: true,
          source: 'ai' as const,
        },
      ],
      risks: [
        {
          id: 'risk_1',
          title: 'Fog delays',
          likelihood: 'medium' as const,
          mitigation: 'Share buffers.',
          source: 'ai' as const,
        },
      ],
      schedule: base.schedule.map((s) => ({ ...s, owner: 'Uncle Bapi' })),
    };
    const snapshot = toShareSnapshot(plan, {
      includeBudget: true,
      now: '2026-10-23T10:00:00.000Z',
    });
    expect(snapshot.ideas).toEqual([
      { kind: 'food', title: 'Mishti doi bar', description: 'Clay pots.' },
    ]);
    expect(snapshot.risks).toEqual([
      { title: 'Fog delays', likelihood: 'medium', mitigation: 'Share buffers.' },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('Uncle Bapi');
    expect(SharedPlan.safeParse(snapshot).success).toBe(true);
  });
});
