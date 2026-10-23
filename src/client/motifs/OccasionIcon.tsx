/** Line drawings for the four kinds of celebration (mandap, cake, puja diya, gift). */
import type { EventType } from '../../shared/schemas/primitives';

const STROKE: Readonly<Record<EventType, string>> = {
  wedding: '#FF9EC0',
  birthday: '#FFC27A',
  community: '#7FE6E1',
  other: '#C9B6FF',
};

/** Darker strokes keep the drawings visible on the ivory day theme. */
const STROKE_DAY: Readonly<Record<EventType, string>> = {
  wedding: '#B0245A',
  birthday: '#A6520B',
  community: '#11706B',
  other: '#5B3FB8',
};

function Drawing({ type }: { type: EventType }) {
  switch (type) {
    case 'wedding':
      return (
        <>
          <path d="M14 22c0-6 4-10 10-10s10 4 10 10" />
          <path d="M10 40V24h28v16" />
          <path d="M6 40h36" />
          <path d="M24 12V6M20 8l4-4 4 4" />
          <path d="M18 40v-8a6 6 0 0 1 12 0v8" />
          <circle cx="24" cy="26" r="2" />
        </>
      );
    case 'birthday':
      return (
        <>
          <path d="M10 40V26a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v14" />
          <path d="M10 31c3 0 3 3 7 3s4-3 7-3 4 3 7 3 4-3 7-3" />
          <path d="M6 40h36" />
          <path d="M17 22v-6M24 22v-6M31 22v-6" />
          <path d="M17 12c1 1.5 1 2.5 0 4M24 11c1 1.5 1 2.5 0 4M31 12c1 1.5 1 2.5 0 4" />
        </>
      );
    case 'community':
      return (
        <>
          <path d="M24 6c3 4 3 7 0 10-3-3-3-6 0-10z" />
          <path d="M10 26h28l-4 12H14z" />
          <path d="M8 26h32" />
          <path d="M14 42h20" />
          <path d="M6 18l4 3M42 18l-4 3" />
        </>
      );
    case 'other':
      return (
        <>
          <rect x="9" y="20" width="30" height="20" rx="2" />
          <path d="M6 14h36v6H6zM24 14v26" />
          <path d="M24 14c-4 0-8-2-8-5s4-3 8 5c4-8 8-8 8-5s-4 5-8 5z" />
        </>
      );
  }
}

export function OccasionIcon({ type, day = false }: { type: EventType; day?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke={(day ? STROKE_DAY : STROKE)[type]}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Drawing type={type} />
    </svg>
  );
}
