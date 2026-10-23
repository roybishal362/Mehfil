/**
 * Colour contrast of the design tokens, checked against WCAG 2.2: at least 4.5:1 for text and
 * 3:1 for control outlines, in both the night and the day theme.
 */
import { describe, expect, it } from 'vitest';
import css from './tokens.css?raw';

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('\n}', start));
  return new Map(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1] ?? '',
      (match[2] ?? '').trim(),
    ]),
  );
}

const night = block(':root');
const day = new Map([...night, ...block(":root[data-theme='day']")]);

type Rgba = [number, number, number, number];

function parse(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex?.[1]) {
    const value = parseInt(hex[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(color);
  if (!rgb) throw new Error(`Unsupported colour ${color}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] ? Number(rgb[4]) : 1];
}

/** A translucent colour composited over an opaque background. */
function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string, theme: Map<string, string>): number {
  const bg = parse(theme.get(background) ?? background);
  const fg = over(parse(theme.get(foreground) ?? foreground), bg);
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const THEMES = [
  ['night', night],
  ['day', day],
] as const;

describe.each(THEMES)('%s theme', (_name, theme) => {
  it.each([
    ['ink', 'page'],
    ['ink', 'surface'],
    ['ink-2', 'surface'],
    ['muted', 'page'],
    ['muted', 'surface'],
    ['label', 'page'],
    ['label', 'surface'],
    ['ai-ink', 'surface'],
    ['danger-ink', 'surface'],
    ['warn-ink', 'surface'],
    ['ok-ink', 'surface'],
  ])('%s text on %s meets 4.5:1', (foreground, background) => {
    expect(contrast(foreground, background, theme)).toBeGreaterThanOrEqual(4.5);
  });

  it('control outlines and the focus ring meet 3:1', () => {
    expect(contrast('control-line', 'page', theme)).toBeGreaterThanOrEqual(3);
    expect(contrast('control-line', 'surface', theme)).toBeGreaterThanOrEqual(3);
    expect(contrast('focus', 'page', theme)).toBeGreaterThanOrEqual(3);
  });
});

it('reads tokens from both theme blocks', () => {
  expect(night.get('page')).toBe('#100a24');
  expect(day.get('page')).toBe('#fbf4e7');
});
