# Chhaon Cafe Ops — PRD

## Original problem statement
Full-stack web app for **Chhaon Stays & Cafe** (homestay + cafe in Shoja, Himachal Pradesh).
Phase 1 = lightweight web-based ops platform to replace the WhatsApp-based cafe order workflow.
NOT a restaurant ERP. Priorities: simplicity, mobile-first, low training, <30s order entry, minimal clicks, clear status visibility.

## User personas
- **Admin** (Amrit / cafe manager / owner): manages menu, team, sees reports, all order ops.
- **Staff / volunteer** (kitchen, service, hosts): creates orders, updates status, generates bills, logs supply needs.

## User choices captured (verbatim)
- "We want only minimal easy to use behavioural addicting Ops System only" (no public landing).
- Custom JWT Auth (mobile number + password).
- Seeded admin: mobile `9625005516`, password `pahaadpremi`.
- Currency: INR (₹).

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async) — single file `/app/backend/server.py`. JWT (PyJWT) + bcrypt. All routes prefixed with `/api`. Admin user + 25 default menu items seeded on startup.
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn UI + sonner + lucide-react + framer-motion. Caveat (display) + Figtree (body) Google Fonts.
- **DB**: MongoDB collections: `users`, `menu_items`, `orders`, `supply_requests`, `counters`.

## Implemented (✅ 1st MVP — Feb 2026)
- Auth: `POST /api/auth/login` (mobile + password) → JWT; `GET /api/auth/me`; admin-only user CRUD (`/api/auth/users`).
- Menu CRUD with category, price, active toggle. 25-item seed.
- Order creation with guest name, room/walk-in toggle, multi-item cart, notes; auto-priced; auto order numbers per day.
- Order status kanban: New → Preparing → Ready → Served (color-coded per PRD).
- Kitchen view: active-only orders, oldest-first, urgency outline >12 min, big advance buttons.
- Bill view (`/orders/:id`): line items, subtotal, grand total, print-friendly.
- Daily Dashboard (admin): KPIs (orders, revenue served, AOV, total revenue), status breakdown, top dishes, recent orders, range filters (Today / Yesterday / Last 7 days / Custom).
- Supply Request List with one-tap quick adds and admin "to procure" aggregated view.
- Mobile-first responsive: bottom-nav on mobile, desktop top-nav, sticky header, big touch targets ≥48px.
- Role-gated routes (staff vs admin) with React Router guards.
- Custom branded UI: pine-cabin login, sage + tan + cream palette, Caveat handwritten headlines.

## Backlog
### P1
- Order timeline / activity log displayed on the Bill view (history is already saved server-side).
- Bulk "Serve all ready" button in kitchen.
- Per-day archive view (closed orders by date).

### P2
- KOT printer / thermal printer support (Phase 2).
- Light Kitchen Display System (auto-refresh sound).
- Per-room running tab (Phase 2 PMS integration).
- Optional GST / discounts.
- Brute-force login lockout (5 fails → 5 min cool-down).

### P3 (future phases per PRD)
- Full PMS, guest check-in/out, unified billing, inventory consumption tracking, vendor management, procurement planning.

## Test credentials
See `/app/memory/test_credentials.md`.
