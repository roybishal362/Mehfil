import type { EventType } from '../schemas/primitives';
import { birthdayTemplate } from './birthday';
import { communityTemplate } from './community';
import { otherTemplate } from './other';
import type { EventTemplate } from './types';
import { weddingTemplate } from './wedding';

const TEMPLATES: Readonly<Record<EventType, EventTemplate>> = {
  wedding: weddingTemplate,
  birthday: birthdayTemplate,
  community: communityTemplate,
  other: otherTemplate,
};

/** The built-in planning template for an event type. */
export function getTemplate(type: EventType): EventTemplate {
  return TEMPLATES[type];
}

export const ALL_TEMPLATES: readonly EventTemplate[] = Object.values(TEMPLATES);
