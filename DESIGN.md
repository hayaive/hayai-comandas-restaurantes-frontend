# Design system — Hayai Comandas

<!-- impeccable:design-schema 1 -->

Direction: **soft neutral console**. An operational dashboard for a restaurant
floor, built to be scanned at a glance under service pressure. A chromatically
silent neutral canvas, very large radii, gradient banners that tell you which
part of the product you are in, and exactly one warm colour — brown — which
means, everywhere and only, *this is the thing that is currently selected*.

> **This document was rewritten in Sep 2026.** The previous system ("specialty
> coffee house": cream / kraft / espresso neutrals, burnt-terracotta accent,
> 6/10/16px radii, Inter, Phosphor icons, a kraft sidebar rail and a solid
> black footer) was replaced wholesale at the product owner's request, who
> asked for a full visual clone of the `custom-globe-component` reference
> dashboard. Decisions that were reversed are recorded below with their
> reasoning rather than deleted, so nobody re-litigates them by accident.

## Direction contract

- **THESIS.** The floor plan is an instrument staff read at a glance, not a
  generic canvas app; every table communicates its state before its shape does.
  The surrounding product reads as one soft, quiet, large-radius system so that
  the three table-state colours and the one brown selection colour are the only
  things on screen competing for attention.
- **OWN-WORLD.** Pure neutral gray surfaces (zero saturation); one brand family
  — violet → indigo → blue — used for primary actions and for the five gradient
  hero banners; **brown `#6f4a2e` with white text for every active/selected
  state**; three semantic table colours (emerald free / amber reserved / rose
  occupied) that borrow neither the brand nor the brown; Geist for UI and Geist
  Mono for every numeral; a 12 / 16 / 24px radius scale; a slow ambient
  gradient field behind the shell.
- **STORY.** A host scans the floor, taps a table to relabel or resize it in a
  docked inspector (never a modal for routine edits), drags it with optional
  grid-snap, and switches or creates plan templates without leaving the canvas.
  A waiter picks a table, searches products, and sends an order in three
  numbered steps. A cashier reads the day's figures off three stat tiles.
- **FIRST VIEWPORT.** Sticky translucent top bar (title + actions) over a
  scrolling body that opens with a gradient hero carrying the screen's live
  figures, then stacked titled sections on an 8-unit rhythm.
- **FORM.** Reference-driven. The visual language was extracted by reading
  `custom-globe-component/components/creative.tsx` in full — its sidebar
  anatomy, radius frequency (72 × `rounded-2xl`, 40 × `rounded-xl`, 23 ×
  `rounded-3xl`), card treatment, gradient banners, motion props and type scale
  — and re-expressed on this project's Vite + Tailwind v4 stack. No Next.js
  anything was carried over.
- **FINISH.** Reviewed by hand. `typecheck`, `lint` and `build` all pass. A
  60-pair contrast audit was run numerically against the real token values in
  both themes and **caught six genuine failures**, all fixed (see *Colour*).
  No browser or screenshot tool was available in this session, so visual
  verification was a dev-server smoke test plus a full manual code read, not a
  rendered screenshot diff. That gap is disclosed, not hidden.

## The one non-negotiable rule

**Every active, selected, or currently-chosen control is brown with white
text.** This is a client mandate and it overrides whatever the reference
template does for its own active states.

```
bg-active text-active-fg      ← the recipe. Never hardcode the hex.
```

Tokens live in `tokens.css` as `--active-bg` / `--active-bg-hover` /
`--active-fg` / `--active-soft` / `--active-soft-fg`, and are exposed as real
Tailwind utilities (`bg-active`, `text-active-fg`, `bg-active-soft`,
`border-active`, `ring-active`, `stroke-active`, `fill-active-soft`) so a call
site's own `className` can still override them predictably through
`tailwind-merge`.

Where the rule is applied today — this list is the thing to check first if the
treatment ever looks like it has drifted:

| Surface | File |
|---|---|
| Sidebar nav item | `layout/Sidebar.tsx` |
| Mobile tab + "Más" | `layout/MobileBottomNav.tsx` |
| Mobile more-sheet item | `layout/MobileMoreSheet.tsx` |
| Tab trigger | `ui/primitives/tabs.tsx` |
| Switch track (on) | `ui/primitives/switch.tsx` |
| Template pill | `floor-plan/TemplateSwitcher.tsx` |
| Table shape toggle | `floor-plan/TableInspectorForm.tsx` |
| Selected-table ring on the SVG canvas | `floor-plan/TableShape.tsx` |
| Grid-snap mode | `floor-plan/BottomToolbar.tsx` |
| Category filter chip | `pages/ProductosPage.tsx` |
| Clave/PIN segmented control | `pages/LoginPage.tsx` |
| Selected table (waiter) | `pages/MeseroPage.tsx` |
| Chosen table (guest) | `pages/SelfSeatPage.tsx` |
| `Badge tone="active"`, `Button variant="active"`, `IconButton active`, `IconTile tone="active"` | `ui/` |

