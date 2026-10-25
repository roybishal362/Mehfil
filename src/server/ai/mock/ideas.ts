/** Demo ideas: themes per occasion, and refined ideas that follow what was asked. */
import type { IdeasSectionData } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import { formatMoney } from '../../../shared/utils/money';

const THEMES: Readonly<Record<EventBrief['type'], IdeasSectionData['themes']>> = {
  wedding: [
    {
      title: 'Lamps and marigolds',
      description:
        'Brass diyas, marigold torans and white rangoli at the entrance; light every lamp together before the ceremony.',
      palette: ['#B91C1C', '#F59E0B', '#FEF3C7', '#14532D'],
    },
    {
      title: 'Garden of whites',
      description:
        'Tuberose and jasmine, ivory drapes and soft fairy lights; a quiet, fragrant evening.',
      palette: ['#FFFDF5', '#E7D7B5', '#6B8F71'],
    },
  ],
  birthday: [
    {
      title: 'Little explorers',
      description:
        'Maps, binoculars and a treasure hunt across the room; every child goes home with a badge.',
      palette: ['#0E7490', '#F59E0B', '#FDE68A', '#166534'],
    },
    {
      title: 'Rainbow picnic',
      description:
        'Bright mats, paper lanterns and a cake in stripes; a garden party feel indoors.',
      palette: ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6'],
    },
  ],
  community: [
    {
      title: 'Neighbourhood lights',
      description: 'Paper lanterns over every lane and a shared lamp-lighting to open the evening.',
      palette: ['#F59E0B', '#7C2D12', '#FEF3C7'],
    },
    {
      title: 'Folk and flavours',
      description: 'Stalls from local home cooks and a stage for folk dance groups.',
      palette: ['#B45309', '#15803D', '#FDE68A'],
    },
  ],
  other: [
    {
      title: 'Golden hour',
      description: 'Warm amber lights, candles and a photo wall of memories through the years.',
      palette: ['#B45309', '#FCD34D', '#FFFBEB'],
    },
    {
      title: 'Simple and green',
      description: 'Potted plants as centrepieces that guests take home.',
      palette: ['#166534', '#BBF7D0', '#FAFAF9'],
    },
  ],
};

type MockIdea = IdeasSectionData['ideas'][number];

