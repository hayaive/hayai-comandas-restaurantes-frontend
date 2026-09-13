# Design system — Hayai Comandas

<!-- impeccable:design-schema 1 -->

Direction: **specialty coffee house**. An operational dashboard for a
restaurant floor, built to be scanned in a glance under service pressure,
not admired — now carrying the "HAYAI Coffee" brand identity (warm
brown/cream/kraft, not a generic SaaS dashboard palette). One brand accent
is reserved for selection and primary actions; three semantic colors carry
table state and never borrow the brand hue so the two can never be confused.

## Direction contract

- **THESIS.** The floor plan is an instrument staff read at a glance, not a
  generic canvas app; every table communicates its state before its shape
  does. The palette reads as a specialty coffee shop (roasted beans, cream,
  kraft paper), not an operational SaaS dashboard.
- **OWN-WORLD.** Deep espresso-brown dark theme (default, matches host-
  stand/back-of-house lighting) with a warm cream/kraft light theme as an
  equal citizen; one burnt-terracotta brand accent (`--accent`) for
  selection and primary actions; three semantic colors (moss-green free,
  caramel-gold reserved, wine-red occupied) kept separate from the brand
  hue; JetBrains Mono for every numeral (table labels, seat counts), Inter
  for all other UI text; hairline dot-grid canvas; locked 6/10/16px radius
  scale; pill-shaped template tabs.
- **STORY.** A host scans the floor, taps a table to relabel or resize it in
  a docked inspector (never a modal for routine edits), drags it to a new
  spot with optional grid-snap, and switches or creates plan templates
  without leaving the canvas.
- **FIRST VIEWPORT.** Top bar (page title, template pill-tabs, live status
  counts) + full-bleed SVG canvas with a docked bottom toolbar (add
  circle/add square, grid-snap switch) + right docked inspector (empty-state
  until a table is selected). The status legend that used to live in a left
  tool rail was dropped: it duplicated the top bar's live counts, and no
  screen should show the same fact twice.
- **FORM.** Chosen directly as sole art director for this delegated build.
  This session had no image-generation tool and no live interactive
  decision surface, so the skill's dice-roll / decision-page apparatus
  (`concept-seed`, `serve-question`) could not run; that substitution was
  disclosed to the requester up front rather than silently skipped.
