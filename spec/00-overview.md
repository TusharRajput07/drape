# 00 — Overview & Build Plan

Start here. This file explains what the app is, lists the other spec files, and gives the order to build it in.

---

## 1. The product

**Problem:** the owner has a lot of clothes and gets stuck deciding what to wear when going out.

**Solution:** **Drape**, a phone-first web app (installable as a PWA) where each user:
1. photographs their clothes; the background is removed in the browser, so every piece sits on clean white,
2. browses their closet by category, subcategory, colour and likes,
3. mixes tops, bottoms and shoes in a swipeable **outfit builder** and saves combinations,
4. picks an outfit for the day, with the **weather** and a short what-to-wear tip on the Outfits page,
5. keeps a **Lookbook** of photos of themselves wearing outfits, tagged with the pieces,
6. keeps a **Wishlist** of clothes to buy from any shop (paste a link),
7. sees **Wardrobe stats** (colour mix, category split, most styled, unused pieces).

**Users:** anyone can sign up. Each user sees only their own data. Every screen except login/signup requires being logged in.

**Look and feel:** minimal, white background, Inter font, one accent colour (plum by default, changeable in Settings), Whering-style profile header. **No dates shown anywhere.**

**Visual reference:** the approved prototype `prototype/index.html`
(https://claude.ai/artifact/1VpiD9w8AbgZQNMJsteY9y). Where the specs and the prototype differ, **the specs win**.
The prototype's background removal, weather, wishlist fetching and storage are fake stand-ins.

---

## 2. Spec files

| File | Contents |
|---|---|
| `00-overview.md` | This file: product, scope, build order, working rules |
| `01-database.md` | PostgreSQL schema (14 tables), delete rules, triggers, seed data, data flows, error mapping |
| `02-backend.md` | Express + Prisma server: folder structure, response format, auth, pagination, every endpoint |
| `03-frontend.md` | React app: folder structure, routes, state, every screen's behaviour, styling, PWA |

---

## 3. Scope

### In v1
- Email + password accounts (signup, login, stay logged in for 30 days, logout, delete account)
- Profile: name, @username, profile photo, cover photo
- Closet: upload (optional in-browser background removal, required subcategory, auto colour), browse, filter, like, change subcategory/colour, delete (blocked while used)
- Per-user subcategories (starter list + add/rename/delete)
- Outfit builder (fixed 30/60/10 rows, subcategory filter per row, shuffle, lock), accessories, favourites, edit, delete, no duplicates
- Liked page (clothes | outfits)
- Lookbooks (own photos + item tags)
- Wishlist (paste a link; name/photo fetched when possible; duplicate links blocked)
- Wardrobe stats
- Weather (location or saved city; °C/°F) on the Outfits page and as a pill on the cover
- Settings: profile, accent colour, weather, subcategories, account
- Installable PWA (home-screen icon; no offline data)

### Not in v1 (decided)
- AI features beyond background removal (no outfit suggestions, chat or auto-tagging)
- Email verification and password reset
- Logging libraries; automated tests
- Offline browsing, dark mode, device/session list
- Item name, brand, notes or price; wishlist prices
- Public profiles or sharing

---

## 4. Tech summary

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript, Vite, React Router, TanStack Query, Zustand, Axios, Zod, react-hook-form, shadcn/ui + Tailwind, PWA |
| Backend | Node 24 LTS + TypeScript, Express 5, Zod, Prisma, JWT + rotating refresh tokens |
| Database | PostgreSQL on Neon (free) |
| Images | Cloudinary (free); browser uploads directly with a server-signed request |
| Background removal | In the browser: `@imgly/background-removal`, default model, WebGPU with multi-threaded CPU fallback (chosen in phase 1, 03 §9.1) |
| Weather | Open-Meteo (free, no key) |
| Repo | One public repository: `client/`, `server/`, `spec/`, `prototype/` |

---

## 5. Build plan

Build in this order. Each phase ends with a **"Done when"** list, checked by hand (there are no automated tests in v1).
Don't start a phase until the previous one is done.

### Phase 0 — Project setup
- Create `client/` (Vite React TS) and `server/` (Express TS) with strict `tsconfig`s.
- Add `.env.example` files from 02 §10 and 03 §2. Add `.gitignore` (never commit `.env`).
- Create the Neon project and the Cloudinary account; fill local `.env` files.

**Done when:** `npm run dev` starts both apps; the server answers `GET /api/v1/unknown` with the standard 404 error envelope.
(Since phase 3 an unknown `/api/v1` path needs a valid token to get the 404; without one it's 401, see 02 §6.)

### Phase 1 — Background-removal model test (throwaway)
- Build the side-by-side test page from 03 §9.1 and run it on 10 of the owner's real clothes photos.

**Done when:** the owner has picked the model; the choice is written into 03 §9.1.

### Phase 2 — Database
- `schema.prisma` matching 01 exactly (names mapped to snake_case).
- Migrations: the citext extension first; tables; then the hand-written SQL (partial indexes, CHECKs, `set_updated_at`, `check_outfit` + triggers) per 02 §4.
- `seed.ts` with categories (incl. outfit min/max), 16 colours, subcategory templates.

**Done when:** a fresh Neon database migrates and seeds without errors, and these manual SQL checks behave as 01 says:
- an outfit with the same items twice → unique violation
- an outfit with two tops or no bottom → check violation at commit
- deleting an item that's in an outfit → blocked
- deleting a user → everything of theirs disappears

### Phase 3 — Backend foundation
- `app.ts` middleware order (helmet, cors, json limit, cookies), `config/env.ts`, Prisma client.
- `api-response`, `AppError`, `prisma-errors`, `validate`, `not-found`, `error-handler`.
- Auth: signup (with the settings row and subcategory copy), login, refresh (rotation + reuse detection), logout, rate limit.
- `authenticate` middleware, `GET/PATCH /me`, `PATCH /me/settings` (with geocoding).

**Done when:**
- every route except the four auth routes returns `401 UNAUTHENTICATED` without a token
- an expired access token returns `TOKEN_EXPIRED` and refresh issues a new one
- reusing an old refresh token kills the session
- all responses use the envelope

### Phase 4 — Backend wardrobe features
- Lookups, subcategories (409 when in use), upload signature + verification, items (filters + cursor pagination + blocked delete).
- Outfits (category checks, duplicate/invalid mapping), looks, wishlist (normalize, fetch, SSRF guard, Cloudinary copy).
- Stats, weather (+ 15-min cache), avatar/cover, delete account (Cloudinary clean-up + cascade).

**Done when:** every endpoint in 02 §8 works, including:
- user A can never read or change user B's data (404)
- pagination never repeats or skips items while new ones are added
- every error code in 02 §5.1 can be triggered on purpose

### Phase 5 — Frontend foundation
- Tailwind + shadcn setup with the theme variables (03 §7), Inter.
- Router with `ProtectedRoute`, `AppLayout` + bottom nav + the "+" sheet, `PageHeader`.
- `lib/api.ts` with the refresh interceptor; auth store; Login and Signup pages.
- PWA manifest + service worker (03 §10).

**Done when:**
- you can sign up, reload the page and still be logged in, and log out
- the app installs to a phone's home screen

### Phase 6 — Closet and upload
- Profile header, category tabs, infinite grid, filter sheet, item detail sheet.
- Upload flow: photo tip, EXIF orientation + rotate button (before removal), background removal (lazy-loaded, first-use progress, WebGPU with CPU fallback), transparency check, subcategory picker with "+ New", colour detection, compression, direct Cloudinary upload, save.
- Decide HTTPS + cross-origin isolation for background removal first (open item in §7 and 03 §12).

**Done when:** an item can be uploaded with and without background removal, appears on the right tab, and can be liked, re-categorised, filtered and deleted (or blocked when used).

### Phase 7 — Outfits, builder, liked
- Outfits page + detail sheet; builder (30/60/10, snap, shuffle, lock, subcategory dropdown); accessories sheet; edit mode; favourites; Liked page.

**Done when:** saving the same outfit twice shows "You already saved this outfit"; edit keeps the same outfit; hearts update instantly.

### Phase 8 — Lookbooks and wishlist
- Lookbooks grid, add look (photo + tags), detail sheet (edit tags, delete).
- Wishlist add (pending card, duplicate message), cards opening the shop, remove with confirm.

**Done when:** a Myntra and an Amazon link can be added (with or without a photo); the same link is refused the second time.

### Phase 9 — Stats, settings, weather
- Stats page (donut + bars + cards); Settings (profile photos, accent, weather, subcategories, delete account); weather pill + card with geolocation fallback.

**Done when:** changing the accent recolours the app instantly; the weather follows location or city and °C/°F; deleting the account removes the user's photos from Cloudinary.

### Phase 10 — Polish and launch
- Empty states, loading skeletons, error toasts per 03 §11, reduced motion, accessibility labels.
- Decide hosting (must not sleep for long), set the cookie `SameSite` and CORS for production, schedule the two cleanup jobs.

**Done when:** the owner uses it on their phone for a week without blockers.

---

## 6. Working rules for building with Claude Code

1. **The specs are the source of truth.** Build what they say. If something is unclear, missing or seems wrong, **ask the owner before deciding**. Don't guess.
2. **Change the spec when a decision changes.** Update the relevant file and its decisions log in the same change as the code.
3. **One phase at a time,** finishing its "Done when" list before moving on.
4. **Keep the agreed structure:**
   - Backend layers: routes → controllers → services → Prisma.
   - Frontend features own their pages, components and API hooks.
   - Every response uses the standard envelope.
5. **Every query is scoped to the logged-in user.**
6. **Security basics:**
   - No secrets in the repo (it's public).
   - Passwords are only stored hashed.
   - Refresh tokens are only stored hashed.
   - Validate every input with Zod.
7. **No dates in the UI.** No logging beyond `console.error` for errors.

---

## 7. Open items

| Item | Owner | Needed by |
|---|---|---|
| 5 category tab photos (all, top, bottom, shoes, accessory) | Owner | Phase 6 |
| HTTPS + cross-origin isolation (COOP/COEP) for background removal, incl. the effect on Cloudinary and wishlist images (03 §12) | Owner + Claude | Phase 6 / hosting |
| Hosting choice | Owner + Claude | Phase 10 |

---

## 8. Decisions log

| Topic | Decision |
|---|---|
| Node version | Node 24 LTS (was 22) for both apps; `engines` set in each `package.json` |
| Dev command | Root `package.json` runs client and server together with `concurrently` (`npm run dev`); each app keeps its own `node_modules` (no workspaces) |
| Server dev tooling | ESM (`"type": "module"`), `tsx watch` in dev, `tsc` build to `dist/` |
| Phase 0 server files | The envelope helper, `AppError`, `not-found`, `error-handler` and `config/env.ts` are built to their final spec in phase 0 (needed for the 404 check); phase 3 adds the rest |
| Dependencies | Installed per phase, only when first used |
| Formatting / linting | Prettier with one shared config at the root for both apps (`npm run format`); the client keeps the linter Vite's template ships (oxlint, `npm run lint`) |
| Background removal | `@imgly/background-removal`, **default model** (`isnet_fp16`); the small model wasn't good enough. Runs on WebGPU (`device: 'gpu'`) with automatic fallback to the multi-threaded CPU. Measured per photo: laptop GPU ~2.4 s, laptop CPU ~8 s, phone GPU 2–4 s, phone CPU ~15 s; first photo slower; model downloads once. Needs HTTPS + cross-origin isolation (open item). Details in 03 §9.1 |
| Upload photo handling | Tip "For the best cutout, lay it flat on a plain floor or sheet." above the photo button; EXIF orientation applied automatically; a rotate button (90° clockwise per tap) applied before background removal and colour detection (03 §6.4) |
| Prisma | Prisma 7 (7.10.1, the latest stable; 8 was only a release candidate), `@prisma/adapter-pg`, `prisma.config.ts`, generated client not committed |
| Database checks | Phase 2's SQL checks live in `server/prisma/checks/` and run by hand with `npm run db:check` (psql); every check rolls back or fails its own COMMIT, so no data is left. Not an automated test |
| Neon SSL | Connection URLs use `sslmode=verify-full` |
| Database decisions from phase 2 | PostgreSQL 18, `timestamptz(3)`, deferred block foreign keys, seed via `seed.ts`: see 01 §9 |
| Liked count | `Me.counts.liked` = liked items + favourite outfits (the two tabs of the Liked page) |
| Refresh reuse | 10-second grace window for parallel refreshes; after that, reuse revokes the whole session (02 §6) |
| Login guard | `authenticate` mounted once after the `/auth` routes; unknown `/api/v1` paths answer 401 without a token |
| Auth rate limit | 10 **failed** signup/login attempts per 15 minutes per IP, counted separately per route |
