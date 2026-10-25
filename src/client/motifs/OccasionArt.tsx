/**
 * The picture for an occasion: a main 3D object with a smaller one tucked in front, for the
 * occasion cards, the step-by-step form's occasion picker and the saved-plan tiles.
 */
import type { ArtName } from '../art';
import { Art } from '../art/Art';

export type OccasionKind =
  'wedding' | 'birthday' | 'durga' | 'ganpati' | 'diwali' | 'community' | 'other';

const PICTURES: Readonly<Record<OccasionKind, readonly [ArtName, ArtName]>> = {
  wedding: ['ring', 'marigold'],
  durga: ['lotus', 'hibiscus'],
  ganpati: ['elephant', 'marigold'],
  birthday: ['cake', 'balloon'],
  diwali: ['diya', 'sparkles'],
  community: ['lantern', 'marigold'],
  other: ['gift', 'party-popper'],
};

export function OccasionArt({ kind, size = 72 }: { kind: OccasionKind; size?: number }) {
  const [main, accent] = PICTURES[kind];
  return (
    <span className="occasion-art" aria-hidden="true">
      <Art name={main} size={size} className="occasion-art-main" afterLoad />
      <Art name={accent} size={Math.round(size / 2)} className="occasion-art-accent" afterLoad />
    </span>
  );
}
