/** Demo vendor advice: questions to ask and red flags for each category. */
import type { VendorsSectionData } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import type { VendorCategory } from '../../../shared/schemas/categories';
import { getTemplate } from '../../../shared/templates';

const VENDOR_QUESTIONS: Partial<Record<VendorCategory, [string[], string[], string]>> = {
  venue: [
    [
      'What is the seated capacity and the power-backup plan?',
      'Is there step-free access and an accessible washroom?',
      'What is included: chairs, lighting, cleaning?',
    ],
    ['Extra charges that appear only at the final bill'],
    'Visit at the same time of day as your event to judge light and noise.',
  ],
  caterer: [
    [
      'Can we taste the full menu before booking?',
      'How many service staff per 100 guests?',
      'How do you handle Jain or vegan dishes?',
    ],
    ['No tasting offered before the advance payment'],
    'Agree the per-plate price and the minimum guarantee in writing.',
  ],
  photographer: [
    [
      'Can we see a full album from a similar event?',
      'How many photos and when will we receive them?',
      'Is a second shooter included?',
    ],
    ['Only highlight reels, never complete albums'],
    'Share a shot list of family members you must not miss.',
  ],
  decorator: [
    [
      'Can you show photos of real set-ups, not renders?',
      'Which flowers are in season on our date?',
    ],
    ['A quote without an itemised list'],
    'Ask for a small sample of the main flower arrangement.',
  ],
};

export function mockVendorsSection(brief: EventBrief): VendorsSectionData {
  const categories = getTemplate(brief.type).vendors.map((v) => v.category);
  return {
    vendors: categories.map((category) => {
      const preset = VENDOR_QUESTIONS[category];
      return {
        category,
        questions: preset?.[0] ?? [
          'What exactly is included in the quote?',
          'What is your cancellation policy?',
        ],
        redFlags: preset?.[1] ?? ['Asking for full payment upfront'],
        tip: preset?.[2] ?? `Compare at least two quotes for ${brief.city}.`,
      };
    }),
    extraCategories:
      brief.type === 'wedding'
        ? [
            {
              label: 'Live folk musicians',
              reason: 'Traditional music during the ceremony makes it memorable.',
              priority: 'low',
              daysBefore: 60,
            },
          ]
        : [],
  };
}