- **FINISH.** Reviewed by hand (no finish-reviewer subagent is installed in
  this setup, per this agent's own operating instructions): typecheck,
  lint, and production build all pass; the mechanical detector
  (`impeccable detect --json`) ran clean; no browser/screenshot tool was
  available in this session, so visual verification was a full manual
  code read against the craft floor rather than a captured screenshot
  diff. That gap is disclosed, not hidden.

## Color

Strategy: **Restrained** (Operate default) — neutrals carry the interface,
one accent reserved for brand/selection, three semantic colors reserved for
table state. Tokens live in `src/styles/tokens.css` as CSS custom
properties, mapped into real Tailwind utilities via `@theme inline` in
`src/styles/global.css` (e.g. `bg-status-occupied-soft`,
`text-status-free-fg`, `fill-status-reserved` for SVG). Never hardcode a hex
value in a component; always reach for a token class.

| Role | Token | Light | Dark |
|---|---|---|---|
| Brand accent | `--accent` | `#a8501f` (deep terracotta) | `#dd8a4a` (copper — lightened for text-on-dark contrast) |
| Free | `--status-free` | `#5b8a4f` (moss green) | `#5b8a4f` |
| Reserved | `--status-reserved` | `#c98a2e` (caramel gold) | `#c98a2e` |
| Occupied | `--status-occupied` | `#a8354a` (wine red) | `#a8354a` |
| Surface | `--surface` | `#ffffff` | `#24170e` |
| Background | `--bg` | `#fdfaf5` (warm cream) | `#100a06` (coffee bean) |

Note: `--accent` itself is redefined per theme (not just its `-soft`
variant) because the light-mode terracotta is too dark to read as text at
4.5:1 against a dark soft-fill background — dark mode uses a lighter step
of the same hue instead. Both themes are fully defined (no color lives
only inside a media query); `[data-theme]` on `<html>` overrides system
preference, toggled from `src/lib/useTheme.ts` and persisted to
`localStorage`.

## Typography

One family for UI (`Inter`, self-hosted via `@fontsource/inter`, latin +
latin-ext subsets only), one monospace for every numeral and short code
(`JetBrains Mono`, same self-hosting approach) — table labels, seat counts,
status counts. Fixed rem scale, not fluid clamp; this is Operate mode, not a
marketing page.

## Spacing, radius, shadow

Locked radius scale: `--radius-sm` (6px, controls/buttons/inputs),
`--radius-md` (10px, cards/panels-within-panels), `--radius-lg` (16px,
canvas frame/modal), `--radius-pill` (template tabs, switches). Shadows are
hue-tinted, never pure black (`--shadow-sm/md/lg`).

## Components (`src/components/ui/`) — shadcn/ui on Radix

This layer is **shadcn/ui**. `src/components/ui/primitives/` holds canonical
shadcn components (button, input, label, dialog, select, switch, tooltip,
popover, dropdown-menu, tabs, scroll-area, separator, skeleton) on Radix UI,
`class-variance-authority` and `tailwind-merge`. The PascalCase files beside
it — `Button`, `IconButton`, `Card`, `Input`, `Select`, `Badge`, `Modal`,
`Switch`, `EmptyState`, `ThemeToggle` — are this project's branded API on top
of them, and are what screens import. Reach for these first on any screen
before inventing a new component.

`components.json` points `aliases.ui` at `primitives/`, so
`npx shadcn@latest add <component>` works normally. Read
`src/components/ui/primitives/README.md` before pasting anything in from
upstream: two substitutions are required (shadcn's `accent` role → our
`surface-hover`/`fg`, and `lucide-react` → `@phosphor-icons/react`).

The CLI's `init` was deliberately not run. It writes lowercase `button.tsx`,
which collides with `Button.tsx` on a case-insensitive Windows filesystem,
and it rewrites the Tailwind entry CSS with shadcn's default gray OKLCH ramp
— which would have destroyed the coffee palette this project is built on.

### Colour roles

`tokens.css` carries a shadcn role block where every role aliases an existing
coffee token: `--primary` is the burnt terracotta `--accent`, `--secondary`
is `--surface-hover`, `--muted` is `--surface-sunken`, `--ring` is `--accent`,
`--card`/`--popover` are `--surface-raised`, and the `--sidebar-*` family
points at the fixed kraft-rail chrome. Because each role is `var(--token)`
rather than a copied value, the roles follow the light/dark swap for free and
are declared exactly once.

shadcn's `--accent` role is **not** aliased. In shadcn `accent` means "subtle
hover tint"; here `--accent` is the brand hue and the whole app depends on
that meaning.

### Notes that outlive this pass

- `Modal` is a header / scrolling-body / footer shell over Radix `Dialog`.
  Radix owns focus, the focus trap, focus restore, Escape, outside-press and
  the body scroll lock, which is why the old hand-rolled focus effect (and
  the ref it needed so typing in a modal input did not steal focus back to
  the close button) is gone rather than restyled.
- `IconButton` shows its `label` as a Radix tooltip instead of the `title`
  attribute. `title` renders in OS chrome with the OS font and never appears
  for keyboard or touch users.
- `Select` stays a native `<select>` on purpose: the app runs on tablets at a
  host stand, where the OS picker beats any popup we could draw. The trigger
  matches `Input` exactly. The full Radix select lives in
  `primitives/select.tsx` for options needing rich content.
- Dark-mode `--fg-muted`/`--fg-subtle` each sit one rung lighter than they
  used to (`--n-200`/`--n-300`). At `--n-500`, `--fg-subtle` measured ~2.0:1
  on `--surface`, and that token draws input placeholders and field hints.
- Modal and sheet scrims use `--overlay`, a warm espresso rgba. A neutral
  `black/45` desaturates the whole cream palette for as long as it is up.

## Floor plan editor (`src/components/floor-plan/`)

- `geometry.ts` — canvas dimensions (1200x700 units) and seat-position math
  for both table shapes.
- `statusMeta.ts` — the single source of truth mapping a `TableStatus` to
  its label and its **two separate class sets**: `svgFillClass`/
  `svgStrokeClass` for canvas shapes (SVG `fill`/`stroke`) and `dotClass`/
  `bgSoftClass`/`borderClass`/`textClass` for ordinary HTML elements
  (`background-color`/`border-color`/`color`). Do not cross the two: Tailwind's
  `fill-*`/`stroke-*` utilities only affect SVG elements and silently do
  nothing on a `<div>` or `<button>` — this was caught and fixed once
  already during this build.
- `TableShape.tsx` — one table: pointer-capture drag (`setPointerCapture`,
  no window listeners), keyboard-reachable (arrow keys nudge position,
  Enter/Space selects), optional grid-snap, seats drawn geometrically around
  the shape, status tint + selection ring kept visually distinct.
- `FloorPlanCanvas.tsx` — SVG canvas, dot-grid background, screen-to-canvas
  coordinate transform via `getScreenCTM()`.
- `BottomToolbar.tsx` — docked bar under the canvas (add circle/add square,
  grid-snap switch), grouped horizontally with a vertical divider; wraps to
  two rows on narrow/tablet widths instead of crowding.
- `TableInspectorPanel.tsx`, `TemplateSwitcher.tsx` — the remaining
  surrounding chrome. The former left tool rail (`Toolbar.tsx`) and its
  `StatusLegend.tsx` were removed in favor of the bottom toolbar and the top
  bar's existing live counts.

## State (`src/lib/useFloorPlanStore.ts`)

Zustand store, the seam for a future API integration: `moveTable`,
`addTable`, `removeTable`, `renameTable`, `setSeats`, `setShape`,
`setStatus`, plus template CRUD (`selectTemplate`, `addTemplate`,
`renameTemplate`, `removeTemplate`) and selection/grid UX state. Mock seed
data lives in `src/lib/mockData.ts` (three templates: Salón principal,
Evento boda, Terraza) — replace this file's contents, not its shape, once
the real API lands. Domain types are in `src/lib/types.ts`.

## Known gaps for the next pass

- No pan/zoom on the canvas (out of the brief's scope; fixed-viewBox with
  responsive scaling only).
- No automated visual regression; no browser/screenshot tool was available
  in this session, so verification was static analysis plus a full manual
  code read against the craft floor, not a rendered screenshot diff.
- Comandas/Ventas/Reservaciones are intentionally empty states, not stubs
  with fake data.
