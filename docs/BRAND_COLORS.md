# JADARAH colour system — premium redesign

One semantic token set in `src/app/globals.css`, expressed differently by each theme. Components use tokens only
(exceptions: the official logo artwork, the 3D city scene and companies' own brand colours).

## Brand families

| Family | Values | Role |
|---|---|---|
| Portal blue | #3B66F6 (dark #7A9BFF) | Start of the signature gradient, information |
| Purple | Vibrant #8B5CF6, Electric #A855F7, Deep #7C3AED / #6D28D9, Soft Lilac #D8B4FE, Muted Lavender #B6A8CA, Deep Lavender #9585AD | Identity: primary action gradient end, links, active and selected states, focus, eyebrows, illumination |
| Green | Deep #0B3D2E, Green #1F7A4D, Mint #A7E3C2 (dark #6FD3A0) | Brand anchor: employer identity, positive states, secondary brand action |
| Warm neutrals | Off-white #F7F4E9, ivory #FBF8F0 / #FFFDF8, warm grey #EFE9DC | Light-mode grounds and surfaces (never a pure-white canvas) |
| Gold | #D4AF37 (ink #7A5A0C) | Rare highlights only: items that need attention, links on green panels |
| Indigo | #211C4A → #3A3478 | The deep layer (sidebar, spotlights) and the dark theme's surfaces |

**Signature:** the blue → violet portal gradient (`--portal-gradient`, `.btn-primary`, `.fill-signature`,
`.text-portal`) — primary buttons, progress, light trails in the 3D city.

## Two personalities

**Light — warm editorial.** Off-white page, ivory cards, warm-grey secondary surfaces, lavender-lit section bands
(`.section-lavender`), a deep indigo sidebar and candidate spotlight, a deep green employer panel (`.panel-green`).
Text is deep indigo (#1F1B33), links and active states violet.

**Dark — luminous indigo, never near-black.** Page #1C2045, cards #2A3060, raised #343B70, violet-tinted
#272456 / #2E2A5C. Layers get lighter as they rise; the `.ink` spotlight is the *lightest* violet layer. Violet and
blue light (`.ink-aura`) give depth; green becomes mint.

## Semantic tokens (light / dark)

| Token | Light | Dark |
|---|---|---|
| `--background` / `--background-2` | #f7f4e9 / #fbf8f0 | #1c2045 / #232850 |
| `--surface` / `--surface-elevated` / `--surface-2` | #fffdf8 / #ffffff / #efe9dc | #2a3060 / #343b70 / #272456 |
| `--surface-violet`, `--section-tint` | #f3eefa, #f1ecf7 | #2e2a5c, #262456 |
| `--ink-bg` (deep layer) | #211c4a | #2e2a5c |
| `--foreground` / `--muted-foreground` / `--subtle-foreground` | #1f1b33 / #4a4560 / #5f5975 | #f3f0fb / #cfc8e6 / #b2aacf |
| `--border` / `--border-strong` | #e4dccb / #c9bca3 | #3e4580 / #525a9a |
| `--primary` (solid) / `--primary-foreground` | #5b3fe0 / #ffffff | #a58cf8 / #140f2e |
| `--primary-blue` → `--primary-violet` (gradient) | #3b66f6 → #7c3aed | #7a9bff → #b58cf8 |
| `--primary-ink` (links, active text) | #6d28d9 | #d4bbff |
| `--accent` / `--accent-ink` (green) | #1f7a4d / #17643f | #6fd3a0 / #9ee0bc |
| `--success` on `--success-soft` | #17643f on #e2f3e9 | #9ee0bc on #1e4a3e |
| `--warning` on `--warning-soft` | #7a5a0c on #f7edcf | #e9cf7a on #4a3f22 |
| `--danger` on `--danger-soft` | #a8331f on #fbe3dd | #ffb4a6 on #4e2a30 |
| `--info` on `--info-soft` | #2f48c4 on #e6eafd | #a9c1ff on #2b3a78 |
| `--ring` (focus) | #7c3aed | #d8b4fe |
| `--chart-1…8` | violet, blue, green, gold, lilac, mint, indigo, sand | lighter steps of the same |

Single-series charts use one colour; categorical colours are for categories only.

## Contrast (WCAG 2.1, checked by script)

Every text role is ≥ 4.5:1 on every surface of its theme, on the indigo deep layer and on the green panel. Buttons:
white on #3B66F6 4.75:1 and on #7C3AED 5.70:1; dark text on the dark-mode gradient ends 7.0:1; white on deep green
12.2:1. Status pairs 5.4–7.3:1.

## Visual language

Personality comes from composition, typography, colour and a few intentional accents — never from graphics behind
content.

- **No watermarks.** Do not place the logo or portal symbol (or any large decorative shape) behind dashboard content,
  sidebars, navigation, tables, charts, profiles or text, and do not repeat it as a pattern. No grid or technical
  textures either.
- **Where the logo belongs:** the navigation lockup, the footer, the sign-in screens, the landing hero and the app
  icon.
- **The portal illustration** (`components/brand/portal-art.tsx`, drawn only from the logo geometry) is reserved for
  deliberate hero compositions where nothing sits on top of it — today only the sign-in side panel; the landing hero
  uses the 3D city.
- Soft colour light (`.ink-aura`, `.section-lavender`) may give panels depth; it carries no shapes.

Typography (identity board): Manrope for English and IBM Plex Sans Arabic for Arabic, for headings and text alike.