/** Ideas that answer a refine request, so demo mode visibly follows what was asked. */
const REFINED_IDEAS: readonly (readonly [RegExp, readonly MockIdea[]])[] = [
  [
    /budget|cheap|afford|save|saving|किफ़ायती|सस्त|কম খরচ/i,
    [
      {
        kind: 'decor',
        title: 'Marigolds and diyas, no imports',
        description:
          'Seasonal marigold strings and clay diyas cost a fraction of imported flowers and look richer.',
        costLevel: 'low',
      },
      {
        kind: 'food',
        title: 'Live counters instead of a big buffet',
        description:
          'Two or three live counters feel generous while cutting waste and the per-plate cost.',
        costLevel: 'low',
      },
      {
        kind: 'entertainment',
        title: 'Family talent hour',
        description: 'Cousins and friends perform; a simple sound system replaces a hired band.',
        costLevel: 'low',
      },
      {
        kind: 'activity',
        title: 'DIY photo corner',
        description: 'A painted backdrop and a phone tripod instead of a booth rental.',
        costLevel: 'low',
      },
      {
        kind: 'favor',
        title: 'Seed packets as favours',
        description: 'Tulsi or marigold seeds in printed envelopes: cheap, light and memorable.',
        costLevel: 'low',
      },
      {
        kind: 'personal',
        title: 'Handwritten welcome boards',
        description: 'A calligraphy-loving relative writes the welcome and menu boards.',
        costLevel: 'low',
      },
    ],
  ],
  [
    /eco|green|sustain|plastic|पर्यावरण|পরিবেশ/i,
    [
      {
        kind: 'sustainability',
        title: 'Banana-leaf and sal-leaf plates',
        description:
          'Traditional leaf plates and kulhads replace plastic and look beautiful on the table.',
        costLevel: 'low',
      },
      {
        kind: 'decor',
        title: 'Potted plants instead of cut flowers',
        description: 'Potted marigolds and jasmine that live on after the celebration.',
        costLevel: 'medium',
      },
      {
        kind: 'sustainability',
        title: 'Food rescue partner',
        description: 'Arrange for a local food bank to collect untouched food the same night.',
        costLevel: 'low',
      },
      {
        kind: 'favor',
        title: 'Jute bags with local sweets',
        description: 'Reusable jute bags instead of boxes and cellophane.',
        costLevel: 'low',
      },
      {
        kind: 'activity',
        title: 'Plant-a-tree corner',
        description: 'Guests plant saplings with name tags to remember the day.',
        costLevel: 'low',
      },
      {
        kind: 'decor',
        title: 'Lanterns you keep',
        description: 'Paper kandils and fairy lights you can reuse at every Diwali.',
        costLevel: 'low',
      },
    ],
  ],
  [
    /child|kid|बच्च|ছোট|শিশু/i,
    [
      {
        kind: 'activity',
        title: 'Rangoli colouring table',
        description: 'Big printed rangoli outlines and safe powder colours for children.',
        costLevel: 'low',
      },
      {
        kind: 'entertainment',
        title: 'Puppet show',
        description: 'A half-hour kathputli show while the grown-ups finish dinner.',
        costLevel: 'medium',
      },
      {
        kind: 'food',
        title: 'Mini plates for little guests',
        description: 'Smaller portions, less spice and a sweet treat at the end.',
        costLevel: 'low',
      },
      {
        kind: 'activity',
        title: 'Treasure hunt',
        description: 'Clues hidden around the venue lead to a box of small gifts.',
        costLevel: 'low',
      },
      {
        kind: 'personal',
        title: 'A quiet corner',
        description:
          'Floor cushions and books where tired children can rest within sight of parents.',
        costLevel: 'low',
      },
      {
        kind: 'favor',
        title: 'Crayon-and-sticker kits',
        description: 'Small kits that keep children busy on the way home.',
        costLevel: 'low',
      },
    ],
  ],
  [
    /food|regional|cuisine|street|व्यंजन|खाना|খাবার/i,
    [
      {
        kind: 'food',
        title: 'Regional street-food lane',
        description: 'Phuchka, chaat and kathi-roll stalls with cooks from the neighbourhood.',
        costLevel: 'medium',
      },
      {
        kind: 'food',
        title: 'Home-recipe dessert',
        description: "One dessert from a grandparent's recipe, with the story on a card.",
        costLevel: 'low',
      },
      {
        kind: 'food',
        title: 'Seasonal welcome drink',
        description: 'Aam panna, sherbet or masala chai depending on the season.',
        costLevel: 'low',
      },
      {
        kind: 'decor',
        title: 'Brass and clay serveware',
        description: 'Traditional serveware that makes simple food feel festive.',
        costLevel: 'medium',
      },
      {
        kind: 'personal',
        title: 'Menu in two languages',
        description: 'Printed in English and the family language, with dietary labels.',
        costLevel: 'low',
      },
      {
        kind: 'favor',
        title: 'Spice-mix favours',
        description: 'A small jar of the family garam masala or panch phoron.',
        costLevel: 'low',
      },
    ],
  ],
];

export function mockIdeasSection(brief: EventBrief, instruction?: string): IdeasSectionData {
  const veg = brief.dietary.includes('vegetarian') || brief.dietary.includes('jain');
  const refined = instruction
    ? (REFINED_IDEAS.find(([pattern]) => pattern.test(instruction))?.[1] ?? REFINED_IDEAS[0]?.[1])
    : undefined;
  if (refined) {
    return {
      summary:
        `Fresh ideas for ${brief.title}, following your request: ${instruction ?? ''}`.trim(),
      themes: THEMES[brief.type],
      ideas: [...refined],
    };
  }
  return {
    summary: `A warm ${brief.type === 'community' ? 'community celebration' : brief.type} in ${brief.city} for ${String(brief.guestCount)} guests, planned around what matters most to you and within ${formatMoney(brief.budget, brief.currency)}.`,
    themes: THEMES[brief.type],
    ideas: [
      {
        kind: 'food',
        title: veg ? 'Regional vegetarian thali' : 'Regional speciality counter',
        description: `A counter with dishes from ${brief.city}, labelled for allergies and diets.`,
        costLevel: 'medium',
      },
      {
        kind: 'decor',
        title: 'Welcome entrance',
        description: 'Flowers and lights at the entrance where guests take their first photos.',
        costLevel: 'medium',
      },
      {
        kind: 'entertainment',
        title: 'Live music for the first hour',
        description: 'Acoustic or folk musicians while guests arrive and settle.',
        costLevel: 'medium',
      },
      {
        kind: 'activity',
        title: 'Memory wall',
        description: 'Guests pin a photo or a wish on a board to keep afterwards.',
        costLevel: 'low',
      },
      {
        kind: 'personal',
        title: 'Seats for elders near the action',
        description: 'Comfortable, step-free seating close to the stage for grandparents.',
        costLevel: 'low',
      },
      {
        kind: 'favor',
        title: 'Local sweets to take home',
        description: 'Small boxes of a favourite local sweet with a thank-you note.',
        costLevel: 'low',
      },
      {
        kind: 'sustainability',
        title: 'No single-use plastic',
        description: 'Steel tumblers, leaf plates and clearly marked recycling bins.',
        costLevel: 'low',
      },
    ],
  };
}