Two deliberate exemptions, both defensible:

- **Table status** (libre / reservada / ocupada) keeps its own semantic colour
  even when selected, and is marked by a brown *ring* instead. A host must read
  "this table is occupied" as occupied, not as selected; overriding the fill
  would make the three states indistinguishable at a glance, which is the one
  thing the status palette exists to prevent.
- **The mobile FAB** ("Agregar Orden") keeps the brand gradient. It is an
  action, not a state.

## Colour

Strategy: **restrained**. Neutrals carry the interface, one brand family is
reserved for primary actions and heroes, one brown is reserved for selection,
three semantic colours are reserved for table state. Tokens live in
`src/styles/tokens.css` and are mapped to Tailwind utilities via `@theme inline`
in `src/styles/global.css`. Never hardcode a hex in a component.

| Role | Token | Light | Dark |
|---|---|---|---|
| **Active / selected** | `--active-bg` | `#6f4a2e` | `#7d5436` |
| Active foreground | `--active-fg` | `#ffffff` | `#ffffff` |
| Brand (fill) | `--primary` | `#4f46e5` | `#4f46e5` |
| Brand (text) | `--accent` | `#4f46e5` | `#818cf8` |
| Free | `--status-free` | `#059669` | `#10b981` |
| Reserved | `--status-reserved` | `#d97706` | `#f59e0b` |
| Occupied | `--status-occupied` | `#e11d48` | `#f43f5e` |
| Danger (text) | `--danger` | `#b91c1c` | `#f87171` |
| Danger (fill) | `--destructive` | `#b91c1c` | `#dc2626` |
| Surface | `--surface` | `#ffffff` | `#141414` |
| Background | `--bg` | `#fafafa` | `#0a0a0a` |

The neutrals are deliberately **untinted**. The old scale was warm; mixing a
warm gray with a cool violet/indigo brand is the classic "two grays fighting"
failure, so the neutrals sit at zero saturation and let the brand and the brown
be the only hues on screen.

### Tokens that are split in dark mode, and why

One value cannot always do two jobs. A contrast audit forced three splits:

- **`--accent` vs `--primary`.** `--accent` is read as *text* on a near-black
  surface, so in dark mode it must be light (`#818cf8`, 6.18:1). `--primary` is
  a *fill* carrying white text, so it must stay dark (`#4f46e5`, 6.29:1). They
  were one value until the audit measured white-on-`#6366f1` at **4.47:1**,
  just under the floor.
- **`--danger` vs `--destructive`.** Same shape: text hue vs fill hue.
  `#dc2626` measured **4.41:1** as text on its own soft background.
- **`--destructive-strong`** exists because the destructive button's hover used
  to be `brightness-110`; brightening a red fill *lowers* its contrast with the
  white label it carries. The hover is now an explicit darker token.

### Contrast audit

60 text/background pairs checked numerically in both themes; all clear their
floor. Notable results:

| Pair | Light | Dark |
|---|---|---|
| White on active brown | **7.79:1** | **6.58:1** |
| White on primary | 6.29:1 | 6.29:1 |
| Secondary text (`--fg-muted`) on sunken surface | 7.17:1 | 8.22:1 |
| Hint/placeholder (`--fg-subtle`) on sunken surface | 4.89:1 | 5.34:1 |
| White on every hero gradient stop | ≥ 6.70:1 | same |
| White **at 80% opacity** on every hero stop | ≥ 4.89:1 | same |

Two fixes worth remembering:

- The hero gradients originally used Tailwind's `-600` stops, exactly like the
  reference. At the 80% opacity the hero description and stat labels use, those
  measured **3.82–4.04:1**. The whole set moved one step deeper to `-700/-800`.
  They read richer for it. **Do not lighten them without re-running the check.**
- `--fg-subtle` was `#909090`, which measured **2.93:1** on the sunken surface —
  and that token draws input placeholders and field hints, exactly the text a
  user squints at. Both secondary steps moved down the scale and stay visibly
  distinct from each other.

Both themes are fully defined (no colour lives only inside a media query);
`[data-theme]` on `<html>` overrides system preference, toggled from
`src/lib/useTheme.ts` and persisted to `localStorage`. The dark palette is
declared **twice** — once behind `prefers-color-scheme`, once behind the
explicit attribute. Keep the two blocks identical; they are a pair.

## Typography

