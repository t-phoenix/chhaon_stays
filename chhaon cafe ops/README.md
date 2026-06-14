# Chhaon Cafe Ops

Lightweight operations platform for **Chhaon Stays & Cafe** (homestay + cafe in Shoja, Himachal Pradesh). Replaces WhatsApp-based order workflows with a mobile-first web app for order entry, kitchen coordination, supply logging, and admin reporting.

Not a restaurant ERP — optimized for speed, low training, and minimal clicks.

## Quick start

**Prerequisites:** Python 3.11+, Node.js 18+, Yarn, and MongoDB (local install or Docker).

### 1. MongoDB

Easiest option — Docker:

```bash
docker run -d --name chhaon-mongo -p 27017:27017 mongo:7
```

If the container already exists: `docker start chhaon-mongo`

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy or create `backend/.env` (see [Local development → Backend](#backend) for all variables). Minimum for local dev:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=<random-secret>
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
ADMIN_MOBILE=9625005516
ADMIN_PASSWORD=<your-password>
ADMIN_NAME=Amrit
```

Start the API:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

On first run, the server seeds the admin user and default menu items.

### 3. Frontend

In a second terminal:

```bash
cd frontend
yarn install
```

Set `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Start the app:

```bash
yarn start
```

### 4. Open the app

- **App:** http://localhost:3000
- **Login:** http://localhost:3000/login (Staff or Admin tab)
- **API health:** http://localhost:8000/api/health

Admin credentials are in `backend/.env` (`ADMIN_MOBILE` + `ADMIN_PASSWORD`). See [memory/test_credentials.md](memory/test_credentials.md) for roles and test accounts.

## Architecture

```
┌─────────────────┐     httpOnly JWT cookie      ┌──────────────────────────┐
│  React 19 SPA   │ ◄──────────────────────────► │  FastAPI (server.py)     │
│  Tailwind/shadcn│     /api/*  + Bearer tests   │  Motor + MongoDB         │
└─────────────────┘                              └──────────────────────────┘
```

| Layer | Stack |
|-------|-------|
| Frontend | React 19, React Router 7, Tailwind CSS, shadcn/ui, axios, sonner |
| Backend | FastAPI, Motor (async MongoDB), PyJWT, bcrypt |
| Database | MongoDB — collections: `users`, `menu_items`, `orders`, `supply_requests`, `counters` |

### Auth flow

1. **Admin**: mobile + password → `POST /api/auth/login` → JWT stored in httpOnly cookie (`chhaon_access`)
2. **Staff**: mobile + 4–6 digit passcode → `POST /api/auth/staff-login` (staff role only)
3. Frontend sends cookies via `withCredentials: true`; no token in localStorage
4. `GET /api/auth/me` restores session on page load
5. Backend `require_admin` dependency gates privileged routes; frontend `Protected admin` routes + nav filtering mirror this

### User roles

| Role | Login | Capabilities |
|------|-------|--------------|
| **admin** | Mobile + password | Full access: menu/prices, reports, team, supply admin, delete orders |
| **staff** | Mobile + passcode | Orders, kitchen, supply requests, bills — no menu edits, team, or reports |

Admin is seeded on startup from env vars. Staff accounts are created by admin on the **Team** page with an admin-set passcode (resettable via key icon).

See [memory/test_credentials.md](memory/test_credentials.md) for test accounts.

## Directory structure

```
chhaon cafe ops/
├── backend/
│   ├── server.py           # Single-file API (all routes, models, seed)
│   ├── requirements.txt
│   ├── tests/
│   │   └── backend_test.py # Integration tests (pytest + requests)
│   └── .env                # Secrets — not committed
├── frontend/
│   ├── src/
│   │   ├── App.js          # Routes + Protected guards
│   │   ├── context/AuthContext.jsx
│   │   ├── components/Layout.jsx
│   │   ├── lib/api.js      # Axios client
│   │   └── pages/          # Login, Orders, Kitchen, Menu, Dashboard, …
│   ├── package.json
│   └── .env                # REACT_APP_BACKEND_URL
├── memory/
│   ├── PRD.md
│   ├── test_credentials.md
│   └── BILLING_PLAN.md     # Payment status — not yet implemented
└── test_reports/           # CI / iteration artifacts
```

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+ and Yarn
- MongoDB running locally (or remote URI)

### Backend

```bash
cd "/Users/abhinilagarwal/Desktop/chhaon-stays/chhaon cafe ops/backend"
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Random secret for signing JWTs |
| `CORS_ORIGINS` | Comma-separated frontend origins (include `http://localhost:3000`) |
| `COOKIE_SECURE` | `false` for local HTTP dev, `true` in production |
| `COOKIE_NAME` | Cookie name (default `chhaon_access`) |
| `ADMIN_MOBILE` | 10-digit admin mobile (seeded on startup) |
| `ADMIN_PASSWORD` | Admin password |
| `ADMIN_NAME` | Admin display name |

Run:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Startup seeds admin user (if missing) and 25 default menu items (if collection empty).

### Frontend

```bash
cd "/Users/abhinilagarwal/Desktop/chhaon-stays/chhaon cafe ops/frontend"
yarn install
```

Set `frontend/.env`:

```
REACT_APP_BACKEND_URL=http://localhost:8000
```

For local dev, set `COOKIE_SECURE=false` in backend `.env` so cookies work over HTTP.

Run:

```bash
yarn start
```

App opens at `http://localhost:3000`. Sign in at `/login` (Staff or Admin tab).

## Testing

Backend integration tests hit a running API (local or deployed):

```bash
cd "/Users/abhinilagarwal/Desktop/chhaon-stays/chhaon cafe ops/backend"
export REACT_APP_BACKEND_URL=http://localhost:8000   # or deployed URL
export ADMIN_MOBILE=<your-admin-mobile>
export ADMIN_PASSWORD=<your-admin-password>
pytest tests/backend_test.py -v
```

Tests cover auth (admin + staff passcode), menu CRUD, orders, dashboard RBAC, supply, and team management.

## Deployment

The codebase supports a split deployment pattern (as used on Emergent preview):

| Service | Command | Notes |
|---------|---------|-------|
| API | `uvicorn server:app --host 0.0.0.0 --port $PORT` | Set `COOKIE_SECURE=true`, production `CORS_ORIGINS` |
| SPA | `yarn build` → static host | Set `REACT_APP_BACKEND_URL` to API origin at build time |

Requirements:
- MongoDB accessible from API host
- Frontend origin listed in `CORS_ORIGINS`
- HTTPS in production (required for secure cookies)

No Docker or render.yaml is included in-repo; add per your hosting choice.

## API overview

Base path: `/api`. All routes except `/`, `/health`, and `/auth/login` require authentication.

### Auth

| Method | Path | Access |
|--------|------|--------|
| POST | `/auth/login` | Public — admin (or any user with password) |
| POST | `/auth/staff-login` | Public — staff passcode only |
| POST | `/auth/logout` | Auth |
| GET | `/auth/me` | Auth |
| GET | `/auth/users` | Admin |
| POST | `/auth/users` | Admin — create team member |
| PATCH | `/auth/users/{id}/passcode` | Admin — reset staff passcode |
| DELETE | `/auth/users/{id}` | Admin |

### Menu

| Method | Path | Access |
|--------|------|--------|
| GET | `/menu?active_only=true` | Auth |
| POST | `/menu` | Admin |
| PATCH | `/menu/{id}` | Admin |
| DELETE | `/menu/{id}` | Admin |

### Orders

| Method | Path | Access |
|--------|------|--------|
| POST | `/orders` | Auth |
| GET | `/orders?status=&active_only=` | Auth |
| GET | `/orders/{id}` | Auth |
| PATCH | `/orders/{id}/items/{line_id}/status` | Auth — per-dish status |
| POST | `/orders/{id}/items` | Auth — add more dishes to open order |
| DELETE | `/orders/{id}` | Admin |

## Low-network & offline operation

Chhaon Cafe Ops is built for spotty connectivity in the mountains.

### How it works on devices

1. **IndexedDB cache** — orders and menu are stored locally on each phone/tablet.
2. **Offline queue** — new orders and status updates are saved immediately on-device if the API is unreachable.
3. **Auto-sync** — when the network returns, pending changes upload automatically (banner shows pending count).
4. **Service worker** — app shell loads even with weak signal.

Staff see an orange banner when offline; green when syncing.

### Phone-to-phone mesh sync (Capacitor app)

Staff phones can sync orders **directly over WiFi** — no internet and no laptop hub required.

| Layer | What it does |
|-------|----------------|
| **Capacitor shell** | iOS/Android native app wrapping the React build |
| **mDNS discovery** | `CafeMeshDiscovery` plugin finds peers on `_chhaon-ops._tcp` |
| **LAN signaling** | `CafeMeshSignaling` plugin — WebSocket handshake only (SDP/ICE) |
| **WebRTC mesh** | `simple-peer` partial mesh (2–4 peers), gossip every ~4s |
| **Merge engine** | Lamport clock + per-item status state machine |
| **Cloud bridge** | `POST /api/sync/ops` when internet returns |

#### Recommended topology

1. **Admin phone runs a WiFi hotspot** (not guest/isolated WiFi).
2. All staff install the **Capacitor app** (`yarn build:mobile` then Xcode/Android Studio).
3. Admin sets the **daily mesh PIN** under Team → Phone mesh sync (default from `MESH_PIN` env, e.g. `cafe1`).
4. Phones auto-discover peers on login. If mDNS fails (iOS privacy, AP isolation), use **Join mesh** → QR scan.

#### Build the mobile app

```bash
cd frontend
yarn install
yarn build:mobile    # build + cap sync
yarn cap:ios         # open Xcode
yarn cap:android     # open Android Studio
```

Browser/PWA users still get cloud + solo offline sync; mesh requires the native app.

#### QR fallback

Host phone: **Join mesh → Show my QR**. Joiner: **Scan QR** on the same hotspot. Handshake completes over WebRTC DataChannels; order data never touches the signaling server.

#### API endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/auth/mesh-pin` | Auth — read daily PIN |
| PATCH | `/auth/mesh-pin` | Admin — set daily PIN |
| POST | `/sync/ops` | Auth — batch op ingest (idempotent by `opId`) |
| GET | `/sync/snapshot?since_lamport=` | Auth — bulk catch-up |

### Cloud + LAN hub (alternative)

All cafe devices on the **same local WiFi** can share one backend without internet:

1. Run MongoDB + backend on one laptop/RPi on the cafe LAN:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
2. Find that machine's LAN IP (e.g. `192.168.1.42`).
3. On every staff phone, set `REACT_APP_BACKEND_URL=http://192.168.1.42:8000` and open the app.

### Pure offline (no server, no mesh peers)

Each device still takes orders offline. When any device reconnects, its queue syncs to the cloud backend.


| Method | Path | Access |
|--------|------|--------|
| GET | `/dashboard?range=today\|yesterday\|7d\|custom` | Admin |
| GET/POST | `/supply` | Auth |
| GET | `/supply/aggregated` | Admin |
| DELETE | `/supply/{id}`, `/supply` | Admin |

## Billing status

**Not implemented.** Orders track kitchen status and totals only — no payment collected/pending state.

See [memory/BILLING_PLAN.md](memory/BILLING_PLAN.md) for the proposed data model, endpoints, and UI workflow.

## Related docs

- [memory/PRD.md](memory/PRD.md) — product requirements and backlog
- [memory/test_credentials.md](memory/test_credentials.md) — roles and test logins
- [memory/BILLING_PLAN.md](memory/BILLING_PLAN.md) — payment status implementation plan
