# Reclaim Pay design system

Source of truth for colours, type, radius, elevation and motion. Tokens live in `frontend/app/globals.css`; fonts in `frontend/app/layout.tsx` (self-hosted under `frontend/app/fonts/`). The approved fix list is `anti-slop/audit-001-2026-11-04.md` and the build brief is `docs/hackathon/UI-REVAMP-HANDOFF.md`.

## Direction

| | Landing | App (employee and HR) |
|---|---|---|
| Design Read | Product landing for hackathon judges and finance or HR buyers, in an editorial receipt-and-ledger language | Working tool for people who handle money: calm and fast to scan |
| Dials | ENERGY 3 / RHYTHM 3 / MOTION 3 | ENERGY 1 / RHYTHM 2 / MOTION 1 |
| Motion | GSAP + ScrollTrigger + Lenis, landing only, every scene has a still end state | Hover, focus and purposeful transitions (opening a dialog). Nothing loops |

**Identity motif: the receipt.** Amounts in tabular IBM Plex Mono, a perforated divider (`.perforated`), and paper texture (`.receipt-paper`) only where a receipt is actually shown. Reason: the product starts from a receipt, so the motif comes from the content.

## Colour

Tailwind's default palette is switched off (`--color-*: initial`), so only these tokens exist. Use them as `bg-*`, `text-*`, `border-*` (opacity modifiers like `border-success/30` are fine).

| Token | Value | Why |
|---|---|---|
| `ink` | `#17181c` | Near-black text; softer than pure black on warm paper, still 16:1 contrast |
| `ink-muted` | `#5a5c64` | Secondary text; 6.2:1 on `paper`, so it passes AA for body text |
| `paper` | `#f7f6f2` | Page background; a slightly warm off-white that reads as paper, not as a cold UI grey |
| `surface` | `#ffffff` | Cards and dialogs; lifts off `paper` by tone, not by shadow |
| `surface-muted` | `#efeee9` | Hover fills, input wells, table stripes |
| `line` | `#e3e1db` | Card and divider borders; flat cards are separated by a line, not a shadow |
| `line-strong` | `#8e8b83` | Form control borders; 3.4:1 on white, meets the 3:1 rule for UI boundaries |
| `accent` | `#4647d3` | Indigo, kept from the original brand. **Once per screen**, at the key moment (main action, current value). 6.4:1 on white |
| `accent-hover` | `#3536ad` | Hover and pressed state of the accent; also dark text on `accent-soft` |
| `accent-soft` | `#ecebfb` | The one tinted background allowed per screen |
| `on-accent` | `#ffffff` | Text on accent and on solid status fills |
| `success` / `success-soft` | `#1d7348` / `#e5f2eb` | Paid. Green is reserved for money that arrived |
| `danger` / `danger-soft` | `#b42318` / `#fbebe9` | Blocked or failed |
| `warning` / `warning-soft` | `#8a5800` / `#fcf1dc` | Needs review. Dark amber so text passes AA on white |

Removed: magenta `#9e00b4` and its tints, the landing pink, all gradients, the Material/Stitch colour set. Reason: two accent hues plus gradients made every screen shout; one accent makes the key moment findable.

## Type

| Role | Face | Why |
|---|---|---|
| Headlines (`font-display`, default on h1 to h3) | Bricolage Grotesque, weights 500 to 700, normal tracking | Characterful at large sizes without crowding; replaces Plus Jakarta Sans ExtraBold with negative tracking, which crowded letters |
| App and body (`font-body`, the default) | Inter | Dense tables and forms; good tabular figures; already used |
| Amounts and IDs (`font-mono`) | IBM Plex Mono 400 and 500 | Receipt feel; `font-mono` always sets `tabular-nums`, so columns of money line up |

Rules: never weight 800 or 900. No `tracking-tight` on large text. No uppercase wide-tracked eyebrow labels above headings. Every money amount and claim ID uses `font-mono`.

## Radius

| Token | Value | Use | Why |
|---|---|---|---|
| `rounded-control` | 6 px | Buttons, inputs, tabs | Crisp, tool-like controls |
| `rounded-card` | 12 px | Cards, panels | Soft enough to group, not bubbly |
| `rounded-dialog` | 20 px | Dialogs and sheets | The one element that floats gets the softest shape |
| `rounded-full` | | Status chips and avatars only | Pills mark a state; on buttons they read as decoration |

The default scale is compressed (`rounded-xl` = 8 px, `rounded-2xl` and `rounded-3xl` = 12 px) so leftovers stay calm, but new code uses the named tokens.

## Elevation

One token: `shadow-overlay`, for dialogs, menus, popovers and toasts. Cards are flat with a `line` border. Tailwind's default shadows are switched off. Reason: when everything floats nothing does; the shadow tells you a layer sits above the page.

No `backdrop-blur`. A dialog backdrop is a plain `ink/40` tint.

## Interaction

- `cursor: pointer` on every enabled control and `not-allowed` on disabled ones (base styles in `globals.css`).
- One focus ring: 2 px `accent` outline, 2 px offset (`:focus-visible`).
- Tap targets at least 44 by 44 px on phones. No horizontal overflow at 390 px.
- Dialogs trap focus, close with Escape and return focus to the trigger. Use native `<dialog>` (see `components/ui/Sheet.tsx`).
- All non-essential motion stops under `prefers-reduced-motion: reduce`.

## Copy

- No em dash in UI text. Empty values read "Not set", never a dash.
- No generic CTAs or buzzwords. Headlines say what happens; no slogan headlines ending in a period.
- Speed: "under a minute" only (4 Nov live run: about 40 s from submit to Paid).
- The AI never starts a payment and never rejects a claim. Employees never see risk scores, signal names or HR notes.
