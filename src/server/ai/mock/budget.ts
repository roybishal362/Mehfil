/** Demo budget split: template weights with reasons, and an honest per-guest check. */
import type { BudgetSectionData } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import type { BudgetCategory } from '../../../shared/schemas/categories';
import { getTemplate } from '../../../shared/templates';
import { formatMoney } from '../../../shared/utils/money';

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
