# Design: one planner, every occasion

Mehfil means a gathering. The home page is calm and neutral, like good stationery: ivory paper,
ink and a little gold. Each plan then takes on its own occasion, the way a wedding, a Durga Puja
or a Diwali evening each has its own colours, decorations and sounds.

## Occasions

`moodFor()` (`src/shared/domain/mood.ts`) picks a plan's mood from its type, and for festivals
from its name, kind of celebration and traditions, in English, Hindi or Bengali. The plan page
puts the mood on `<html data-mood>`, so buttons, tabs, links and the focus ring all follow it.

| Mood            | Recognised from                                 | Accent (day) | The plan's header                                                  | Celebration moment                                                 |
| --------------- | ----------------------------------------------- | ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Neutral         | Anything else; the home page                    | Ink black    | A fine gold rule inside the paper, alpana in the corners           | None                                                               |
| Wedding         | The wedding type                                | Sindoor red  | A red border inside the paper (a lal paar) under a marigold toran  | The couple circles the havan fire for the pheras                   |
| Durga Puja      | durga, navratri, pujo, दुर्गा, দুর্গা, শারদ …   | Durga red    | Bands of a garad sari with a gold thread, the dhak, falling shiuli | A dhaki drums, then curtains in a garad sari part to show the plan |
| Ganpati         | ganesh, ganpati, chaturthi, गणेश, গণেশ …        | Saffron      | A slowly turning sunburst, a stack of modaks, a toran              | The sunburst, modaks and a shower of marigolds                     |
| Birthday        | The birthday type                               | Rani pink    | Bunting and balloons                                               | Balloons rise and two cannons fire confetti                        |
| Diwali          | diwali, deepavali, kali puja, दिवाली, দীপাবলি … | Brass        | A night sky in both themes, string lights and paper kandils        | Rockets burst over a row of diyas lit from the middle outwards     |
| Other festivals | Community events                                | Marigold     | A marigold toran                                                   | A ring of marigolds around a diya                                  |

## Themes

**Day** is ivory paper with ink and gold; **Night** is warm ink black with brass and lamplight.
On a first visit the theme follows the device's light or dark setting; after that, the choice is
remembered. Everything is a CSS custom property in `src/client/styles/tokens.css`.

| Token                         | Day                  | Night                | Role                                 |
| ----------------------------- | -------------------- | -------------------- | ------------------------------------ |
| `--page`, `--surface`         | `#f6efe4`, `#fffcf6` | `#13100d`, `#1b1612` | Page and cards                       |
| `--ink`, `--ink-2`, `--muted` | `#1c1612` …          | `#f4ebdd` …          | Text                                 |
| `--accent`, `--on-accent`     | per mood             | per mood             | Main buttons, tabs, the countdown    |
| `--label`, `--focus`          | per mood             | per mood             | Small accent text and the focus ring |
| `--frame`, `--head`           | per mood             | per mood             | The header's border and paper        |
| `--c1` … `--c6`               | chart colours        | chart colours        | Budget lines and the drawings        |

`tokens.test.ts` checks every pair that carries text (4.5:1) and every accent and focus ring
(3:1) in both themes and in every mood, including the Diwali header's own night colours.

## Type

- **Eczar** (Rosetta) for headlines, names and numbers, with lining figures; it covers Devanagari.
- **Mukta** (Ek Type) for everything you read and type, in Latin and Devanagari.
- **Tiro Bangla** and **Noto Sans Bengali** for Bengali.

Fonts are self-hosted and split by script, so a script's font downloads only when it is on
screen. A rupee-only subset (under 1 KB) carries the ₹ sign, and Hindi or Bengali words inside
text in another language use the system's fonts (`MixedScript`), so the English home page loads
four small font files.

## Motifs

Everything is drawn in code (SVG and CSS), so there are no images to download. Repeated motifs
(marigolds, mango leaves, shiuli, the diya, kandils, modaks and balloons) are SVG symbols defined
once (`src/client/motifs/svg.tsx`) and placed with `<use>`. Colour comes from `currentColor` or
classes, never inline styles, because the Content-Security-Policy forbids them.

A row of diyas measures each plan: one per part (budget, timeline, vendors, guests, ideas, the
day itself), lit once that part has begun, with the whole picture as its accessible name.

## Motion

- **Loops** (garlands sway, bulbs twinkle, flames flicker, shiuli fall) wait until the page has
  loaded, so the first paint is not competing with them, and stop under
  `prefers-reduced-motion`. Pivots use `transform-box: fill-box`, so no element needs an inline
  style.
- **The home page's plate** turns through the occasions in CSS alone.
- **Cards rise into view** as you scroll, driven by CSS scroll timelines: no script, nothing can
  flash, and anything on screen at load is already in place.
- **Pages cross-fade** with the View Transitions API (`src/client/app/view-transition.ts`).
- **The countdown counts up** and the diyas light with a small flare.
- **Celebration moments** (`src/client/features/moments`) play the first time a plan opens on a
  device, for three to four seconds. They are loaded only when they play (about 8 KB), end on
  Skip, a click or any key, return focus to the plan's heading, never play for people who ask for
  reduced motion, and can be replayed with "Celebrate again". The Diwali rockets and birthday
  confetti are a small canvas particle system with seeded, tested physics (`show.ts`).

Nothing that conveys information moves; every animation is decoration on top of content that
reads the same without it.

## Layout rules

- Cards sit on a two-column grid on wide screens and one column on phones; the Copilot sits
  beside the plan on desktop and below it on smaller screens.
- Nothing scrolls sideways at any width; wide tables scroll inside their own box, and the plan's
  tabs fade at the edge on phones to show there is more.
- Touch targets are at least 44 pixels, and the focus ring takes the occasion's colour.
