/** Demo timeline additions that react to the brief (accessibility, rituals, short notice). */
import type { TimelineSectionData } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import { getTemplate } from '../../../shared/templates';
import { diffDays } from '../../../shared/utils/dates';

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
