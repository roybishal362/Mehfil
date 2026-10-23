/**
 * Deterministic answers for the mock provider. They are built from the brief, so demo mode and
 * end-to-end tests show a realistic, personalised plan without calling Gemini.
 */
import type {
  BriefExtraction,
  BudgetSectionData,
  CopilotRequest,
  IdeasSectionData,
  InvitationDraft,
  InvitationRequest,
  TimelineSectionData,
  VendorsSectionData,
} from '../../shared/schemas/ai';
import type { EventBrief } from '../../shared/schemas/brief';
import type { BudgetCategory, VendorCategory } from '../../shared/schemas/categories';
import { getTemplate } from '../../shared/templates';
import { quickParse } from '../../shared/domain/quick-parse';
import { addDays, diffDays } from '../../shared/utils/dates';
import { formatMoney, parseAmount } from '../../shared/utils/money';
import type { ToolResponse } from './provider';

const RATIONALE: Partial<Record<BudgetCategory, string>> = {
  venue: 'A venue that fits the guest count, with step-free access and power backup.',
  catering: 'Food is the heart of the celebration and scales with every guest.',
  decor: 'Decor sets the mood; seasonal flowers keep it affordable.',
  photography: 'Photos and video are the memories that last.',
  attire_beauty: 'Outfits, makeup and mehendi for the hosts and close family.',
  entertainment: 'Music and performances keep guests together.',
  invitations_favors: 'Invitations and small thank-you gifts for every family.',
  rituals: 'Ritual items and the priest or officiant.',
  transport: 'Cars for family and elderly guests.',
  accommodation: 'Rooms for outstation guests.',
  food_cake: 'Snacks, a main meal and the cake.',
  return_gifts: 'A small gift for every child or guest.',
  invitations: 'Digital invitations keep this low.',
  gifts_favors: 'Small favours to thank guests.',
  venue_permits: 'The site, pandal and municipal permissions.',
  sound_lighting: 'Clear sound and safe lighting for the evening programme.',
  performers: 'Local performers for the cultural programme.',
  publicity: 'Posters and social media to bring the neighbourhood in.',
  safety_cleanup: 'First aid, fire safety and a clean-up crew.',
  volunteers: 'Refreshments and T-shirts for volunteers.',
  supplies: 'Plates, cups, bins and signage.',
  contingency: 'A buffer for last-minute surprises.',
};

const PER_GUEST_COMFORT: Readonly<Record<EventBrief['type'], [number, number]>> = {
  wedding: [2500, 4500],
  birthday: [600, 1200],
  community: [150, 400],
  other: [900, 1800],
};

export function mockBriefExtraction(
  text: string,
  today: string,
  uiLanguage: string,
): BriefExtraction {
  const quick = quickParse(text, today);
  const brief: BriefExtraction['brief'] = {
    ...(quick.type ? { type: quick.type } : {}),
    ...(quick.date ? { date: quick.date } : {}),
    ...(quick.city ? { city: quick.city } : {}),
    ...(quick.guestCount ? { guestCount: quick.guestCount } : {}),
    ...(quick.budget ? { budget: quick.budget, currency: quick.currency ?? 'INR' } : {}),
    ...(quick.dietary.length ? { dietary: quick.dietary } : {}),
    language: uiLanguage === 'hi' || uiLanguage === 'bn' ? uiLanguage : 'en',
  };
  if (quick.type && quick.city) {
    const occasion = {
      wedding: 'Wedding',
      birthday: 'Birthday',
      community: 'Celebration',
      other: 'Celebration',
    }[quick.type];
    brief.title = `${quick.city} ${occasion}`;
  }
  if (/wheelchair|elderly|grandparent|accessib/i.test(text)) {
    brief.accessibility = 'Step-free access for elderly guests and wheelchair users';
  }
  const missing = (['type', 'date', 'city', 'guestCount', 'budget'] as const).filter(
    (field) => brief[field] === undefined,
  );
  const questions: Record<(typeof missing)[number], string> = {
    type: 'What are you celebrating: a wedding, a birthday or a community event?',
    date: 'When is the celebration?',
    city: 'Which city will it be in?',
    guestCount: 'Roughly how many guests are you expecting?',
    budget: 'What total budget do you have in mind?',
  };
  const first = missing[0];
  return { brief, missing, ...(first ? { question: questions[first] } : {}) };
}

