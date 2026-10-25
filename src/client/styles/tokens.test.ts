/**
 * Colour contrast of the design tokens, checked against WCAG 2.2: at least 4.5:1 for text and
 * 3:1 for control outlines, in both the day and the night theme.
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

const day = block(':root');
const night = new Map([...day, ...block(":root[data-theme='night']")]);

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

function contrast(
  foreground: string,
  background: string,
  theme: Map<string, string>,
  base = 'surface',
): number {
  // A translucent background (a status tint) is seen over the card it sits on.
  const bg = over(parse(theme.get(background) ?? background), parse(theme.get(base) ?? base));
  const fg = over(parse(theme.get(foreground) ?? foreground), bg);
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const THEMES = [
  ['day', day],
  ['night', night],
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
    ['ink-2', 'surface-3'],
    ['muted', 'surface-3'],
    ['on-accent', 'accent'],
    ['ai-ink', 'ai-bg'],
    ['danger-ink', 'danger-bg'],
    ['warn-ink', 'warn-bg'],
    ['ok-ink', 'ok-bg'],
  ])('%s text on %s meets 4.5:1', (foreground, background) => {
    expect(contrast(foreground, background, theme)).toBeGreaterThanOrEqual(4.5);
  });

  it('control outlines and the focus ring meet 3:1', () => {
    expect(contrast('control-line', 'page', theme)).toBeGreaterThanOrEqual(3);
    expect(contrast('control-line', 'surface', theme)).toBeGreaterThanOrEqual(3);
    expect(contrast('focus', 'page', theme)).toBeGreaterThanOrEqual(3);
  });
});

const MOODS = ['neutral', 'wedding', 'birthday', 'durga', 'ganpati', 'diwali', 'utsav'] as const;

/** A theme's tokens with a mood's colours on top, as on <html data-theme data-mood>. */
function withMood(mood: (typeof MOODS)[number], theme: 'day' | 'night'): Map<string, string> {
  const dayMood = new Map([...day, ...block(`[data-mood='${mood}']`)]);
  if (theme === 'day') return dayMood;
  return new Map([
    ...night,
    ...block(`[data-mood='${mood}']`),
    ...block(`:root[data-theme='night'][data-mood='${mood}']`),
  ]);
}

describe.each(MOODS.flatMap((mood) => (['day', 'night'] as const).map((theme) => [mood, theme])))(
  '%s mood, %s theme',
  (mood, theme) => {
    const tokens = withMood(mood as (typeof MOODS)[number], theme as 'day' | 'night');
    // The Diwali header is dark in both themes and sets its own text colours.
    const header =
      mood === 'diwali' ? new Map([...tokens, ...block(".planhead[data-mood='diwali']")]) : tokens;

    it('keeps button text, labels and links readable', () => {
      expect(contrast('on-accent', 'accent', tokens)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('label', 'page', tokens)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('label', 'surface', tokens)).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the accent and the focus ring visible on the page', () => {
      expect(contrast('accent', 'page', tokens)).toBeGreaterThanOrEqual(3);
      expect(contrast('focus', 'page', tokens)).toBeGreaterThanOrEqual(3);
    });

    it('keeps the plan header readable', () => {
      expect(contrast('ink', 'head', header)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('ink-2', 'head', header)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('label', 'head', header)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('accent', 'head', header)).toBeGreaterThanOrEqual(3);
    });
  },
);

it('reads tokens from both theme blocks', () => {
  expect(day.get('page')).toBe('#f6efe4');
  expect(night.get('page')).toBe('#13100d');
});
