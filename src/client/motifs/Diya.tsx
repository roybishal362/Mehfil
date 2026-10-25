/**
 * Diyas: the clay lamps that measure a plan's progress (one per part, lit once that part has
 * begun) and a small lamp used as an icon.
 */
import type { PlanPart } from '../features/plan/present';

/** One diya; unlit, only the bowl is drawn. */
export function Diya({ lit = true, className = '' }: { lit?: boolean; className?: string }) {
  return (
    <svg
      className={`diya ${lit ? 'diya--lit' : 'diya--unlit'} ${className}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {lit ? (
        <use href="#m-diya" width="40" height="40" />
      ) : (
        <path
          d="M4 24c3 8 9 12 16 12s13-4 16-12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

/** A row of diyas, one per part of the plan, with the whole picture as its accessible name. */
export function DiyaRow({
  parts,
  label,
  className = '',
}: {
  parts: readonly PlanPart[];
  label: string;
  className?: string;
}) {
  return (
    <div className={`diya-row ${className}`} role="img" aria-label={label}>
      {parts.map((part) => (
        <Diya key={part.key} lit={part.value > 0} />
      ))}
    </div>
  );
}

/** A small lamp for headings (the Copilot, "Next up"). */
export function LampIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="lamp-icon"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <use href="#m-diya" width="40" height="40" />
    </svg>
  );
}
