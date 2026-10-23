import { describe, expect, it } from 'vitest';
import { foldForMatching } from '../utils/text';
import { quickParse } from './quick-parse';

const TODAY = '2026-10-23';
const parse = (text: string) => quickParse(text, TODAY);

describe('quickParse', () => {
  it('reads a full English description', () => {
    expect(
      parse(
        'A Bengali wedding in Kolkata on 14 Feb 2027 for 300 guests, budget ₹18 lakh, veg and Jain food',
      ),
    ).toEqual({
      type: 'wedding',
      date: '2027-02-14',
      city: 'Kolkata',
      guestCount: 300,
      budget: 1_800_000,
      currency: 'INR',
      dietary: ['jain', 'vegetarian'],
    });
  });

  it('reads Hindi, including a nukta typed either way', () => {
    const precomposed = '\u{95E}रवरी'; // फ़ as one code point
    for (const month of [precomposed, 'फ\u{93C}रवरी', 'फरवरी']) {
      expect(
        parse(`दिल्ली में १४ ${month} २०२७ को शादी, २५० मेहमान, बजट २० लाख, शाकाहारी खाना`),
      ).toEqual({
        type: 'wedding',
        date: '2027-02-14',
        city: 'Delhi',
        guestCount: 250,
        budget: 2_000_000,
        dietary: ['vegetarian'],
      });
    }
  });

  it('reads Bengali with Bengali digits and ordinals', () => {
    expect(
      parse('কলকাতায় ১৪ই ফেব্রুয়ারি ২০২৭ বিয়ে, ৩০০ জন অতিথি, বাজেট ১৮ লাখ, নিরামিষ'),
    ).toEqual({
      type: 'wedding',
      date: '2027-02-14',
      city: 'Kolkata',
      guestCount: 300,
      budget: 1_800_000,
      dietary: ['vegetarian'],
    });
    expect(parse('আমার মেয়ের জন্মদিন ২১শে মার্চ')).toMatchObject({
      type: 'birthday',
      date: '2027-03-21',
    });
  });

  it.each([
    ['Our 25th wedding anniversary', 'other'],
    ['Saraswati puja for the society', 'community'],
    ["My son's 5th bday", 'birthday'],
    ['Mehendi and sangeet nights', 'wedding'],
    ['Annaprashan for our baby', 'other'],
    ['A get-together', undefined],
  ])('classifies "%s" as %s', (text, type) => {
    expect(parse(text).type).toBe(type);
  });

  it.each([
    ['on 2027-02-14', '2027-02-14'],
    ['on 14/02/2027', '2027-02-14'],
    ['on February 14th, 2027', '2027-02-14'],
    ['on the 1st of March', '2027-03-01'],
    ['on 30 Oct', '2026-10-30'],
    ['on 5 March', '2027-03-05'],
    ['in March 2027', undefined],
    ['on 31 Feb 2027', undefined],
    ['on 1 Jan 2020', undefined],
    ['on 2035-01-01', undefined],
    ['getting married soon', undefined],
  ])('reads the date in "%s"', (text, date) => {
    expect(parse(text).date).toBe(date);
  });

  it.each([
    ['A wedding in Pune with guests from Mumbai', 'Pune'],
    ['Reception in New Delhi', 'New Delhi'],
    ['Birthday in Bangalore', 'Bengaluru'],
    ['Durga puja in Darjeeling', 'Darjeeling'],
    ['Party in December in Navi Mumbai', 'Navi Mumbai'],
    ['Party in the evening at home', undefined],
    ['A party in December', undefined],
  ])('reads the city in "%s"', (text, city) => {
    expect(parse(text).city).toBe(city);
  });

  it.each([
    ['for 300+ guests', 300],
    ['around 150-200 people', 200],
    ['headcount: 120', 120],
    ['6000 guests', undefined],
    ['guests 14 Feb', undefined],
  ])('reads the guest count in "%s"', (text, guestCount) => {
    expect(parse(text).guestCount).toBe(guestCount);
  });

  it.each([
    ['budget for 1500 guests is 18 lakh', 1_800_000, undefined],
    ['budget of 2,50,000.', 250_000, undefined],
    ['budget 18-20 lakh', 2_000_000, undefined],
    ['Rs. 5,00,000 in total', 500_000, 'INR'],
    ['about $20k', 20_000, 'USD'],
    ['£15,000 all in', 15_000, 'GBP'],
    ['1.5 crore', 15_000_000, undefined],
    ['on 14 Feb 2027 with 300 guests', undefined, undefined],
    ['₹500 per plate', undefined, undefined],
    ['5 km from the station', undefined, undefined],
  ])('reads the budget in "%s"', (text, budget, currency) => {
    const result = parse(text);
    expect(result.budget).toBe(budget);
    expect(result.currency).toBe(currency);
  });

  it.each([
    ['veg and non-veg buffet', []],
    ['pure veg, no non-veg at all', ['vegetarian']],
    ['vegan and gluten-free', ['vegan', 'gluten_free']],
    ['Jain food with no onion or garlic', ['jain', 'no_onion_garlic']],
    ['halal meat and nut-free desserts', ['halal', 'nut_free']],
    ['lots of vegetables', []],
  ])('reads dietary needs in "%s"', (text, dietary) => {
    expect(parse(text).dietary).toEqual(dietary);
  });

  it('returns nothing for empty text', () => {
    expect(parse('')).toEqual({ dietary: [] });
  });
});

describe('foldForMatching', () => {
  it('treats precomposed and combining nukta forms the same', () => {
    expect(foldForMatching('\u{95E}')).toBe(foldForMatching('फ\u{93C}'));
    expect(foldForMatching('\u{9DF}')).toBe(foldForMatching('য\u{9BC}'));
    expect(foldForMatching('Kolkata')).toBe('Kolkata');
  });
});
