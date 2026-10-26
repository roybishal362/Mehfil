/**
 * The frame details a plan's header takes on beyond its colours and photograph: the red border
 * with a gold thread of a garad sari for Durga Puja, and the lamplight on Diwali's night card.
 * Everything else about an occasion's look comes from its tokens (tokens.css) and its photo.
 */
import type { Mood } from '../../shared/domain/mood';

export function MoodArt({ mood }: { mood: Mood }) {
  if (mood === 'durga') return <span className="planhead-band" aria-hidden="true" />;
  if (mood === 'diwali') return <span className="planhead-glow" aria-hidden="true" />;
  return null;
}
