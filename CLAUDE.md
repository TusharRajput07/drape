# Drape

Phone-first web app (installable PWA) for managing your own clothes: upload them (background removed in the
browser), build and save outfits, keep a Lookbook and a Wishlist, see wardrobe stats. Multi-user; every user
sees only their own data.

## Read before doing anything

The specs in `spec/` are the source of truth. Read the ones relevant to the task first:

- `spec/00-overview.md`: product, scope, **build plan (phases 0–10)**, working rules, open items
- `spec/01-database.md`: PostgreSQL schema, delete rules, triggers, seed data, flows, error mapping
- `spec/02-backend.md`: server structure, response envelope, auth, cursor pagination, all endpoints
- `spec/03-frontend.md`: client structure, routes, state, behaviour of every screen, styling, PWA

`prototype/index.html` is the approved visual reference. Where it differs from the specs, the specs win.
Its background removal, weather, wishlist fetching and storage are fake.

## How the owner wants to work

- **Ask before deciding.** If the spec is unclear, missing something, or seems wrong, ask the owner. Lay out the
  options with a recommendation and wait. Don't silently pick an approach, add features, or change scope.
- **Build one phase at a time** from `spec/00-overview.md`, and finish its "Done when" list before moving on.
- **Keep the spec in sync.** When a decision changes, update the relevant spec file (and its decisions log)
  in the same change as the code.
- Explain things simply when asked; the owner prefers short, plain explanations.

## Git workflow

- Repo: https://github.com/TusharRajput07/drape (public).
- `main` holds only finished, working code. All v1 work happens on the branch `feature/drape-v1`.
- Commit on `feature/drape-v1` at the end of each phase (and at sensible points inside a phase) with a clear message
  like `Phase 0: project setup`, and push. Never commit straight to `main`, and never merge into `main` without the owner saying so.

## Stack

- `client/`: React 19 + TypeScript, Vite, React Router, TanStack Query, Zustand, Axios, Zod, react-hook-form,
  shadcn/ui + Tailwind, lucide-react, sonner, vite-plugin-pwa
- `server/`: Node 24 LTS + TypeScript, Express 5, Zod, Prisma (+ hand-written SQL migrations), JWT + rotating refresh tokens
- Database: PostgreSQL on Neon. Images: Cloudinary (direct browser upload with a server signature)
- Weather: Open-Meteo. Background removal: in the browser (`@imgly/background-removal`, default model, WebGPU with CPU fallback; 03 §9.1)

## Rules that must always hold

- **Backend layers:** routes → controllers → services → Prisma. Controllers stay thin; only services and `db/` touch Prisma.
- **Frontend features** (`src/features/*`) own their pages, components and API hooks. Components never call Axios directly.
- **Every API response** uses the envelope `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`.
- **Every route requires login** except `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- **Every query is scoped to the logged-in user.** Another user's resource returns 404.
- **Lists use cursor pagination** (`limit`, `cursor` → `meta.nextCursor`, `hasMore`, `total`).
- **Deletes:** anything still in use is blocked with a clear message (item in outfits or looks, subcategory with
  items). Only an outfit's or look's own mapping rows cascade. Account delete removes everything, including Cloudinary files.
- **Duplicate outfits are impossible** (signature + deferred DB trigger). Outfit = 1 top, 1 bottom, 0–1 shoes, any accessories.
- **UI:** white background, Inter, accent colour from settings (plum default). **No dates shown anywhere.**
  The outfit builder rows are a fixed 30 / 60 / 10.
- **No logging libraries:** only `console.error` for unexpected errors and in catch blocks. No automated tests in v1.
- **The repo is public:** never commit `.env` or secrets. Passwords and refresh tokens are stored hashed only.

## Layout

```
drape/
├── CLAUDE.md
├── spec/        00-overview, 01-database, 02-backend, 03-frontend
├── prototype/   index.html (approved design)
├── client/      React app (created in phase 0)
└── server/      Express API (created in phase 0)
```
