/**
 * Diyas: the clay lamps that measure a plan's progress (one per part, lit once that part has
 * begun), and the lamp beside the Copilot's name. Drawn with the 3D diya; an unlit lamp is the
 * same lamp, greyed and faded (motifs.css).
 */
import { Art } from '../art/Art';
import type { PlanPart } from '../features/plan/present';

export function Diya({ lit = true, size = 26 }: { lit?: boolean; size?: number }) {
  return <Art name="diya" size={size} className={lit ? 'diya diya--lit' : 'diya diya--unlit'} />;
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

/** A lamp for headings (the Copilot). */
export function LampIcon({ size = 30 }: { size?: number }) {
  return <Art name="diya" size={size} className="lamp-icon" />;
}