**Geist Variable** for UI, **Geist Mono Variable** for every numeral and short
code (table labels, seat counts, money, times, reservation codes). Both
self-hosted via `@fontsource-variable/*`, one variable file per family covering
100–900, so the four static Inter weights the old system shipped collapse into
a single request and the in-between weights (450/550) become available. Only
`wght.css` is imported — no italics, because nothing in this interface is set
in italic. Subsets are `unicode-range`-gated, so a Spanish UI only ever
downloads the latin and latin-ext faces.

Scale, taken from the reference:

| Use | Class |
|---|---|
| Hero title | `text-2xl sm:text-3xl font-semibold` |
| Section heading | `text-xl sm:text-2xl font-semibold` |
| Page title (top bar) | `text-lg font-semibold` |
| Card title | `text-base font-medium` |
| Body / table cell | `text-sm` |
| Control label | `text-[13px] font-medium` |
| Meta / caption | `text-[12px]` |

`h1`–`h3` get `letter-spacing: -0.02em` and `text-wrap: balance` globally in
`global.css` rather than per-heading, so the rule cannot drift screen to
screen. Every figure carries `tabular-nums` — these numbers refresh while
someone is reading them, and proportional digits visibly shift width as they
change.

## Spacing, radius, shadow

**Radius is the single strongest signature of this system** and is driven
entirely from four token values:

| Token | Value | Tailwind equivalent | Used for |
|---|---|---|---|
| `--radius-sm` | 12px | `rounded-xl` | badges, chips, inner elements |
| `--radius-md` | 16px | `rounded-2xl` | buttons, inputs, nav items, icon tiles |
| `--radius-lg` | 24px | `rounded-3xl` | cards, panels, modals, heroes |
| `--radius-pill` | 999px | `rounded-full` | switch tracks only |

**Nothing in `src/` writes a literal Tailwind radius class.** That is what makes
changing these four numbers re-shape the entire product, and it is worth
protecting.

Shadows are neutral and soft. Cards carry **no resting shadow** — at a 24px
radius a tight shadow reads as a dark rim rather than lift, so interactive
cards signal elevation by *outlining* on hover (`hover:border-accent/45`)
exactly as the reference does. Page rhythm is `space-y-6` on phones and
`space-y-8` from `sm` up, applied once by `PageBody`.

## Motion

`framer-motion`, added for this redesign, and deliberately constrained — this
app runs on host-stand tablets.

- **`<LazyMotion features={domAnimation} strict>`** in `main.tsx` instead of
  the full `motion` tree: roughly half the bundle, and covers everything used
  here (variants, `animate`, `whileHover`, `whileTap`). `strict` makes
  `motion.div` throw, so components use `m.div` and nobody can silently pull
  the full bundle back in. This saved ~15 kB gzipped.
- **All variants come from `src/lib/useAppMotion.ts`.** Framer animates inline
  styles and therefore escapes the CSS `prefers-reduced-motion` guard in
  `global.css` entirely; honouring the preference has to happen in JS, and
  doing it per component would guarantee somebody forgets.
- **No hover `scale` on cards.** The reference uses
  `whileHover={{ scale: 1.02, y: -5 }}`; scaling a card re-rasterises its text
  every frame and a grid of a dozen is visibly gritty on a tablet. Translating
  on Y reads the same and stays a pure composite. `whileTap` is the feedback
  that actually matters on a touch screen.
- **The ambient background is CSS, not JS.** The reference interpolates the
  `background` property of a viewport-sized layer on a 30s loop, which repaints
  every frame. `.ambient-field` in `global.css` is two static gradient blobs
  moved with `transform` instead — same slow drift, GPU-composited, zero
  repaint.
- **Nothing animates inside the floor-plan canvas.** `TableShape` runs
  pointer-capture drags at 60fps and must not compete with anything.

## Iconography

**`lucide-react`** — a reversal of the previous decision to use
`@phosphor-icons/react`, made because lucide's uniform 2px-stroke, 24px-grid
outline style is a large part of why the reference reads the way it does, and
because it is what upstream shadcn ships (so pasted-in components need no icon
rewriting). Phosphor's duotone two-tone fills are a visibly different idiom
that fought the flat neutral surfaces.

The migration was complete and mechanical: `@phosphor-icons/react` is removed
from `package.json`. **Do not reintroduce it** — two icon families in one UI is
a visible craft failure. Phosphor's `weight` prop has no lucide equivalent and
was stripped everywhere; use `strokeWidth` if a weight difference is genuinely
needed.

## Components (`src/components/ui/`) — shadcn/ui on Radix

`src/components/ui/primitives/` holds canonical shadcn components on Radix,
`class-variance-authority` and `tailwind-merge`. **Read
`primitives/README.md` before pasting anything in from upstream** — three
substitutions are required, and one of them is the brown active rule.

