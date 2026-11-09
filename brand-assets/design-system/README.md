# Conquest design system

The interface around the dungeon. Live version, with previews of every component: [Conquest design system](https://claude.ai/artifact/UaM6VAQ5by6zSwkuJ4qLei) (private until shared). Built from the [Shapeshift colors, Cantina style design canvas](https://claude.ai/artifact/L6M24BzoY4UfwAL2cJpAV3), 2026-11-09.

## Files

| File | What |
| --- | --- |
| `tokens.json` | Every token with a usage note (source of truth) |
| `tokens.css` | The same tokens as CSS variables. Load first. |
| `conquest.css` | The components as `cq-…` classes. Loads the Google fonts. |
| `components/*.md` | Guidelines per component |

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="conquest.css">
<button class="cq-btn">Check in →</button>
```

If you change a token, change it in `tokens.json` and `tokens.css` together.

---

Conquest turns a conference into a dungeon crawl. Every screen has two layers:

- **The dungeon layer** is pixel art that each conference customizes: the map, rooms, bosses (speakers), the attendee's character and in-game effects. Its theme changes per event (Utah, San Francisco, Space, San Fran Sokyo, Pirates) and it comes in 8-bit or 16-bit detail.
- **The Conquest layer** is everything around it: headers, cards, buttons, pickers, XP bars, labels. It never changes between conferences.

This system covers only the Conquest layer. It takes its **colours from Shapeshift** (white, blue, black on a light grey ground) and its **style from Cantina** (hard offset shadows, chunky display type, mono body, controls that press into their shadow).

## Principles

1. **Quiet frame, loud dungeon.** The frame is white, black and one blue so any dungeon theme can sit inside it without clashing. No gradients, no extra hues in the frame.
2. **Blue means yours, selected or next.** `blue` marks the primary action, the selected option, your XP, the screen title and the next boss. If it is not one of those, it is not blue.
3. **Hard shadows, no blur.** Every surface element has a 2px `ink` border and a solid offset shadow (`shadow-sm` on small controls, `shadow-md` on cards and primary buttons). Nothing has a soft drop shadow.
4. **Pressed is selected.** A selected tile moves 4px down and right into its shadow and fills blue. Buttons do the same on hover.
5. **Earn every element.** Each thing on screen must help the attendee act at the conference: what's next, where, why it fits their goals, and how to get XP. If it can't say which, leave it out.

## The two layers, in practice

| Conquest layer (this system) | Dungeon layer (not this system) |
| --- | --- |
| Map header over the map, on `scrim` | The map image, full bleed underneath |
| Next-boss marker and ring (`cq-marker`, `cq-ring`) | Bosses, rooms, torches, the player sprite |
| Picker tiles, swatches, name field | The character sprite and its layers |
| Reward number `+50 XP` in `reward` style | The floating `+50` in `score` (VT323) over the character |
| Cards, chips, buttons, action bar | Room strips shown inside a card |

Rules where they meet:

- Pixel art is always an `<img>` with `image-rendering: pixelated`, scaled by whole numbers where possible (2×, 3×, 6×).
- The dungeon layer never draws brand UI. The Conquest layer never draws pixel art.
- Over the map, brand elements sit on `scrim` or carry their own border and shadow, so they read on every dungeon theme.
- The `pixel` family (VT323) is only for numbers inside the dungeon layer.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `ground` | #E9E9E9 | Screen background around the dungeon |
| `surface` | #FFFFFF | Cards, fields, tiles, secondary buttons |
| `ink` | #000000 | All text, borders and shadows |
| `blue` | #0000FF | The one accent (see principle 2) |
| `on-blue` | #FFFFFF | Text on blue |
| `steel` | #B5B7B9 | Secondary fills only, never text |
| `scrim` | 50% black | Header band over the map |

Contrast: ink on surface 21:1, ink on ground 17:1, on-blue on blue 8.6:1, blue on ground 7:1. Use blue as text only at 24px and up (the `reward` and `slab` styles).

## Type

Two faces in the frame, one in the dungeon:

- **Bricolage Grotesque** (`display`, 700–800) for names, titles, buttons and the wordmark. Buttons and the wordmark are uppercase. It stands in for Cantina's Maricle.
- **Roboto Mono** (`mono`, 400 and 700) for running text, labels and chips. Labels are 12px bold uppercase with 0.08em tracking, between two ink rules (`cq-label`).
- **VT323** (`pixel`) only for in-dungeon numbers.

| Style | Font | Size / line | Use |
| --- | --- | --- | --- |
| reward | display 800 | 72 / 0.95 | `+50 XP` on a reward screen |
| title | display 700 | 28 / 1.05 | Talk titles on cards |
| slab | display 700 | 24 / 1.1 | Screen title on the blue slab |
| wordmark | display 700, 0.04em, caps | 26 / 1 | CONQUEST |
| heading | display 700 | 22 / 1.1 | Quest names, screen headers |
| button | display 700, caps | 18 / 1 (20 on the CTA) | Button labels |
| body | mono 400 | 16 / 24 | Running text |
| small | mono 400 | 13 / 19 | Why a talk was picked, speaker, XP breakdown |
| label | mono 700, 0.08em, caps | 12 / 1 | Section labels |
| chip | mono 400 | 11 / 1 | Chips |
| score | VT323 | 40 / 36 | In-dungeon numbers only |

## Shape and space

- Radii: `radius-sm` 6px (buttons, chips, swatches), `radius-md` 10px (tiles, fields, icon buttons, day pills), `radius-lg` 12px (cards). The title slab is square.
- Borders: `stroke` 2px ink everywhere; the full-width call to action adds a 3px ink outline (`stroke-cta`).
- Spacing steps: 4, 8, 12, 16, 20, 24px. Screens use a 16px side gutter; card padding is 18px.
- Leave 6px of room on the right of anything with `shadow-md`, so the shadow isn't clipped.

## Voice

- Short and plain. Say what happens: "Check in", "Enter the dungeon", "Back to map".
- Explain picks in one line: "Matches your goal: learn vector search."
- Game words are fine where they're the real mechanic (XP, quest, boss, party, level). Don't add lore.
- Times and rooms go in chips: `2:00 PM`, `Hall C`, `+40 XP`.

## Logo

There is no logo mark yet. Use the wordmark: CONQUEST in `wordmark` style (Bricolage Grotesque 700, uppercase, 0.04em tracking) in ink, or on-blue on blue.

## Components

Button, Icon button, Card, Chip, Title slab, Section label, Picker tile, Swatch, Text field, XP bar, Map header, Map marker and Action bar. Each is a CSS class in `conquest.css`; guidelines are in `components/`.
