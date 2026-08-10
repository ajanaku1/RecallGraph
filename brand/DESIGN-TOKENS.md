# RecallGraph design tokens

`brand/tokens.css` is the token contract for RecallGraph’s production Daylight Forensics workspace. It is not framework code.

## Color mode and intent

RecallGraph is **light-dominant**. Paper canvas (`#F2EFE7`) and warm-white evidence surfaces (`#FCFBF7`) support sustained forensic reading. Carbon ink (`#18201E`) gives the workspace an exact, registry-like contrast. The dark docket (`#151B1A`) is reserved for the consequential closure rail and its progress stitch; it is a surface role, not a second visual mode.

| Token | Value | Intent |
| --- | --- | --- |
| `--rg-color-paper` | `#F2EFE7` | Daylight canvas and quiet structural field. |
| `--rg-color-evidence` | `#FCFBF7` | Evidence room, records, and recovery surfaces. |
| `--rg-color-carbon` | `#18201E` | Primary text and precise structural ink. |
| `--rg-color-registry` | `#63706B` | Secondary registry text and measured rules. |
| `--rg-color-petrol` | `#1F5B63` | Evidence selection, primary action, and focus. |
| `--rg-color-oxide` | `#D94A2F` | Risk strokes and the differentiating closure stitch. |
| `--rg-color-docket` | `#151B1A` | The single dark decision/closure rail. |

The approved Linear Stitch remains unchanged. Its heritage vermilion is allowed within the existing logo carrier only; this theme does not create a new logo variant.

## State and accessibility

Petrol selection always pairs existing `aria-pressed` semantics with a 2px border and an inset keyline. Closure and risk retain oxide as a border/stitch treatment, while normal alert text remains carbon on evidence or warm-white on the docket. Oxide on evidence is only 4.08:1 and is therefore not used for small normal text.

| Pairing | Contrast | Use |
| --- | ---: | --- |
| Carbon on evidence | 16.04:1 | Primary normal text. |
| Registry on evidence | 4.99:1 | Secondary normal text. |
| Petrol on evidence | 7.42:1 | Selection/action text where needed. |
| Evidence on docket | 16.85:1 | Docket normal text. |
| Petrol on paper | 6.68:1 | Focus and UI indicator. |

Every meaningful state has a written or structural cue beyond colour. Focus uses a 3px petrol outline with an offset. Disabled controls retain a visible border/text treatment. All controls retain a 44px minimum target.

## Typography, geometry, and motion

Use `--rg-font-display` for concise evidence headings and `--rg-font-body` for records and controls. The active interface limits itself to a compact 12px/14px/16px registry scale plus the display title. Spacing follows a 4px system from 4 through 64px. There are exactly two radii: 4px controls and 8px panels.

Motion is functional only: opacity and transform feedback with the shared ease-out curve, between 160ms and 220ms (never above 240ms). Hover feedback is scoped to hover-capable pointers. The reduced-motion query reduces motion to 1ms. There are no gradients, perpetual decoration, linear easing, bounce, `scale(0)`, or `transition: all`.