The PascalCase files beside it are this project's branded API and are what
screens import. Reach for these before inventing anything:

| Component | What it is |
|---|---|
| `PageHero` | The gradient banner that opens a screen. Five `tone`s; optional `stats` or a rotating disc ornament. |
| `Section` / `StaggerGrid` / `PageBody` | Page rhythm. `Section` is a titled block; `StaggerGrid` cascades its children in; `PageBody` is the scrolling body with the shared gutters and 8-unit stack. |
| `Card` + `CardHeader/Title/Description/Body/Footer` | 24px surface. `interactive` adds the hover outline. |
| `MotionCard` | `Card` that lifts and presses. `interactive` = pointer affordance; `lift` = motion only. Split on purpose: a card that merely *contains* buttons should press but must not promise a click it does not handle. |
| `StatTile` | Icon plate + label + large tabular figure. |
| `IconTile` | The rounded square an icon sits in. Tones include `gradient` (brand moments) and `active` (brown). |
| `Button` / `IconButton` / `Badge` | `variant="active"` / `tone="active"` / the `active` prop are the brown states. |
| `Input` / `Select` / `Switch` / `Modal` / `EmptyState` / `ThemeToggle` | As before, re-geometried. |

`Button`'s `nav` and `footer` variants (and `IconButton`'s) survive as
**deprecated aliases** of `ghost`/`default` so no call site broke during the
palette swap. No screen uses them any more; new code should not.

### Retired: the two-tone chrome

The previous system gave the sidebar rail a light kraft surface (`--nav-bg`)
and the sidebar foot / mobile tab bar a solid black one (`--footer-bg`), both
at the client's request ("el footer debe ser negro"), and both deliberately
frozen against the light/dark toggle.

**Both were retired with the coffee identity.** The reference draws its whole
chrome on one continuous background with hairline borders, and a black strip
inside an otherwise light minimal sidebar is precisely the "one dark section
pasted into a light page" tell this redesign existed to remove. Every
`--nav-*` / `--footer-*` token and its Tailwind utility is gone. The mobile tab
bar still reads clearly because the active tab now carries the brown pill,
which is a stronger signal on a light bar than the old text-colour change was
on black. If the client asks for the black footer back, it belongs as a new
explicit surface pair, not as a revival of those aliases.

## Floor plan editor (`src/components/floor-plan/`)

Unchanged in behaviour; restyled only. The notes that still matter:

- `statusMeta.ts` is the single source of truth mapping a `TableStatus` to its
  label and its **two separate class sets**: `svgFillClass`/`svgStrokeClass`
  for canvas shapes and `dotClass`/`bgSoftClass`/`borderClass`/`textClass` for
  ordinary HTML. Do not cross the two — Tailwind's `fill-*`/`stroke-*` only
  affect SVG and silently do nothing on a `<div>`.
- `TableShape.tsx` — pointer-capture drag (no window listeners),
  keyboard-reachable (arrows nudge, Enter/Space selects), optional grid-snap.
  Its selection ring is now `stroke-active` (brown) and its selected seats
  `fill-active-soft`.
- `FloorPlanCanvas.tsx` floors the plan at `minWidth: 600` inside an
  `overflow-auto` wrapper: below that the plan would shrink to an unusable size
  on a phone, so it pans instead of scaling. This is the one intentional
  horizontal-scroll surface in the product.
- `TableInspectorPanel` (≥ md) and `MobileTableSheet` (< md) share one
  `TableInspectorForm`, so both stay in sync.

## Responsive

Verified at ~400px: page gutters are `px-4` everywhere, grids stack to one
column, and the two wide tables (Productos 640px, Reservaciones 720px) each sit
in their own `overflow-x-auto` container so the page body itself never scrolls
sideways. The fixed-width sidebar (240px) and inspector column (300px) are both
`hidden … md:flex`.

## Known gaps for the next pass

- **No rendered visual verification.** No browser or screenshot tool was
  available; verification was a numeric contrast audit, a dev-server smoke
  test, a build, and a full manual code read. A real screenshot pass on a
  tablet is the obvious next step.
- No pan/zoom on the floor-plan canvas (fixed-viewBox with responsive scaling
  only).
- The JS bundle is 554 kB / 173.5 kB gzipped and trips Vite's 500 kB warning.
  Acceptable for a single-load tablet SPA, but `manualChunks` or route-level
  code splitting is the cheap win if it ever matters.
- Ventas' "histórico de comandas" still only shows comandas cobradas in the
  current session; the backend does not yet expose a closed-comanda listing.
  The stat tiles above it are real full-day figures from the report endpoint.
