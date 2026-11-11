# JADARAH brand colours (final)

Only the approved palette and its tonal variations are used. A **tonal variation** is the same hue at a different
lightness (or saturation), or a blend of two approved colours — nothing else. All app colours come from the semantic
tokens in `src/app/globals.css`; both themes use the same token names. Components never hard-code colours (the official
logo artwork and companies' own brand colours are the only exceptions).

## Approved palette

| Light identity | Hex | Dark identity | Hex |
|---|---|---|---|
| Deep Navy | #172F49 | Deep Midnight | #101E31 |
| Professional Blue | #3B66F6 | Dark Navy | #172C43 |
| Sky Blue | #A9CBE5 | Petrol Surface | #204355 |
| Mist Blue | #D4E4EF | Blue Accent | #4B83C5 |
| Petrol Blue | #20566A | Soft Sky | #91B9D8 |
| Teal | #4D9996 | Teal | #5DA7A0 |
| Warm Sand | #DCC8B5 | Warm Sand | #CBB29C |
| Soft Beige | #E9DCD2 | Muted Lavender | #9585AD |
| Muted Peach | #E8BFAE | | |
| Soft Sage | #D5E5DA | | |
| Muted Lavender | #B6A8CA | | |

## Semantic tokens

| Token | Role | Light | Dark |
|---|---|---|---|
| `--background` | Page background | `#ceccc7` | `#172C43` |
| `--background-2` | Page background 2 | `#c4dae9` | `#101E31` |
| `--sidebar` | Sidebar | `#cddfec` | `#101E31` |
| `--surface` | Card surface | `#E9DCD2` | `#204355` |
| `--surface-elevated` | Elevated surface | `#e2dfdc` | `#2e5165` |
| `--surface-2` | Secondary surface | `#e2d1c2` | `#375b6f` |
| `--input` | Input | `#e5ded8` | `#1b364b` |
| `--tone-blue` | Blue card | `#c1d9ea` | `#2e537e` |
| `--tone-mist` | Mist card | `#D4E4EF` | `#305467` |
| `--tone-sand` | Sand card | `#DCC8B5` | `#544436` |
| `--tone-peach` | Peach card | `#E8BFAE` | `#533b32` |
| `--tone-sage` | Sage card | `#D5E5DA` | `#344b3b` |
| `--tone-teal` | Teal card | `#b7d4cb` | `#2b5450` |
| `--tone-lilac` | Lavender card (rare) | `#d2c5ce` | `#3d344b` |
| `--foreground` | Primary text | `#172F49` | `#eaf2f7` |
| `--muted-foreground` | Secondary text | `#344e68` | `#b6d1e5` |
| `--subtle-foreground` | Muted text | `#20566a` | `#b2cee4` |
| `--border` | Border | `#9cb6c9` | `#44697f` |
| `--border-strong` | Strong border | `#7698b2` | `#537890` |
| `--primary` | Primary action | `#3B66F6` | `#6496cc` |
| `--primary-hover` | Primary hover | `#355cd7` | `#6e9ece` |
| `--primary-foreground` | Text on primary | `#ffffff` | `#101E31` |
| `--primary-ink` | Link / blue text | `#2744a5` | `#b2cee4` |
| `--accent` | Accent | `#4D9996` | `#5DA7A0` |
| `--accent-ink` | Accent text | `#2e5c5a` | `#b0d2d7` |
| `--success` | Success | `#2b5553` | `#b0d2d7` |
| `--success-soft` | Success surface | `#D5E5DA` | `#2b5450` |
| `--warning` | Warning | `#644426` | `#CBB29C` |
| `--warning-soft` | Warning surface | `#DCC8B5` | `#544436` |
| `--danger` | Danger | `#824126` | `#E8BFAE` |
| `--danger-soft` | Danger surface | `#E8BFAE` | `#533b32` |
| `--info` | Info | `#2744a5` | `#b2cee4` |
| `--info-soft` | Info surface | `#c1d9ea` | `#2e537e` |
| `--chart-1` | Chart series 1 | `#3B66F6` | `#6496cc` |
| `--chart-2` | Chart series 2 | `#4D9996` | `#5DA7A0` |
| `--chart-3` | Chart series 3 | `#cb724d` | `#d89579` |
| `--chart-4` | Chart series 4 | `#20566A` | `#91B9D8` |
| `--chart-5` | Chart series 5 | `#4088bf` | `#CBB29C` |
| `--chart-6` | Chart series 6 | `#9b724b` | `#86b695` |
| `--chart-7` | Chart series 7 | `#172F49` | `#648aa4` |
| `--chart-8` | Chart series 8 | `#8770a9` | `#9585AD` |
| `--chart-success` | Chart success | `#4D9996` | `#7bb6b4` |
| `--chart-failure` | Chart failure | `#c66239` | `#d38869` |

How they are derived: light page = Mist × Warm Sand blend at lower lightness (comfortable, never white); cards = Soft
Beige; tonal cards = the approved tints; text = Deep Navy and Navy/Sky/Petrol tones; status = darker tones of Teal (success),
Warm Sand (warning) and Muted Peach (danger). Dark page = Dark Navy, sidebar = Deep Midnight, cards = Petrol Surface and
lighter Petrol/Soft-Sky blends, primary = Blue Accent blended toward Soft Sky so dark text on it passes AA.

## Contrast (WCAG 2.1)

| Check | Light | Dark |
|---|---|---|
| `foreground` on `background` | 8.5:1 | 12.5:1 |
| `foreground` on `surface` | 10.2:1 | 9.3:1 |
| `muted-foreground` on `surface` | 6.4:1 | 6.6:1 |
| `subtle-foreground` on `background` | 5.0:1 | 8.7:1 |
| `primary-ink` on `surface` | 6.4:1 | 6.4:1 |
| `primary-foreground` on `primary` | 4.8:1 | 5.4:1 |
| `success` on `success-soft` | 6.4:1 | 5.2:1 |
| `warning` on `warning-soft` | 5.4:1 | 4.6:1 |
| `danger` on `danger-soft` | 4.6:1 | 6.1:1 |

Every text role is ≥ 4.5:1 on the page, card, elevated and sidebar surfaces in both themes (checked by script during the
change). The light primary button (white on Professional Blue) is 4.75:1.

## Usage rules

- Blue (Professional Blue / Blue Accent) is the primary action and the most recognisable colour.
- Tonal cards carry meaning: blue = opportunities/primary metric, sage = done/positive, peach = needs action,
  mist = growth/skills, sand = neutral context, teal = secondary insight, lavender = rare (AI notes only).
- Status is never shown by colour alone (labels/icons accompany it).
- The 3D landing scene uses the same palette (sky Midnight → Petrol in dark, Sky/Sand in light; water Sky Blue/Petrol;
  portal Professional Blue). Posters in `public/city/` are rendered from that scene.
