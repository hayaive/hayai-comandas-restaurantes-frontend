# Design system — Hayai Comandas

<!-- impeccable:design-schema 1 -->

Direction: **soft neutral console**. An operational dashboard for a restaurant
floor, built to be scanned at a glance under service pressure. A chromatically
silent neutral canvas, very large radii, and exactly one warm colour — brown —
used both for primary actions and for everything that is currently selected.

> **This document was rewritten in Sep 2026, then updated twice more the same
> month.** The previous system ("specialty coffee house": cream / kraft /
> espresso neutrals, burnt-terracotta accent, 6/10/16px radii, Inter, Phosphor
> icons, a kraft sidebar rail and a solid black footer) was replaced wholesale
> at the product owner's request, who asked for a full visual clone of the
> `custom-globe-component` reference dashboard. Two follow-up requests then
> walked back specific pieces of that clone:
> 1. The five per-page gradient hero banners (Comandas/Mesero/Productos/
>    Reservaciones/Ventas) were removed — "quita los banners de cada menu".
>    `PageHero.tsx` is gone; each page opens straight into its content below
>    the top bar.
> 2. The reference's `violet → indigo → blue` brand family was retired
>    entirely — "no debe haber botones morados, cambiarlos por el marrón
>    actual" — and the ambient background wash went from a violet/blue blend
>    to a gray one — "el background gradiente … cambiarlo por gris y blanco".
>    `--accent`/`--primary` now point at the same brown as the active/selected
>    override, so the product has exactly one brand hue, not two.
> 3. The floor plan's grid-snap toggle was removed ("quita lo de ajustar
>    grilla") and a real mobile bug was fixed alongside it: dragging a table
>    used to open the mobile inspector sheet the instant a finger pressed
>    down, because `onSelect` fired on `pointerdown` rather than on release —
>    see *Floor plan editor* below for the tap/drag threshold that replaced
>    it. A follow-up visual pass then gave tables and chairs a real-wood
>    finish ("necesito que las mesas parezcan mesas reales de madera y las
>    sillas también parezcan sillas") — a new `--wood-*` token family plus a
>    reusable SVG gradient/pattern in `TableShape.tsx`/`FloorPlanCanvas.tsx`;
>    see *Colour* and *Floor plan editor* below.
>
> 4. **Four mobile bugs found by the client on a real phone** (Sep 2026,
>    D.A.N.I): dragging a table didn't work on touch at all, deleting a
>    plantilla silently reappeared, the plantilla-tab row scrolled sideways,
>    and the plan didn't fit the screen. See *Floor plan editor* below for all
>    four; none of them touch the wood finish or the status colours.
>
> Decisions that were reversed are recorded below with their reasoning rather
> than deleted, so nobody re-litigates them by accident.

## Direction contract

- **THESIS.** The floor plan is an instrument staff read at a glance, not a
  generic canvas app; every table communicates its state before its shape does.
  The surrounding product reads as one soft, quiet, large-radius system so that
  the three table-state colours and the one brown selection colour are the only
  things on screen competing for attention.
- **OWN-WORLD.** Pure neutral gray surfaces (zero saturation); **one brand
  colour — brown `#6f4a2e` — used for both primary actions and every
  active/selected state**, white text on both; a brown-toned gradient reserved
  for two "brand moment" surfaces (the mobile FAB, the `IconTile` gradient
  tone); three semantic table colours (emerald free / amber reserved / rose
  occupied) that borrow neither the brand nor the active-state usage of brown;
  Geist for UI and Geist Mono for every numeral; a 12 / 16 / 24px radius scale;
  a slow ambient gray-into-white gradient field behind the shell.
- **STORY.** A host scans the floor, taps a table to relabel or resize it in a
  docked inspector (never a modal for routine edits), drags it to a new spot
  (free positioning — the grid-snap toggle was removed per follow-up request),
  and switches or creates plan templates without leaving the canvas.
  A waiter picks a table, searches products, and sends an order in three
  numbered steps. A cashier reads the day's figures off three stat tiles.
- **FIRST VIEWPORT.** Sticky translucent top bar (title + actions) directly
  over stacked titled sections on an 8-unit rhythm. Each page used to open
  with a gradient hero banner carrying its live figures; those were removed
  (see the history note above) — the top bar's own title/subtitle and the
  first section now carry that job.
- **FORM.** Reference-driven. The visual language was extracted by reading
  `custom-globe-component/components/creative.tsx` in full — its sidebar
  anatomy, radius frequency (72 × `rounded-2xl`, 40 × `rounded-xl`, 23 ×
  `rounded-3xl`), card treatment, motion props and type scale — and
  re-expressed on this project's Vite + Tailwind v4 stack. No Next.js
  anything was carried over. The reference's gradient hero banners were
  ported at first, then removed per follow-up request; its violet/indigo/blue
  brand hue was ported and then replaced with brown per a second follow-up.
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
- **The mobile FAB** ("Agregar Orden") and the `IconTile` gradient tone keep a
  brand *gradient* rather than the flat active fill — it is an action/brand
  moment, not a state — but as of the brown pass below that gradient is brown
  too, not the reference's violet.

## Colour

Strategy: **restrained**. Neutrals carry the interface, one brown brand colour
is reserved for primary actions, brand-gradient moments, AND every
active/selected state (see the history note at the top of this document for
why that used to be two hues and now is not), three semantic colours are
reserved for table state. Tokens live in `src/styles/tokens.css` and are
mapped to Tailwind utilities via `@theme inline` in `src/styles/global.css`.
Never hardcode a hex in a component.

| Role | Token | Light | Dark |
|---|---|---|---|
| **Active / selected** | `--active-bg` | `#6f4a2e` | `#7d5436` |
| Active foreground | `--active-fg` | `#ffffff` | `#ffffff` |
| Brand (fill) | `--primary` | `#6f4a2e` | `#7d5436` |
| Brand (text) | `--accent` | `#6f4a2e` | `#d8b394` |
| Brand gradient | `--grad-brand-from/via/to` | `#8a5a35` / `#6f4a2e` / `#46301e` | same |
| Ambient wash | `--ambient-from/via/to` | gray (`--n-400/200/500`) | gray (`--n-600/800/500`) |
| Free | `--status-free` | `#059669` | `#10b981` |
| Reserved | `--status-reserved` | `#d97706` | `#f59e0b` |
| Occupied | `--status-occupied` | `#e11d48` | `#f43f5e` |
| Danger (text) | `--danger` | `#b91c1c` | `#f87171` |
| Danger (fill) | `--destructive` | `#b91c1c` | `#dc2626` |
| Surface | `--surface` | `#ffffff` | `#141414` |
| Background | `--bg` | `#fafafa` | `#0a0a0a` |
| Wood sheen / rim (table + chair finish) | `--wood-grain-1/2/3`, `--wood-rim` | `#f0d9ae` / `#d3a86e` / `#a97a45` / `#7c5330` | `#c99a63` / `#a97a45` / `#7c5330` / `#4a3018` |
| Chair wood | `--wood-seat` / `--wood-seat-rim` | `#c9986a` / `#6b4423` | `#96703f` / `#3a2512` |

`--primary`/`--accent` are literally the same value as `--active-bg`/
`--active-soft-fg` (light/dark respectively) — see the split note just below
for why dark mode still keeps them as separate token families even though the
colour is shared today.

The neutrals are deliberately **untinted**. The old scale was warm; mixing a
warm gray with a cool brand hue is the classic "two grays fighting" failure,
so the neutrals sit at zero saturation and let the (now brown) brand be the
only hue on screen — plus the gray ambient wash, which is neutral by design
and therefore does not compete with anything.

### Wood finish (floor plan tables and chairs), and why it does not compete with state

The client asked for tables and chairs to read as real wood rather than flat
geometric shapes. The `--wood-*` family is a deliberately **more golden,
honey-oak hue** than `--accent`/`--active` (a muted, dark coffee brown,
`#6f4a2e`/`#7d5436`) — the two must never be confusable, since a wood-finished
table sitting next to a *selected* brown-ringed table is exactly the situation
where that would matter.

The harder problem is that a table's fill/stroke is this product's primary
"what state is this" signal (see *THESIS* above) and wood is, unavoidably,
another color layered on the same shape. This was resolved by keeping the two
jobs on different parts of the shape instead of blending them:

- The **status fill** (`status.svgFillClass`, the pale `-soft` tint) and the
  **status stroke** (`status.svgStrokeClass`, the saturated ring) are
  completely untouched — same classes, same values, same audited contrast.
- The wood is a `radialGradient` (`#wood-grain-sheen`) layered on top, whose
  first stop is `stop-opacity: 0` at its own center. Because a table's label
  and seat-count text sit right at that center, they are rendered against
  essentially the unmodified status-soft fill; the wood only becomes visible
  once the gradient reaches roughly its outer half, i.e. toward the rim, right
  where the saturated status stroke already lives.
- A second, low-opacity (`0.5`) grain-line `<pattern>` (`#wood-grain-lines`)
  adds fine streaks across the whole shape; at that opacity over a pale base
  its effect on text contrast is negligible.

Net effect: a table's *center* still reads its exact pre-existing status
colour (free/reserved/occupied are still told apart primarily by that pale
fill plus the label/occupant-name colours), its *rim* reads as a genuinely
wood-toned edge, and its *stroke* — unchanged — is still the crisp,
high-saturation ring that is the fastest thing to spot across a room. Chairs
use a flat `--wood-seat` fill instead of a gradient (too small a shape for one
to read at `SEAT_RADIUS = 7`); selected-table chairs still fall back to the
existing `fill-active-soft` treatment, unchanged.

Both gradient/pattern `<defs>` are declared exactly once, in
`FloorPlanCanvas.tsx`, and referenced by every `TableShape` via
`fill="url(#...)"` — the cost does not scale with the number of tables drawn,
and no SVG filter (`feTurbulence`, blur) is used, per the host-stand-tablet
performance constraint elsewhere in this document.

### Tokens that are split in dark mode, and why

One value cannot always do two jobs. A contrast audit forced three splits —
still true after the brand colour changed from indigo to brown, just with new
numbers:

- **`--accent` vs `--primary`.** `--accent` is read as *text* on a near-black
  or dark-brown surface, so in dark mode it must be light — it now reuses
  `--active-soft-fg` (`#d8b394`), already measured legible on the dark brown
  soft background it was built for. `--primary` is a *fill* carrying white
  text, so it must stay dark — it reuses `--active-bg` (`#7d5436`, **6.58:1**
  with white text, the same measurement the active-state row above already
  relies on). Before the brand colour changed, this was `#818cf8` (6.18:1)
  vs `#4f46e5` (6.29:1); one indigo value had failed at 4.47:1 white-on-fill,
  which is why the split existed in the first place and why it was kept.
- **`--danger` vs `--destructive`.** Same shape: text hue vs fill hue.
  `#dc2626` measured **4.41:1** as text on its own soft background.
- **`--destructive-strong`** exists because the destructive button's hover used
  to be `brightness-110`; brightening a red fill *lowers* its contrast with the
  white label it carries. The hover is now an explicit darker token.

One fix made alongside the colour swap: `::selection` was reading
`background-color: var(--accent)`, which is correct in light mode (accent and
primary are the same value) but wrong in dark mode once `--accent` became the
light TEXT shade — white selected text on a light tan background reads as
light-on-light. It now reads `var(--primary)`, the dark FILL shade, matching
what the file already says `--primary` is for.

### Contrast audit

60 text/background pairs checked numerically in both themes as part of the
original clone; all cleared their floor. Notable results at the time (light
mode numbers below are unaffected by the later brown swap since `--primary`
was already equal to `--active-bg`'s light value in spirit — only the hex
changed):

| Pair | Light | Dark |
|---|---|---|
| White on active brown / primary (now the same token pair) | **7.79:1** | **6.58:1** |
| Secondary text (`--fg-muted`) on sunken surface | 7.17:1 | 8.22:1 |
| Hint/placeholder (`--fg-subtle`) on sunken surface | 4.89:1 | 5.34:1 |

Re-checked after the brown swap (Sep 2026, follow-up):

- **White icon on the brown brand gradient** (`--grad-brand-*`, mobile FAB /
  `IconTile` gradient tone): the lightest stop, `#8a5a35`, is the worst case at
  **5.84:1**; the other two stops measure higher (7.79:1 and 12.3:1). All clear
  the 4.5:1 floor. No text is rendered over this gradient any more (the hero
  banners that used to put description/stat text at 80% opacity over it were
  removed — see the history note at the top of this document), so the old
  80%-opacity check that drove the previous `-600` → `-700/-800` gradient move
  no longer applies; it is recorded here only so nobody re-derives it.
- **`::selection` white-on-fill in dark mode**, now `var(--primary)`
  (`#7d5436`): **6.58:1**, same measurement as the active-brown row above.
  Before this fix it read `var(--accent)` (`#818cf8` under the old indigo
  brand), which measured **2.98:1** — already failing, and not part of the
  original 60-pair audit. Fixed as a byproduct of the brown swap, not
  something separately requested.

Two fixes worth remembering from the original clone:

- The hero banners' gradient originally used Tailwind's `-600` stops, exactly
  like the reference, and at the 80% opacity their description/stat labels
  used, those measured **3.82–4.04:1**; the set moved one step deeper to
  `-700/-800` to fix it. The banners themselves are gone now (see the history
  note above), but the principle — a gradient that will carry text needs to be
  re-checked at whatever opacity that text uses — still applies to any future
  gradient-plus-text surface.
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
| Large display (brand mark, e.g. Login's "Coffee & Cake") | `text-2xl sm:text-3xl font-semibold` |
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
| `--radius-lg` | 24px | `rounded-3xl` | cards, panels, modals |
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
| ~~`PageHero`~~ | **Removed** (follow-up request, "quita los banners de cada menu"). Used to be the gradient banner that opened Comandas/Mesero/Productos/Reservaciones/Ventas. If a screen ever needs its live figures surfaced again, that is a new component, not a revival of this one, since the removal was a deliberate simplification, not an oversight. |
| `Section` / `StaggerGrid` / `PageBody` | Page rhythm. `Section` is a titled block; `StaggerGrid` cascades its children in; `PageBody` is the scrolling body with the shared gutters and 8-unit stack. |
| `Card` + `CardHeader/Title/Description/Body/Footer` | 24px surface. `interactive` adds the hover outline. |
| `MotionCard` | `Card` that lifts and presses. `interactive` = pointer affordance; `lift` = motion only. Split on purpose: a card that merely *contains* buttons should press but must not promise a click it does not handle. |
| `StatTile` | Icon plate + label + large tabular figure. |
| `IconTile` | The rounded square an icon sits in. Tones include `gradient` (brand moments, brown-toned) and `active` (brown flat fill). |
| `Button` / `IconButton` / `Badge` | `variant="active"` / `tone="active"` / the `active` prop are the brown states; `variant="primary"` / default tone are now brown too (see *Colour*). |
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

Restyled from the original clone, plus three follow-up fixes to table dragging
(the third being the real-phone pass below) and a mobile layout pass on the
template switcher and the canvas itself. The notes that still matter:

- `statusMeta.ts` is the single source of truth mapping a `TableStatus` to its
  label and its **two separate class sets**: `svgFillClass`/`svgStrokeClass`
  for canvas shapes and `dotClass`/`bgSoftClass`/`borderClass`/`textClass` for
  ordinary HTML. Do not cross the two — Tailwind's `fill-*`/`stroke-*` only
  affect SVG and silently do nothing on a `<div>`.
- **Grid-snap was removed** (follow-up request, "quita lo de ajustar
  grilla") — `BottomToolbar` no longer has the switch, `useFloorPlanStore` no
  longer has `snapToGrid`/`toggleSnapToGrid`, and `geometry.ts`'s `snap()`
  helper is gone. Tables now always move to exactly where they're dragged.
  `gridSize` survives on the store — it only sizes the dot-grid background
  pattern now, unrelated to movement.
- `TableShape.tsx` — pointer-capture drag (no window listeners),
  keyboard-reachable (arrows nudge, Enter/Space selects). Its selection ring
  is `stroke-active` (brown) and its selected seats `fill-active-soft`.
  **Tap vs. drag is now decided on release, not on press**: `onSelect` used to
  fire on `pointerdown`, so on mobile — where selecting opens a full-screen
  `MobileTableSheet` — starting a drag opened the sheet before the finger had
  moved, eating the gesture (follow-up bug report: "cuando quiero arrastrar
  automáticamente se abre el modal"). A `DRAG_THRESHOLD` (6px of client-space
  pointer travel) now gates it: below the threshold the gesture is a tap and
  selects on release; at or above it, the table moves and `onSelect` never
  fires for that gesture. The selection ring shows during a drag via local
  `isDragging` state regardless of global selection, so there is still visual
  feedback while repositioning an unselected table.
  **Real-phone follow-up (Sep 2026): dragging didn't work on touch at all.**
  The tap/drag split above was only ever verified with typecheck/lint/build,
  never on an actual touchscreen, and the client reported tables could not be
  dragged on mobile after it shipped. `touch-none` on the table `<g>` should
  stop a touch gesture from being reinterpreted as a scroll/pan of an ancestor
  (the canvas wrapper's `overflow-auto`, or the `<svg>`'s own
  `touch-pan-x touch-pan-y`) per the `touch-action` spec, but WebKit/Safari on
  iOS has a documented history of inconsistent `touch-action` support on SVG
  child elements — plausibly (not confirmed on a device this session) the
  browser was taking the gesture as a scroll before `pointermove` ever crossed
  `DRAG_THRESHOLD`. `handlePointerDown`/`handlePointerMove` now also call
  `event.preventDefault()` — the actual mechanism the Pointer Events spec
  defines for suppressing default touch behaviour from a non-passive handler,
  independent of `touch-action` support for the element type — which is why
  React's pointer handlers work here at all (native `touchstart`/`touchmove`
  listeners are passive by default in Chrome and can't `preventDefault()`).
  One side effect had to be corrected: `preventDefault()` on `pointerdown`
  also suppresses the browser's default "focus the target" behaviour, so
  `handlePointerDown` now calls `event.currentTarget.focus()` itself —
  otherwise tapping/clicking a table would stop moving focus there, breaking
  the keyboard `isFocused` ring. The tap-vs-drag decision logic itself
  (`DRAG_THRESHOLD`, deciding on release) was not changed — only reinforced.
  **Not verified on a real touchscreen this session** — no browser/device tool
  was available; this is reasoned from documented `touch-action`/Pointer
  Events behaviour, not confirmed by testing.
- `FloorPlanCanvas.tsx` no longer floors the plan at `minWidth: 600` on a
  phone. **Real-phone follow-up (Sep 2026):** the client asked explicitly for
  the whole plan to fit a phone's screen with no horizontal pan, which the old
  fixed floor prevented below ~600px wide. The floor now only applies from
  `md` up (`md:min-w-[600px]`) — tablet/desktop keeps the exact old behaviour
  (pan a wide 1200-unit plan inside a narrower window via the wrapper's
  `overflow-auto`, "the one intentional horizontal-scroll surface in the
  product" still holds there); below `md` the box is `w-full` and shrinks with
  the viewport, so `aspectRatio` and the shared `viewBox` scale every table,
  chair and label down proportionally instead. That proportional shrink makes
  labels noticeably smaller on a narrow phone than they were before (a ~360px
  phone now renders the plan at roughly half the scale factor the old 600px
  floor guaranteed), so `TableShape.tsx`'s label/seat-count/occupant text gets
  a mobile-only size bump (`text-[19px] md:text-[15px]` and similarly for the
  other two) as a legibility floor — a viewport-breakpoint heuristic, not a
  true container-size measurement (SVG has no container queries to key off),
  chosen deliberately over reintroducing any horizontal scroll on mobile.
  `TablePickerStep.tsx` (reservation flow's "elegir mesa" step) reuses this
  same canvas and gets the same behaviour for free. **Not verified visually on
  a real phone this session** — verified by reading the resulting scale math
  and the build output only; whether the bumped text still looks proportionate
  against the smallest tables at ~360px is the obvious thing to check first on
  a device.
- `TableInspectorPanel` (≥ md) and `MobileTableSheet` (< md) share one
  `TableInspectorForm`, so both stay in sync.
- **Wood finish** (follow-up request, "necesito que las mesas parezcan mesas
  reales de madera y las sillas también parezcan sillas") — see *Colour →
  Wood finish* above for the full contrast reasoning. Mechanically:
  - `geometry.ts`'s `getSeatPositions` now returns `{ x, y, angle }` instead of
    a bare point. `angle` is the degrees to rotate a chair so its backrest
    faces away from the table: exact (`0/90/180/-90`) for a square table's
    four edge normals, and derived from the seat's own radial position
    (equivalent) for a circular one. `SEAT_RADIUS` and the function's call
    sites are otherwise unchanged.
  - Each seat in `TableShape.tsx` is now a `<g transform="translate(...)
    rotate(angle)">` holding two rects — a small backrest rail and a seat
    pad — filled `fill-wood-seat`/`stroke-wood-seat-rim` (or the existing
    `fill-active-soft` when the table is selected, unchanged from before).
  - The table body's own fill/stroke classes are untouched; two more shapes of
    the same geometry are layered on top, filled from the shared
    `#wood-grain-sheen` radial gradient and `#wood-grain-lines` pattern
    declared once in `FloorPlanCanvas.tsx`'s `<defs>` (`pointer-events-none`,
    so they cannot interfere with the drag/select handlers on the wrapping
    `<g>`, which were not touched by this pass).
  - No SVG filter is used (no `feTurbulence`, no blur) — gradients and a
    reusable pattern only, per the host-stand-tablet performance note.
- **`TemplateSwitcher.tsx` — mobile no longer scrolls sideways (Sep 2026).**
  The pill row (`overflow-x-auto`) is unchanged but now `hidden md:flex`;
  below `md` it's replaced by the project's own `Select` (`components/ui/`,
  a styled native `<select>` chosen precisely because it opens the OS's
  thumb-sized picker on a phone) plus a separate "nueva" `IconButton` that
  opens `MobileNewTemplateSheet.tsx` — a third bottom sheet in the same
  portal/backdrop-blur/rounded-top/drag-handle language as
  `MobileMoreSheet.tsx` and `MobileTableSheet.tsx`, reused rather than
  inventing a fourth overlay pattern. Deleting stays the existing icon +
  confirmation `Modal`, now acting on whichever plantilla the mobile select
  currently shows. Desktop's inline pill create-input and delete button are
  untouched.
- **`useFloorPlanStore.ts`'s `removeTemplate` — deleting a plantilla could
  silently reappear (Sep 2026).** The backend legitimately refuses to delete
  a plantilla that still has reservaciones/comandas history (FK `RESTRICT` →
  422, see the backend's `PlantillasService.eliminar` comment and
  `PgErrorFilter`). The frontend already removed it optimistically and
  reverted on failure, but the revert called the store's own `load()`, whose
  very first line is `set({ status: "loading", error: null })` — since
  nothing awaited a render in between, that overwrote the just-set error
  before React ever painted it, so a failed delete looked like nothing
  happened except the plantilla coming back with no explanation. `removeTemplate`
  now reverts locally (puts the removed template back at its original index,
  restores `editingTemplateId` if it was the one open) instead of reloading
  everything, so the existing `error` banner in `FloorPlanPage.tsx` actually
  shows. **Not independently confirmed against the live backend this
  session** — confirmed by reading `PlantillasService.eliminar` and
  `PgErrorFilter`'s `23503` mapping, not by triggering a real 422.

## PWA / instalación

The app is installable — "Agregar a pantalla de inicio" on phones, "Instalar
app" in Chrome/Edge on desktop — via `vite-plugin-pwa` (`vite.config.ts`),
added Sep 2026 per the client's request to make the app installable from a
phone or a computer. This is technical installability, not a redesign; no new
visual language was introduced.

- **Icons.** Generated once from the existing `public/logo.jpg` (a temporary
  `sharp` devDependency ran a one-off resize script, then was removed —
  `public/pwa/` holds the static PNG output, nothing regenerates them at
  build time): `pwa-192x192.png` / `pwa-512x512.png` (`purpose: "any"`,
  cropped straight from the logo) and `maskable-192x192.png` /
  `maskable-512x512.png` (the logo padded ~16% onto a brand-brown `#6f4a2e`
  background so Android's circular/squircle mask never clips it), plus a
  180×180 `apple-touch-icon.png` for iOS. `favicon.png` is unchanged.
- **Manifest colours.** `theme_color` (`#6f4a2e`) and `background_color`
  (`#fafafa`) are `--accent-500` and `--bg`/`--n-25` from `tokens.css` — the
  product's one real brand hue and its lightest neutral, not invented values.
- **Service worker scope — operational data is never cached.** This app is
  used live during service, so `workbox.generateSW` only precaches the built
  app shell (JS/CSS/fonts/static images via `globPatterns`) and answers
  offline deep links with `navigateFallback: "index.html"`. There is an
  explicit `NetworkOnly` `runtimeCaching` rule matching `/api/` so mesas,
  comandas, productos, reservaciones and ventas requests always hit the
  network — see `src/api/httpClient.ts`'s `VITE_API_URL`, which can point at
  a same-origin `/api/...` path or a different origin depending on
  deployment; the pattern covers both rather than relying on "nothing else
  matches it."
- **Updates — explicit prompt, not silent `autoUpdate`.** `registerType:
  "prompt"` plus `PwaUpdateBanner.tsx` (mounted in `App.tsx` via
  `virtual:pwa-register/react`'s `useRegisterSW`) surfaces a small "hay una
  actualización disponible" banner that only reloads when staff tap it. A
  restaurant floor is exactly the environment where a background deploy
  should not silently swap the running app shell out from under a host or
  waiter mid-order; the banner also never self-dismisses, so nobody stays
  stuck on a stale build indefinitely either — full reasoning is in both
  files' comments.
- **Not verified live.** No browser/Lighthouse tool was available this
  session — confirmed: `manifest.webmanifest`, `sw.js` and the icons build
  correctly into `dist/` and are referenced from `dist/index.html`. Not
  confirmed: that Chrome/Edge/Android/iOS actually show the install
  affordance in practice.

## Responsive

Verified at ~400px: page gutters are `px-4` everywhere, grids stack to one
column, and the two wide tables (Productos 640px, Reservaciones 720px) each sit
in their own `overflow-x-auto` container so the page body itself never scrolls
sideways. The fixed-width sidebar (240px) and inspector column (300px) are both
`hidden … md:flex`. As of the Sep 2026 real-phone pass (see *Floor plan
editor*), the floor-plan canvas itself is in this list too: below `md` it is
no longer a fixed-floor horizontal-scroll surface, it shrinks to the viewport
like everything else.

## Known gaps for the next pass

- **No rendered visual verification.** No browser or screenshot tool was
  available; verification was a numeric contrast audit, a dev-server smoke
  test, a build, and a full manual code read. A real screenshot pass on a
  tablet is the obvious next step. This also covers the Sep 2026 floor-plan
  mobile pass specifically: the touch-drag `preventDefault()` fix, the mobile
  template switcher/bottom sheet, and the canvas-fits-the-phone + text-size
  compensation are all reasoned from code and spec behaviour, not confirmed
  on a real touchscreen.
- No pan/zoom on the floor-plan canvas (fixed-viewBox with responsive scaling
  only, down to whatever width `md` and below allow).
- The JS bundle is 554 kB / 173.5 kB gzipped and trips Vite's 500 kB warning.
  Acceptable for a single-load tablet SPA, but `manualChunks` or route-level
  code splitting is the cheap win if it ever matters.
- Ventas' "histórico de comandas" still only shows comandas cobradas in the
  current session; the backend does not yet expose a closed-comanda listing.
  The stat tiles above it are real full-day figures from the report endpoint.
