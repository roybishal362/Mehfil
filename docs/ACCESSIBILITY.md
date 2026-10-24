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
- Charts and decorative drawings are either hidden from assistive technology or given a text
  equivalent (the plan rangoli reads out each part's progress).

## Visual

- Colour tokens are tested in code for at least 4.5:1 contrast for text and 3:1 for UI elements,
  in the night and day themes (`src/client/styles/tokens.test.ts`).
- Focus rings are visible on every interactive element.
- Pages reflow without sideways scrolling down to 320 CSS pixels; wide tables scroll inside their
  own box. The browser tests check this at the device's width, 390 and 320 pixels.
- Main and icon buttons are at least 44 by 44 pixels. Compact controls (filters, the language
  switch, disclosure toggles and inline fields) are at least 32 pixels tall, above the 24-pixel
  minimum in WCAG 2.2.
- Looping decorations wait until the page has loaded and stop entirely with
  `prefers-reduced-motion`; a forced-colours mode style keeps controls visible in Windows high
  contrast.

## Language

- The interface is available in English, Hindi and Bengali; `<html lang>` follows the choice, and
  AI-written text carries the `lang` of the language it was written in, so screen readers switch
  pronunciation.
- Language names in the switcher are written in their own script and marked with `lang`.
- Typography is tuned per script: Devanagari and Bengali get more line height and no letter
  spacing on headings.

## Testing

| Level      | What runs                                                                                                                                     | Where                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Components | axe-core (via jest-axe) on every page and section, both themes                                                                                | `src/client/**/*.test.tsx` |
| Browser    | axe-core with the WCAG 2.2 A/AA rule set on every page, plus a no-sideways-scrolling check at 390 and 320 px, on desktop Chrome and a Pixel 7 | `e2e/*.spec.ts`            |
| Keyboard   | A full journey without a mouse: skip link, describing a celebration, focus landing on the new plan's heading                                  | `e2e/keyboard.spec.ts`     |
| Lighthouse | Accessibility score 100 required in CI                                                                                                        | `lighthouserc.json`        |

Automated tools catch only part of what matters, so changes are also checked by hand with the
keyboard and a screen reader.
