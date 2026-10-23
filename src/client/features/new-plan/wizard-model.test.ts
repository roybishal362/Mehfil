import { describe, expect, it } from 'vitest';
import { EventBrief } from '../../../shared/schemas/brief';
import {
  draftFromValues,
  validateAll,
  validateStep,
  valuesFromDraft,
  type WizardValues,
} from './wizard-model';

const TODAY = '2026-10-23';

function values(overrides: Partial<WizardValues> = {}): WizardValues {
  return {
    ...valuesFromDraft({}, { language: 'en' }),
    type: 'wedding',
    title: "Ananya & Rohan's Wedding",
    date: '2027-02-14',
    city: 'Kolkata',
    guestCount: '300',
    budget: '18 lakh',
    ...overrides,
  };
}

describe('wizard validation', () => {
  it('accepts a complete form', () => {
    expect(validateAll(values(), TODAY)).toEqual({ errors: {}, step: -1 });
  });

  it('checks only the current step', () => {
    const blank = valuesFromDraft({}, { language: 'en' });
    expect(Object.keys(validateStep(0, blank, TODAY))).toEqual(['type', 'title', 'date', 'city']);
    expect(Object.keys(validateStep(1, blank, TODAY))).toEqual(['guestCount', 'budget']);
    expect(validateStep(2, blank, TODAY)).toEqual({});
  });

  it.each([
    [{ date: '2026-10-22' }, 'date', 'date'],
    [{ date: '2031-01-01' }, 'date', 'dateTooFar'],
    [{ endDate: '2027-02-13' }, 'endDate', 'endDate'],
    [{ endDate: '2027-03-14' }, 'endDate', 'endDate'],
    [{ guestCount: '0' }, 'guestCount', 'guestCount'],
    [{ guestCount: '12.5' }, 'guestCount', 'guestCount'],
    [{ guestCount: '9000' }, 'guestCount', 'guestCount'],
    [{ budget: 'a lot' }, 'budget', 'budget'],
    [{ budget: '500' }, 'budget', 'budget'],
  ] as const)('flags %o', (change, field, error) => {
    expect(validateAll(values(change), TODAY).errors[field]).toBe(error);
  });

  it('points to the first step with a problem', () => {
    expect(validateAll(values({ budget: '' }), TODAY).step).toBe(1);
    expect(validateAll(values({ city: ' ', budget: '' }), TODAY).step).toBe(0);
  });
});

describe('wizard conversion', () => {
  it('produces a valid brief, reading the budget the way it was typed', () => {
    const draft = draftFromValues(
      values({ styles: ['traditional', 'eco'], traditions: '  Gaye Holud  ', notes: ' ' }),
    );
    expect(draft).toMatchObject({
      budget: 1_800_000,
      guestCount: 300,
      styles: ['Traditional', 'Eco-friendly'],
      traditions: 'Gaye Holud',
    });
    expect(draft).not.toHaveProperty('notes');
    expect(EventBrief.safeParse(draft).success).toBe(true);
  });

  it('prefills from a description draft and suggests a venue for community events', () => {
    const prefilled = valuesFromDraft(
      { type: 'community', city: 'Kolkata', guestCount: 800, styles: ['Traditional', 'Unknown'] },
      { language: 'bn' },
    );
    expect(prefilled).toMatchObject({
      type: 'community',
      city: 'Kolkata',
      guestCount: '800',
      venueType: 'community_hall',
      styles: ['traditional'],
      language: 'bn',
    });
    expect(valuesFromDraft({}, { language: 'en', type: 'birthday' }).type).toBe('birthday');
  });
});
