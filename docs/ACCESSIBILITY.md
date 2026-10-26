# Accessibility

Mehfil targets **WCAG 2.2 AA** in both themes, on desktop and phone, in English, Hindi and
Bengali. Automated checks run at three levels, and the patterns below are used throughout.

## Structure and navigation

- Landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, and a skip link to the main
  content.
- After every client-side navigation, focus moves to the new page's heading (or the section's
  heading when only the plan section changed), waiting for lazily loaded pages to render, so
  keyboard and screen-reader users start in the right place (`src/client/app/routing.ts`).
- Plan sections have their own URLs and an accessible tab-style navigation with
  `aria-current="page"`.
- The browser tab title names the page and the plan.

## Forms

- Every control has a visible label; hints and errors are linked with `aria-describedby`, and
  invalid fields set `aria-invalid`.
- The step-by-step form shows an error summary that takes focus and links to each field.
- Amounts can be typed the way people say them ("18 lakh", "1.5 crore", "50k"); the formatted
  value is kept on focus and Escape cancels an edit.

## Dynamic content

- AI progress, saved changes and undo are announced through a polite live region; toasts carry an
  Undo button where an action can be reversed.
- Dialogs use the native `<dialog>` element: focus is trapped inside, Escape closes them and focus
  returns to the button that opened them.
- Status is never shown by colour alone: pills, checkboxes and badges always carry text or icons.
- Charts are given a text equivalent, and photographs are decoration: every photo has empty alt
  text, because the words beside it carry its meaning. The home page's arch of photographs is one
  labelled picture, and a plan's progress is written out in words beside its progress line (with
  each part's own progress for screen readers).
- Celebration moments are decorative and hidden from assistive technology. They never take
  focus; Skip, a click or any key ends one at once, so keyboard focus never lands behind it, and
  if focus was on its Skip button it returns to the plan's heading.

## Visual

- Colour tokens are tested in code for at least 4.5:1 contrast for text and 3:1 for UI elements,
  in the day and night themes and in every occasion's colours, including the Diwali header's own
  night colours (`src/client/styles/tokens.test.ts`).
- Focus rings are visible on every interactive element.
- Pages reflow without sideways scrolling down to 320 CSS pixels; wide tables scroll inside their
  own box. The browser tests check this at the device's width, 390 and 320 pixels.
- Main and icon buttons are at least 44 by 44 pixels. Compact controls (filters, the language
  switch, disclosure toggles and inline fields) are at least 32 pixels tall, above the 24-pixel
  minimum in WCAG 2.2.
- The home page's photographs turn every five seconds only after the page has loaded, and a
  Pause button (a toggle with `aria-pressed`) stops them, as WCAG 2.2.2 asks of anything that
  moves for more than five seconds. Looping decorations stop entirely with
  `prefers-reduced-motion`, which also leaves the arch on one still photograph. With reduced motion there are also no page cross-fades, no counting
  numbers, no scroll reveals and no celebration moments (they never play by themselves, and the
  replay button is hidden). A forced-colours mode style keeps controls visible in Windows high
  contrast.

## Language

- The interface is available in English, Hindi and Bengali; `<html lang>` follows the choice, and
  AI-written text carries the `lang` of the language it was written in, so screen readers switch
  pronunciation. Text in Urdu or Arabic is also set right-to-left (`dir="rtl"`).
- Language names in the switcher are written in their own script and marked with `lang`, and
  Hindi or Bengali words inside text in another language (such as "in English, हिन्दी or
  বাংলা") carry their own `lang` too (WCAG 3.1.2, `src/client/i18n/MixedScript.tsx`).
- Typography is tuned per script: Devanagari and Bengali get more line height and no letter
  spacing on headings.

## Testing

| Level      | What runs                                                                                                                                     | Where                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Components | axe-core (via jest-axe) on every page and section, both themes                                                                                | `src/client/**/*.test.tsx` |
| Browser    | axe-core with the WCAG 2.2 A/AA rule set on every page, plus a no-sideways-scrolling check at 390 and 320 px, on desktop Chrome and a Pixel 7 | `e2e/*.spec.ts`            |
| Keyboard   | A full journey without a mouse: skip link, describing a celebration, focus landing on the new plan's heading                                  | `e2e/keyboard.spec.ts`     |
| Motion     | A celebration moment ends on any key and leaves the page accessible; with reduced motion none plays and no replay is offered                  | `e2e/moments.spec.ts`      |
| Lighthouse | Accessibility score 100 required in CI                                                                                                        | `lighthouserc.json`        |

Automated tools catch only part of what matters, so changes are also checked by hand with the
keyboard and a screen reader.
