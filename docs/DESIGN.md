# Design: a festival of lights

Mehfil means a gathering: an evening of music, lamps and family. The interface borrows from the
things Indian celebrations are made of, and each motif carries meaning rather than decoration.

| Motif                                                  | Where                          | What it means                                                                                               |
| ------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Night sky, string lights, paper kandils, rising sparks | Home page and the header strip | The evening of the celebration                                                                              |
| A row of lit diyas on a carved ledge                   | Bottom of the home hero        | Welcome                                                                                                     |
| The plan rangoli                                       | Home page and the plan header  | One petal per part of the plan, filled to its progress, with a diya at the tip lit once that part has begun |
| The invitation card                                    | Top of every plan              | The plan is the invitation: calligraphic names, a date block, and a gold seal counting down the days        |
| Jharokha arches                                        | "What are we celebrating?"     | One doorway per kind of occasion                                                                            |

Everything is drawn in code (SVG and CSS), so there are no images to download, and every colour,
gradient and stroke follows the theme tokens.

## Themes

**Night** (the default) is a deep indigo sky with lantern gold; **Day** is ivory paper with the
same gold and jewel tones for bright rooms. Both are defined as CSS custom properties in
`src/client/styles/tokens.css`, and a unit test checks every text and control pair for contrast.

| Token                                                                       | Night                           | Role                                |
| --------------------------------------------------------------------------- | ------------------------------- | ----------------------------------- |
| `--page`                                                                    | `#100a24`                       | Page background                     |
| `--surface`, `--surface-2`                                                  | `#1b1236`, `#241848`            | Cards and panels                    |
| `--ink`, `--ink-2`, `--muted`                                               | `#fbf3e4`, `#e9ddf3`, `#c8bad9` | Text                                |
| `--gold-300`, `--gold-500`                                                  | `#f6d27a`, `#d9a441`            | Labels, focus rings, foil           |
| `--saffron`, `--marigold`, `--rani`, `--peacock`, `--emerald`, `--amethyst` | jewel tones                     | Budget categories, petals, lanterns |

## Type

- **Cormorant Garamond** for headings and formal lines, with lining numerals for every amount
  and date.
- **Great Vibes** for names on invitations and the script word in the headline.
- **Inter** for everything you read and type.
- **Tiro Devanagari Hindi, Tiro Bangla, Noto Sans Devanagari, Noto Sans Bengali** for Hindi and
  Bengali, loaded only when that script is on screen. English pages use the system's fonts for
  the few Hindi and Bengali words they show, and a 1 KB subset of Inter carries the ₹ sign.

## Motion

Lanterns sway, bulbs twinkle, flames flicker and sparks rise, but only after the page has finished
loading and the browser is idle, so the first paint is not competing with animation. All of it
stops under `prefers-reduced-motion`. Nothing that conveys information moves.

## Layout rules

- Cards on a two-column grid on wide screens, one column on phones; the Copilot sits beside the
  plan on desktop and below it on smaller screens.
- Nothing scrolls sideways at any width; wide tables scroll inside their own box.
- Touch targets are at least 44 pixels; focus rings are gold and always visible.
