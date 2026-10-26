# Design: one planner, every occasion

Mehfil means a gathering. The design is a printed invitation with real photographs: ivory paper,
ink, maroon and a little antique gold, with each occasion's colour coming from its photograph.
The home page is calm and neutral; each plan then takes on its own occasion, the way a wedding,
a Durga Puja or a Diwali evening each has its own colours, light and sounds.

Four rules hold everywhere:

1. **Photographs, not pictures.** Real photographs of each festival, never emoji, clip-art or
   cartoon decorations.
2. **The jharokha.** One signature shape, the pointed arch of palace windows and mandaps, frames
   every photograph, with a fine gold outline.
3. **Invitation typography.** Serif headlines, letter-spaced small capitals for labels, thin
   rules, level numerals.
4. **Quiet motion.** Slow crossfades and gentle zooms; nothing bounces, and all of it stops for
   people who ask for less movement.

## Occasions

`moodFor()` (`src/shared/domain/mood.ts`) picks a plan's mood from its type, and for festivals
from its name, kind of celebration and traditions, in English, Hindi or Bengali. The plan page
puts the mood on `<html data-mood>`, so buttons, tabs, links and the focus ring all follow it.

| Mood            | Recognised from                                 | Accent (day) | Photograph in the header             | Celebration moment                                                     |
| --------------- | ----------------------------------------------- | ------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| Neutral         | Anything else; the home page                    | Maroon       | A clay diya's flame                  | None                                                                   |
| Wedding         | The wedding type                                | Sindoor red  | A bride with folded hands, garlanded | The saptapadi by the sacred fire, its light flickering, petals falling |
| Durga Puja      | durga, navratri, pujo, दुर्गा, দুর্গা, শারদ …   | Durga red    | The goddess's face in gold filigree  | Dhakis drum to a beat, then curtains in a garad sari close and part    |
| Ganpati         | ganesh, ganpati, chaturthi, गणेश, গণেশ …        | Saffron      | A brass lamp before the idol         | Marigold petals fall before the lamp                                   |
| Birthday        | The birthday type                               | Rani pink    | Candles on a cake                    | Two cannons fire confetti over the candles                             |
| Diwali          | diwali, deepavali, kali puja, दिवाली, দীপাবলি … | Brass        | A ring of lamps round a rangoli      | Rockets burst over the lamps, on a night card in both themes           |
| Other festivals | Community events                                | Marigold     | Two women celebrating with colour    | Confetti in the colours of gulal over a festival of colours            |

## Photographs

The photographs (`src/client/photos`) are openly licensed works from Wikimedia Commons (its
"Featured" and "Quality" photos were preferred) and Flickr. Each is cropped to a focal point and
given the same light, warm grade so that photos by different people read as one album. Credits
are in `src/client/photos/CREDITS.md`, in the app's footer and in the README.

- **Arch photos** are 4:5, in 240, 480 and up to 720 pixels wide; a small source is never
  enlarged. `Photo` picks the right file with `srcset` and `sizes`, reserves the space with its
  width and height (so nothing shifts), and gives every photo empty alt text: the words beside
  it carry the meaning.
- **The home page's arch** (`HeroArch`) shows the wedding photo in the prerendered page, fetched
  first; the other occasions arrive after the page has loaded and crossfade every five seconds,
  each one fading in over the last. A Pause button stops them. A diya's flame sits in a round
  medallion at the arch's foot.
- **Each plan's header** is the occasion's invitation card: a double border in its colour, the
  greeting in small capitals, the names or title, the countdown, the progress line and the
  photograph in its arch. Durga Puja adds a garad sari's red border with a gold thread; Diwali is
  a night card warmed by lamplight in both themes.
- **The occasion cards, the form's occasion picker and the saved-plan tiles** show the same
  photographs in smaller arches.
- **Moment photos** are 16:10 and load only when a moment plays.

Every file stays under 150 KB and all of them under 1.4 MB (`scripts/photo-budget.test.ts`);
photos full of fine detail (filigree, rangoli) are softened very slightly before encoding.

