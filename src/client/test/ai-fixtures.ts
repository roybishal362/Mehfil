/** Small, schema-valid AI answers for client tests (the server tests cover the real fixtures). */
import type {
  BudgetSectionData,
  IdeasSectionData,
  TimelineSectionData,
  VendorsSectionData,
} from '../../shared/schemas/ai';

export const META = { model: 'gemini-test', mode: 'gemini', cached: false, ms: 120 } as const;

export const budgetData: BudgetSectionData = {
  allocations: [
    { category: 'venue', percent: 24, rationale: 'Kolkata banquet halls book early.' },
    { category: 'catering', percent: 30, rationale: 'Three hundred guests, mostly vegetarian.' },
  ],
  assessment: { level: 'comfortable', note: 'About ₹6,000 per guest is comfortable.' },
  savingTips: [{ tip: 'Choose seasonal flowers.', category: 'decor' }],
};

export const timelineData: TimelineSectionData = {
  tasks: [
    {
      title: 'Book the dhaki players',
      notes: 'Popular troupes book out by December.',
      daysBefore: 60,
      priority: 'medium',
      category: 'vendors',
    },
  ],
  schedule: [
    { dayOffset: -1, time: '16:00', durationMinutes: 120, title: 'Gaye Holud with family' },
    { dayOffset: 0, time: '18:30', durationMinutes: 60, title: 'Guests arrive' },
    { dayOffset: 0, time: '19:30', durationMinutes: 120, title: 'Ceremony' },
  ],
  risks: [
    {
      title: 'Evening traffic delays guests',
      likelihood: 'medium',
      mitigation: 'Share a map and parking notes with the invitation.',
    },
  ],
};

export const vendorsData: VendorsSectionData = {
  vendors: [
    {
      category: 'venue',
      questions: ['Is there step-free access?'],
      redFlags: ['No written contract'],
      tip: 'Visit at the same hour as your event.',
    },
  ],
  extraCategories: [
    {
      label: 'Dhaki players',
      reason: 'Drums for the baran ritual.',
      priority: 'medium',
      daysBefore: 45,
    },
  ],
};

export const ideasData: IdeasSectionData = {
  summary: 'A warm Bengali wedding lit by diyas.',
  themes: [
    {
      title: 'Shubho Alo',
      description: 'Brass diyas and marigolds.',
      palette: ['#B91C1C', '#F59E0B', '#FEF3C7'],
    },
    {
      title: 'Garden of whites',
      description: 'Tuberose and jasmine.',
      palette: ['#FFFFFF', '#E8DCC0', '#6E9C7A'],
    },
  ],
  ideas: [
    {
      kind: 'food',
      title: 'Mishti doi bar',
      description: 'Clay pots of sweet yoghurt.',
      costLevel: 'low',
    },
    {
      kind: 'decor',
      title: 'Alpana at the gate',
      description: 'White rice-paste patterns.',
      costLevel: 'low',
    },
    {
      kind: 'entertainment',
      title: 'Baul singers',
      description: 'Folk music while guests arrive.',
      costLevel: 'medium',
    },
    {
      kind: 'activity',
      title: 'Memory wall',
      description: 'Photos and wishes on a board.',
      costLevel: 'low',
    },
    {
      kind: 'personal',
      title: 'Seats for elders',
      description: 'Step-free seating near the mandap.',
      costLevel: 'low',
    },
    {
      kind: 'favor',
      title: 'Sandesh boxes',
      description: 'Sweets to take home.',
      costLevel: 'low',
    },
  ],
};
