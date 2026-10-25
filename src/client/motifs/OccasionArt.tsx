/** Small pictures for the occasion cards and the step-by-step form's occasion picker. */
import { Cake, Dhak, Kalash, ModakStack } from './festive';

export type OccasionKind =
  'wedding' | 'birthday' | 'durga' | 'ganpati' | 'diwali' | 'community' | 'other';

const MARIGOLDS = [
  { x: 6, y: 18, gold: false },
  { x: 32, y: 10, gold: true },
  { x: 58, y: 18, gold: false },
  { x: 19, y: 40, gold: true },
  { x: 45, y: 40, gold: false },
];

export function OccasionArt({ kind }: { kind: OccasionKind }) {
  switch (kind) {
    case 'wedding':
      return (
        <svg className="occasion-art" viewBox="10 0 100 116" aria-hidden="true" focusable="false">
          <Kalash />
        </svg>
      );
    case 'birthday':
      return (
        <svg className="occasion-art" viewBox="20 36 80 72" aria-hidden="true" focusable="false">
          <Cake />
        </svg>
      );
    case 'durga':
      return <Dhak className="occasion-art" />;
    case 'ganpati':
      return <ModakStack className="occasion-art" />;
    case 'diwali':
      return (
        <svg className="occasion-art" viewBox="0 2 40 36" aria-hidden="true" focusable="false">
          <use href="#m-diya" width="40" height="40" />
        </svg>
      );
    case 'community':
      return (
        <svg className="occasion-art" viewBox="0 0 90 72" aria-hidden="true" focusable="false">
          {MARIGOLDS.map(({ x, y, gold }) => (
            <use
              key={`${String(x)}-${String(y)}`}
              href={gold ? '#m-marigold-gold' : '#m-marigold'}
              x={x}
              y={y}
              width="28"
              height="28"
            />
          ))}
        </svg>
      );
    case 'other':
      return (
        <svg className="occasion-art" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M6 16h28v20H6z" />
            <path d="M4 11h32v5H4z" />
            <path d="M20 11v25" />
            <path d="M20 11c-3-6-10-6-9-1 1 3 6 2 9 1Zm0 0c3-6 10-6 9-1-1 3-6 2-9 1Z" />
          </g>
        </svg>
      );
  }
}
