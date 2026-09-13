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
2. **It would have destroyed the palette.** `init` rewrites the Tailwind entry
   CSS with its own gray OKLCH ramp. `src/styles/tokens.css` is a mature
   coffee-brand system (cream / kraft / espresso + terracotta) and is the thing
   the client asked us to *keep*.

So the components were ported by hand and `components.json` points `aliases.ui`
here. `npx shadcn@latest add <component>` works normally and lands in this
folder.

## Two deliberate deviations from upstream

Anything pasted in from the shadcn site needs these two substitutions:

| Upstream shadcn | Here | Why |
|---|---|---|
| `bg-accent` / `text-accent-foreground` | `bg-surface-hover` / `text-fg` | In shadcn, `accent` means "subtle hover tint". In this codebase `--accent` is the **brand terracotta** and the whole app already depends on that meaning, so the role is intentionally not aliased in `tokens.css`. |
| `lucide-react` icons | `@phosphor-icons/react` | Phosphor is already the project's icon system. Two icon libraries in one UI is a visible craft failure — one stroke weight, one family. |

Everything else (`bg-primary`, `text-muted-foreground`, `border-input`,
`ring-ring`, `bg-card`, `bg-popover`, `bg-destructive`, `bg-sidebar-*`) resolves
through the shadcn role-token block in `src/styles/tokens.css`, so upstream
classes render in the coffee palette untouched. `--primary` is the burnt
terracotta `#a8501f`.

## Motion

`tw-animate-css` (imported in `src/styles/global.css`) provides `animate-in` /
`animate-out` / `fade-in-0` / `zoom-in-95` / `slide-in-from-*` for Tailwind v4 —
it replaces the v3-only `tailwindcss-animate` plugin, which needs a JS config
this project does not have. `prefers-reduced-motion` is already neutralised
globally in `global.css`, so no component needs to guard it individually.