The progress line measures each plan: six thin segments, one per part (budget, timeline,
vendors, guests, ideas, the day itself), filled once that part has begun, with the same count and
the readiness in words beside them.

## Themes

**Day** is ivory paper with ink, maroon and gold; **Night** is warm ink black with brass and
lamplight. On a first visit the theme follows the device's light or dark setting; after that,
the choice is remembered. Everything is a CSS custom property in `src/client/styles/tokens.css`.

| Token                         | Day                  | Night                | Role                                      |
| ----------------------------- | -------------------- | -------------------- | ----------------------------------------- |
| `--page`, `--surface`         | `#f6efe4`, `#fffcf6` | `#13100d`, `#1b1612` | Page and cards                            |
| `--ink`, `--ink-2`, `--muted` | `#1c1612` …          | `#f4ebdd` …          | Text                                      |
| `--accent`, `--on-accent`     | per mood             | per mood             | Main buttons, tabs, the countdown         |
| `--label`, `--focus`          | per mood             | per mood             | Small capitals and the focus ring         |
| `--frame`, `--head`           | per mood             | per mood             | The header's border and paper             |
| `--arch-mask`, `--arch-line`  | pointed arch, gold   | pointed arch, brass  | Every photograph's window and its outline |
| `--c1` … `--c6`               | chart colours        | chart colours        | Budget lines                              |

`tokens.test.ts` checks every pair that carries text (4.5:1) and every accent and focus ring
(3:1) in both themes and in every mood, including the Diwali header's own night colours.

## Type

- **Cormorant Garamond** for Latin headlines, names and numbers, set with level (lining)
  figures.
- **Eczar** for Devanagari headlines; **Tiro Bangla** for Bengali ones. Their scripts have no
  true italic, so words that are italic in English stay upright in Hindi and Bengali.
- **Mukta** for everything you read and type, in Latin and Devanagari; **Noto Sans Bengali** for
  Bengali text.
- Labels, greetings and kickers are small capitals with wide letter-spacing in English, and
  plain text in Hindi and Bengali.

Fonts are self-hosted and split by script, so a script's font downloads only when it is on
screen. A rupee-only subset (under 1 KB) carries the ₹ sign, and Hindi or Bengali words inside
text in another language use the system's fonts (`MixedScript`). The English home page preloads
the two headline faces (regular and italic) and Mukta.

## Motion

- **The home page's arch** crossfades through the occasions, each photo drifting a little
  closer; a Pause button stops it (WCAG 2.2.2).
- **A plan's photo settles** into its arch once, as the plan opens.
- **Cards rise into view** as you scroll, driven by CSS scroll timelines: no script, nothing can
  flash, and anything on screen at load is already in place.
- **Pages cross-fade** with the View Transitions API (`src/client/app/view-transition.ts`).
- **The countdown counts up** as a plan opens.
- **Celebration moments** (`src/client/features/moments`) play the first time a plan opens on a
  device, for three to four seconds: the photograph opens out of the arch to fill the screen
  while the cheer rises over a dark scrim. They wait briefly for their photograph (and quietly
  skip on a slow connection), end on Skip, a click or any key, return focus to the plan's
  heading, never play for people who ask for reduced motion, and can be replayed with
  "Celebrate again". The Diwali rockets and the confetti are a small canvas particle system with
  seeded, tested physics (`show.ts`).

Nothing that conveys information moves; every animation is decoration on top of content that
reads the same without it.

## Layout rules

- The home page's hero puts the arch beside the headline and the description on a wide screen,
  and right under the headline on a phone.
- Cards sit on a two-column grid on wide screens and one column on phones; the Copilot sits
  beside the plan on desktop and below it on smaller screens.
- Nothing scrolls sideways at any width; wide tables scroll inside their own box, and the plan's
  tabs fade at the edge on phones to show there is more.
- Touch targets are at least 44 pixels, and the focus ring takes the occasion's colour.
