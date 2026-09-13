# Design system — Hayai Comandas

<!-- impeccable:design-schema 1 -->

Direction: **service rail**. An operational dashboard for a restaurant floor,
built to be scanned in a glance under service pressure, not admired. One
brand accent is reserved for selection and primary actions; three semantic
colors carry table state and never borrow the brand hue so the two can never
be confused.

## Direction contract

- **THESIS.** The floor plan is an instrument staff read at a glance, not a
  generic canvas app; every table communicates its state before its shape
  does.
- **OWN-WORLD.** Deep graphite dark theme (default, matches host-stand/back-
  of-house lighting) with a warm-neutral light theme as an equal citizen;
  one rail-cyan brand accent (`--accent`) for selection and primary actions;
  three semantic colors (emerald free, amber reserved, rose occupied) kept
  separate from the brand hue; JetBrains Mono for every numeral (table
  labels, seat counts), Inter for all other UI text; hairline dot-grid
  canvas; locked 6/10/16px radius scale; pill-shaped template tabs.
- **STORY.** A host scans the floor, taps a table to relabel or resize it in
  a docked inspector (never a modal for routine edits), drags it to a new
  spot with optional grid-snap, and switches or creates plan templates
  without leaving the canvas.
- **FIRST VIEWPORT.** Top bar (page title, template pill-tabs, live status
  counts) + left tool rail (add circle/add square, grid-snap switch, status
  legend) + full-bleed SVG canvas + right docked inspector (empty-state
  until a table is selected).
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
| Brand accent | `--accent` | `#17a8e0` | `#17a8e0` |
| Free | `--status-free` | `#2fae6b` | `#2fae6b` |
| Reserved | `--status-reserved` | `#d69a1f` | `#d69a1f` |
| Occupied | `--status-occupied` | `#e1495a` | `#e1495a` |
| Surface | `--surface` | `#ffffff` | `#2a2724` |
| Background | `--bg` | `#faf9f8` | `#0d0c0b` |

Both themes are fully defined (no color lives only inside a media query);
`[data-theme]` on `<html>` overrides system preference, toggled from
`src/lib/useTheme.ts` and persisted to `localStorage`.

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

## Components (`src/components/ui/`)

`Button`, `IconButton`, `Card` (+ `CardHeader`/`CardBody`), `Input`,
`Badge`, `Modal` (portal, focus trap, ESC/backdrop close), `Switch`,
`EmptyState`, `ThemeToggle`. All theme-aware by construction (they only use
token utility classes), all keyboard-reachable, all have hover/focus/active/
disabled states where applicable. These are the pieces D.A.N.I should reach
for first on Comandas/Ventas/Reservaciones before inventing new ones.

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
- `Toolbar.tsx`, `TableInspectorPanel.tsx`, `TemplateSwitcher.tsx`,
  `StatusLegend.tsx` — the surrounding chrome.

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