export function mockBudgetSection(brief: EventBrief): BudgetSectionData {
  const template = getTemplate(brief.type).budget;
  const vegetarian = brief.dietary.includes('vegetarian') || brief.dietary.includes('jain');
  const perGuest = brief.budget / brief.guestCount;
  const [tight, comfortable] = PER_GUEST_COMFORT[brief.type];
  const factor = brief.currency === 'INR' ? 1 : 1 / 80;
  const level =
    perGuest < tight * factor
      ? 'very_tight'
      : perGuest < comfortable * factor
        ? 'tight'
        : 'comfortable';
  const notes = {
    comfortable: 'is a comfortable budget for this celebration.',
    tight: 'is workable, but book the big-ticket vendors early and compare quotes.',
    very_tight: 'is tight; trim the guest list or simplify decor to stay on budget.',
  } as const;
  return {
    allocations: template.map((line) => ({
      category: line.category,
      percent:
        line.category === 'catering' && vegetarian
          ? Math.max(line.min, line.weight - 2)
          : line.weight,
      rationale: RATIONALE[line.category] ?? 'Planned from typical spending for this occasion.',
    })),
    assessment: {
      level,
      note: `About ${formatMoney(Math.round(perGuest), brief.currency)} per guest ${notes[level]}`,
    },
    savingTips: SAVING_TIPS.filter(
      (tip) => !tip.category || template.some((line) => line.category === tip.category),
    ),
  };
}

const SAVING_TIPS: BudgetSectionData['savingTips'] = [
  { tip: 'Choose seasonal, local flowers instead of imported ones.', category: 'decor' },
  { tip: 'Send digital invitations and print only for elders.' },
  { tip: 'Book weekday or off-peak slots for lower venue rates.' },
];

export function mockTimelineSection(brief: EventBrief, today: string): TimelineSectionData {
  const tasks: TimelineSectionData['tasks'] = [];
  if (brief.accessibility || /wheelchair|elderly/i.test(brief.notes ?? '')) {
    tasks.push({
      title: 'Confirm ramps and an accessible washroom at the venue',
      notes: 'Ask for photos and measure door widths.',
      daysBefore: 45,
      priority: 'high',
      category: 'venue',
    });
  }
  if (brief.dietary.includes('jain')) {
    tasks.push({
      title: 'Agree a separate Jain counter with the caterer',
      notes: 'No root vegetables; separate utensils.',
      daysBefore: 30,
      priority: 'medium',
      category: 'vendors',
    });
  }
  if (brief.venueType === 'outdoor') {
    tasks.push({
      title: 'Book a rain backup or waterproof canopy',
      daysBefore: 21,
      priority: 'high',
      category: 'logistics',
    });
  }
  tasks.push({
    title: 'Share a guest-arrival plan and parking map',
    daysBefore: 10,
    priority: 'medium',
    category: 'guests',
  });

  const startDay = getTemplate(brief.type).schedule;
  const preEvent = /haldi|mehendi|mehndi|gaye holud|sangeet/i.test(brief.traditions ?? '');
  const schedule: TimelineSectionData['schedule'] = [
    ...(preEvent && brief.type === 'wedding'
      ? [
          {
            dayOffset: -1,
            time: '16:00',
            durationMinutes: 150,
            title: 'Pre-wedding ceremony with family',
            owner: 'Family',
          },
        ]
      : []),
    ...startDay.map((slot) => ({
      dayOffset: slot.dayOffset,
      time: slot.time,
      durationMinutes: slot.durationMinutes,
      title: slot.title.en,
    })),
  ];

  const month = Number(brief.date.slice(5, 7));
  const risks: TimelineSectionData['risks'] = [
    {
      title: 'A key vendor cancels close to the day',
      likelihood: 'low',
      mitigation:
        'Keep a second quote for the caterer and photographer, and confirm a week before.',
    },
  ];
  if (month >= 6 && month <= 9) {
    risks.push({
      title: 'Monsoon rain disrupts travel',
      likelihood: 'high',
      mitigation: 'Choose a covered venue and share travel buffers with guests.',
    });
  }
  if (diffDays(brief.date, today) < 60) {
    risks.push({
      title: 'Short notice limits vendor choice',
      likelihood: 'medium',
      mitigation: 'Book the venue and caterer this week; keep decor simple.',
    });
  }
  return { tasks, schedule, risks };
}

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

