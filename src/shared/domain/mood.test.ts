import { describe, expect, it } from 'vitest';
import { moodFor } from './mood';

const brief = (
  type: 'wedding' | 'birthday' | 'community' | 'other',
  title: string,
  extra = {},
) => ({
  type,
  title,
  ...extra,
});

describe('moodFor', () => {
  it('goes by the type for weddings and birthdays', () => {
    expect(moodFor(brief('wedding', 'Ananya & Rohan'))).toBe('wedding');
    expect(moodFor(brief('birthday', "Aarav's 7th, dinosaurs"))).toBe('birthday');
    // Even on a festival day, a birthday stays a birthday.
    expect(moodFor(brief('birthday', 'Diwali birthday for Mira'))).toBe('birthday');
  });

  it('recognises festivals from the name, kind and traditions in three languages', () => {
    expect(moodFor(brief('community', 'Ballygunge Sarbojanin', { subtype: 'Durga Puja' }))).toBe(
      'durga',
    );
    expect(moodFor(brief('community', 'দুর্গাপুজো ২০২৭'))).toBe('durga');
    expect(moodFor(brief('community', 'Shivaji Park Ganeshotsav'))).toBe('ganpati');
    expect(moodFor(brief('community', 'गणपति उत्सव'))).toBe('ganpati');
    expect(moodFor(brief('other', "The Mehtas' Diwali night"))).toBe('diwali');
    expect(moodFor(brief('community', 'Para night', { traditions: 'Kali Puja and lamps' }))).toBe(
      'diwali',
    );
    expect(moodFor(brief('other', 'दीपावली मिलन'))).toBe('diwali');
  });

  it('gives other community events the festival look and leaves the rest neutral', () => {
    expect(moodFor(brief('community', 'Green Park Winter Mela'))).toBe('utsav');
    expect(moodFor(brief('other', 'Silver anniversary dinner'))).toBe('neutral');
  });
});
