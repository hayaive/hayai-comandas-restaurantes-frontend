# `ui/primitives` — shadcn/ui

Canonical [shadcn/ui](https://ui.shadcn.com) components on Radix UI. These are
the unstyled-behaviour + base-styling layer. The PascalCase components one
directory up (`ui/Button.tsx`, `ui/Modal.tsx`, …) are this project's *branded
API* built on top of them, and are what screens import.

## Why this folder exists instead of `ui/` directly

`npx shadcn@latest init` was not run against `src/components/ui` for two
reasons, both concrete:

1. **Case collision on Windows.** shadcn writes `button.tsx`; this repo already
   has `Button.tsx`. NTFS is case-insensitive, so the CLI would have silently
   overwritten the component every screen imports.
2. **It would have overwritten the token file.** `init` rewrites the Tailwind
   entry CSS with its own OKLCH ramp. `src/styles/tokens.css` is hand-authored
   and carries the client's non-negotiable active-state rule (see below), which
   `init` knows nothing about.

So the components were ported by hand and `components.json` points
`aliases.ui` here. `npx shadcn@latest add <component>` works normally and lands
in this folder.

## Three deliberate deviations from upstream

Anything pasted in from the shadcn site needs these substitutions:

| Upstream shadcn | Here | Why |
|---|---|---|
| `bg-accent` / `text-accent-foreground` | `bg-surface-hover` / `text-fg` | In shadcn, `accent` means "subtle hover tint". In this codebase `--accent` is the **brand brown** and the whole app depends on that meaning, so the role is intentionally not aliased in `tokens.css`. |
| `data-[state=active]:bg-background`, `bg-primary` **used to mean "selected"** | `bg-active text-active-fg` | **The client override.** Every active / selected / currently-chosen control in this product is BROWN with WHITE text. `--primary` means "this is the main action here" and must not be used to mean "this one is selected". See `tokens.css`. |
| `rounded-md` / `rounded-lg` | `rounded-[var(--radius-sm\|md\|lg)]` | The radius scale (12 / 16 / 24px) is the product's strongest visual signature, and it is driven entirely from four token values. Nothing in `src/` may write a literal Tailwind radius class — changing the four tokens must re-shape the whole product. |

Icons are **`lucide-react`**, which is also what upstream shadcn uses, so icon
imports can now be pasted in unchanged. (This reversed a previous decision:
the project ran on `@phosphor-icons/react` under the old visual system. Phosphor
was dropped from `package.json` — do not reintroduce it, since two icon
families in one UI is a visible craft failure.)

Everything else (`bg-primary`, `text-muted-foreground`, `border-input`,
`ring-ring`, `bg-card`, `bg-popover`, `bg-destructive`, `bg-sidebar-*`)
resolves through the shadcn role-token block in `src/styles/tokens.css`, so
upstream classes render correctly with no rewriting.

Note that `--danger`/`--destructive` and `--accent`/`--primary` are each split
into a **text hue** and a **fill hue** in dark mode. A single value cannot both
be legible as text on a near-black surface and hold white text as a fill; the
comments in `tokens.css` carry the measured numbers.

## Motion

Two systems, and they do not overlap:

- **CSS** — `tw-animate-css` (imported in `src/styles/global.css`) provides
  `animate-in` / `animate-out` / `fade-in-0` / `zoom-in-95` / `slide-in-from-*`
  for every Radix `data-[state]` transition. It replaces the v3-only
  `tailwindcss-animate` plugin, which needs a JS config this project does not
  have. `prefers-reduced-motion` is neutralised globally in `global.css`, so no
  component guards it individually.
- **Framer Motion** — used only in the branded layer above this folder, never
  in `primitives/`. It animates inline styles and therefore *escapes* the CSS
  reduced-motion guard, so every animated component takes its variants from
  `src/lib/useAppMotion.ts`, which honours the preference in JS. The app is
  wrapped in `<LazyMotion features={domAnimation} strict>`; `strict` makes
  `motion.div` throw, so use `m.div`.
