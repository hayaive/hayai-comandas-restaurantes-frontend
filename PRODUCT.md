# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite, Tailwind CSS v4, Zustand for client state, React Router for navigation. [Inferred: no interactive stack round was available in this session; the parent brief already specified "React + TypeScript, usa Vite" explicitly. Zustand and React Router are standard, low-weight choices for the described store contract (`useFloorPlanStore`) and multi-section navigation, not a durable lock D.A.N.I must keep if the team decides otherwise.]

## Users

Restaurant floor and host staff (hosts, servers, shift managers) operating on tablet or desktop at a host stand or back-of-house terminal during live service. Primary job: know the real-time state of every table (free / reserved / occupied, who is seated) and keep the floor plan itself accurate as furniture changes (new tables, merged tables, event layouts). [Inferred from the brief; not confirmed with a live user interview.]

## Product Purpose

Hayai Comandas is a restaurant operations system (comandas/orders, sales, reservations). This surface, the floor plan editor, is the visual source of truth for a restaurant's table layout: staff build and maintain named layout templates (e.g. "Salon principal", "Evento boda", "Terraza") by placing, resizing capacity, labeling, and removing tables on a top-down 2D plan, and later read live table status against that same plan during service.

## Positioning

[Undecided / not yet established. This surface's job is operational clarity, not market positioning; no competitive claim is made here.]

## Operating Context

- Used at a host stand or POS terminal, primarily tablet and desktop; small mobile is not a priority per the brief.
- Runs during active service under variable ambient light (bright dining room by day, dim by night), so table status must read clearly in both light and dark themes.
- A restaurant maintains multiple named floor plan templates and switches between them (day-to-day service vs. a one-off event layout).
- No backend exists yet. J.O.R.B.I (data) and D.A.N.I (fullstack) are defining the real schema and API in parallel; this surface runs on in-memory mock data through a store shaped so its operations (`moveTable`, `addTable`, `removeTable`, `renameTable`, `setSeats`, template CRUD, status/occupant updates) can be rebound to a real API later without a rewrite.

## Capabilities and Constraints

- In scope for this delivery: the floor plan editor screen only (view, drag-reposition, add, delete, rename/label, set seat capacity, switch/create templates, and reflect live status: free/reserved/occupied with occupant name).
- Out of scope for this delivery (explicitly deferred to D.A.N.I): comandas/orders, sales, and reservations screens; authentication; backend/API integration. Placeholder routes exist so navigation reads as a complete app shell.
- No backend/auth in this pass; state is local mock data only.
- Table shapes: circle or square, freely positioned (no forced grid layout, optional grid-snap while dragging).

## Brand Commitments

Product name: "Hayai Comandas" (hayai, Japanese for "fast/quick" - the brief's own naming, not invented here). No existing logo, palette, or type system predates this build; none of the legacy AI-tell "Acme/Nexus" naming was used.

## Evidence on Hand

No real restaurant data, real table counts, real menu, or real staff names were supplied. All template names, table labels, and occupant names shipped in the mock store are clearly synthetic seed data for demonstration and must be replaced with real data once the API lands. No pricing, benchmarks, or commercial claims exist on this surface.

## Product Principles

1. The floor plan is the single visual source of truth: what staff see here must match what they can trust during live service.
2. Editing (layout) and observing (status) are two intents on one plan, not two screens: the same canvas serves both, distinguished by state color rather than mode-switching.
3. The store is the seam: every mutation goes through named operations now so swapping mock data for a real API later touches the store, not the canvas or panel components.
4. Familiar over clever: a host under service pressure should never have to learn a new interaction to move or relabel a table.

## Accessibility & Inclusion

No standard was mandated. Built to WCAG AA contrast and keyboard reachability as a baseline given this is a staff operational tool used under time pressure.
