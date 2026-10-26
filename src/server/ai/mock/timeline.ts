/** Demo timeline additions that react to the brief (accessibility, rituals, short notice). */
import type { TimelineSectionData } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import { getTemplate } from '../../../shared/templates';
import { diffDays } from '../../../shared/utils/dates';

type DemoTask = TimelineSectionData['tasks'][number];
type DemoSlot = TimelineSectionData['schedule'][number];
type DemoRisk = TimelineSectionData['risks'][number];

/** Tasks that apply only when the brief mentions what they are about. */
const CONDITIONAL_TASKS: readonly (readonly [(brief: EventBrief) => boolean, DemoTask])[] = [
  [
    (brief) => Boolean(brief.accessibility) || /wheelchair|elderly/i.test(brief.notes ?? ''),
    {
      title: 'Confirm ramps and an accessible washroom at the venue',
      notes: 'Ask for photos and measure door widths.',
      daysBefore: 45,
      priority: 'high',
      category: 'venue',
    },
  ],
  [
    (brief) => brief.dietary.includes('jain'),
    {
      title: 'Agree a separate Jain counter with the caterer',
      notes: 'No root vegetables; separate utensils.',
      daysBefore: 30,
      priority: 'medium',
      category: 'vendors',
    },
  ],
  [
    (brief) => brief.venueType === 'outdoor',
    {
      title: 'Book a rain backup or waterproof canopy',
      daysBefore: 21,
      priority: 'high',
      category: 'logistics',
    },
  ],
];

const ARRIVAL_TASK: DemoTask = {
  title: 'Share a guest-arrival plan and parking map',
  daysBefore: 10,
  priority: 'medium',
  category: 'guests',
};

const PRE_WEDDING_SLOT: DemoSlot = {
  dayOffset: -1,
  time: '16:00',
  durationMinutes: 150,
  title: 'Pre-wedding ceremony with family',
  owner: 'Family',
};

function demoTasks(brief: EventBrief): DemoTask[] {
  const fitting = CONDITIONAL_TASKS.filter(([applies]) => applies(brief)).map(([, task]) => task);
  return [...fitting, ARRIVAL_TASK];
}

/** The template's run sheet, with a pre-wedding ceremony the day before when one is named. */
function demoSchedule(brief: EventBrief): DemoSlot[] {
  const preEvent = /haldi|mehendi|mehndi|gaye holud|sangeet/i.test(brief.traditions ?? '');
  const eventDay = getTemplate(brief.type).schedule.map((slot) => ({
    dayOffset: slot.dayOffset,
    time: slot.time,
    durationMinutes: slot.durationMinutes,
    title: slot.title.en,
  }));
  return preEvent && brief.type === 'wedding' ? [PRE_WEDDING_SLOT, ...eventDay] : eventDay;
}

/** A vendor risk always; monsoon and short-notice risks when the date calls for them. */
function demoRisks(brief: EventBrief, today: string): DemoRisk[] {
  const month = Number(brief.date.slice(5, 7));
  const risks: DemoRisk[] = [
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
  return risks;
}

export function mockTimelineSection(brief: EventBrief, today: string): TimelineSectionData {
  return {
    tasks: demoTasks(brief),
    schedule: demoSchedule(brief),
    risks: demoRisks(brief, today),
  };
}
