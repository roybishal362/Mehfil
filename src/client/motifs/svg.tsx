/**
 * Shared SVG helpers. Gradients used by many motifs are defined once in <SharedDefs> (rendered
 * at the app root) and referenced by id, which keeps the DOM small.
 */
import { useId } from 'react';

/** A React id that is safe inside SVG `url(#...)` references. */
export function useSvgId(prefix = 'm'): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export const LANTERN_COLORS = [
  ['#F28C28', '#B4370E'],
  ['#E0457B', '#7A0F3A'],
  ['#F7B500', '#B4470B'],
  ['#9B7BF0', '#3B1E86'],
] as const;

export const lanternGradient = (index: number) => `m-lantern-${String(index)}`;
export const lanternHalo = (index: number) => `m-lantern-halo-${String(index)}`;

/** Gradients shared by the diyas, lanterns, seals and rangolis. Render once. */
export function SharedDefs() {
  return (
    <svg className="svg-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <radialGradient id="m-diya-glow" r="50%">
          <stop offset="0" stopColor="#FFD27A" stopOpacity=".85" />
          <stop offset="1" stopColor="#FF9A3C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="m-diya-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E08A4F" />
          <stop offset=".6" stopColor="#A9452A" />
          <stop offset="1" stopColor="#6B2412" />
        </linearGradient>
        <radialGradient id="m-brand-glow" r="50%">
          <stop offset="0" stopColor="#FFD27A" stopOpacity=".9" />
          <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="m-bulb" r="50%">
          <stop offset="0" stopColor="#FFE9B0" stopOpacity="1" />
          <stop offset=".35" stopColor="#F5B942" stopOpacity=".55" />
          <stop offset="1" stopColor="#F5B942" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="m-seal" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#FFF3C9" />
          <stop offset=".45" stopColor="#E9C26A" />
          <stop offset="1" stopColor="#9C6B1E" />
        </radialGradient>
        <radialGradient id="m-rangoli-halo" r="50%">
          <stop offset="0" stopColor="#F28C28" stopOpacity=".35" />
          <stop offset=".6" stopColor="#9B2C4C" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {LANTERN_COLORS.map(([light, dark], index) => (
          <g key={light}>
            <radialGradient id={lanternGradient(index)} cx="50%" cy="45%" r="60%">
              <stop offset="0" stopColor="#FFF1C2" />
              <stop offset=".35" stopColor={light} />
              <stop offset="1" stopColor={dark} />
            </radialGradient>
            <radialGradient id={lanternHalo(index)} r="50%">
              <stop offset="0" stopColor={light} stopOpacity=".55" />
              <stop offset="1" stopColor={light} stopOpacity="0" />
            </radialGradient>
          </g>
        ))}
      </defs>
    </svg>
  );
}

/** Points on a circle, starting at 12 o'clock and going clockwise. */
export function polar(angleDegrees: number, radius: number): [number, number] {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return [Math.cos(radians) * radius, Math.sin(radians) * radius];
}

export const round1 = (value: number) => Math.round(value * 10) / 10;