export function mockIdeasSection(brief: EventBrief): IdeasSectionData {
  const veg = brief.dietary.includes('vegetarian') || brief.dietary.includes('jain');
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

export function mockInvitation(request: InvitationRequest): InvitationDraft {
  const { brief } = request;
  const hosts = request.hosts ? `${request.hosts} ` : '';
  const when = `${brief.date}${brief.startTime ? ` at ${brief.startTime}` : ''}`;
  const where = request.venueName ? `${request.venueName}, ${brief.city}` : brief.city;
  return {
    variants: [
      {
        label: 'Warm',
        text: `${hosts}warmly invite you to ${brief.title} on ${when} in ${where}. Your presence will make the day complete.`,
      },
      {
        label: 'Short',
        text: `You're invited! ${brief.title}, ${when}, ${where}. Please let us know if you can come.`,
      },
    ],
  };
}

/** Understands a few common requests so demo mode can show the Copilot proposing real edits. */
export function mockCopilot(request: CopilotRequest): ToolResponse {
  const message = request.message.toLowerCase();
  const guests = /(\d{1,4})\s*(more\s+)?(guests|people)/.exec(message);
  if (guests) {
    const value = Number(guests[1]);
    const guestCount = guests[2] ? request.brief.guestCount + value : value;
    return {
      text: `I'll plan for ${String(guestCount)} guests and keep the total budget the same by trimming flexible lines.`,
      calls: [
        { name: 'set_guest_count', args: { guestCount, keepBudget: true } },
        {
          name: 'add_task',
          args: {
            title: `Confirm the venue holds ${String(guestCount)} guests`,
            dueDate: addDays(request.today, 7),
            priority: 'high',
          },
        },
      ],
    };
  }
  const cut =
    /(?:cut|reduce|save|lower)\D{0,20}(\d[\d,.]*\s*(?:lakhs?|crores?|l|k|thousand)?)/.exec(message);
  const amount = cut?.[1] ? parseAmount(cut[1].trim().replace(/[.,]+$/, '')) : null;
  if (amount) {
    const protect = request.plan.budget.lines
      .filter((line) => /food|catering/i.test(line.name) && /food|catering/.test(message))
      .map((line) => line.id);
    return {
      text: `Here is a version ${formatMoney(amount, request.brief.currency)} lower${protect.length ? ' that leaves food untouched' : ''}.`,
      calls: [
        {
          name: 'set_budget_total',
          args: {
            total: Math.max(1000, request.plan.budget.total - amount),
            protectLineIds: protect,
          },
        },
      ],
    };
  }
  const add = /add (?:a )?task:?\s+(.+)/i.exec(request.message);
  if (add?.[1]) {
    return {
      text: 'Added to your timeline for next week.',
      calls: [
        {
          name: 'add_task',
          args: { title: add[1].trim(), dueDate: addDays(request.today, 7), priority: 'medium' },
        },
      ],
    };
  }
  const next = request.plan.tasks
    .filter((t) => t.status !== 'done')
    .slice(0, 3)
    .map((t) => t.title);
  return {
    text: next.length
      ? `This week, focus on: ${next.join('; ')}.`
      : 'Everything on your list is done. Enjoy the celebration!',
    calls: [],
  };
}
