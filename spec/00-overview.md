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
- Decide HTTPS + cross-origin isolation for background removal first (decided: see "Cross-origin isolation" in §8 and 03 §12).

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
- On the host: send the two cross-origin isolation headers with the app (03 §12) and set `TRUST_PROXY` for its proxy (02 §10).

Built without the owner (away; asked to finish the app without questions): the production server serves the app
itself (one address, 02 §13), the clean-up jobs run inside it (02 §11), pages are lazy-loaded, and `DEPLOY.md`
(repo root) walks the owner through a free deploy. Signing up with a host and deploying is left to the owner.

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
7. **No dates in the UI.** No logging beyond `console.error` for errors (and the server's one "API ready" line at start-up).

---

## 7. Open items

| Item | Owner | Needed by |
|---|---|---|
| 5 category tab photos (all, top, bottom, shoes, accessory); line icons stand in until then (03 §6.2) | Owner | Any time (no code change) |
| Hosting: sign up and deploy. Recommended **Render free web service (Singapore) + a free 10-minute keep-awake ping**, fallback Oracle Cloud Always Free VM; steps in `DEPLOY.md` | Owner | Launch |
| Rotate the Neon password and the Cloudinary API secret (both were pasted in a chat), before or while deploying (`DEPLOY.md` step 0) | Owner | Launch |
| Cloudinary Admin API limit (500 calls/hour, used by upload verification; 02 §12) | Owner + Claude | Before more users |

---

## 8. Decisions log

| Topic | Decision |
|---|---|
| Node version | Node 24 LTS (was 22) for both apps; `engines` set in each `package.json` |
| Dev command | Root `package.json` runs client and server together with `concurrently` (`npm run dev`); each app keeps its own `node_modules` (no workspaces) |
| Server dev tooling | ESM (`"type": "module"`), `tsc` build to `dist/`. Dev runs `node --watch-path=src --watch-preserve-output --import tsx src/server.ts` (was `tsx watch`, see "Server dev watcher") |
| Phase 0 server files | The envelope helper, `AppError`, `not-found`, `error-handler` and `config/env.ts` are built to their final spec in phase 0 (needed for the 404 check); phase 3 adds the rest |
| Dependencies | Installed per phase, only when first used |
| Formatting / linting | Prettier with one shared config at the root for both apps (`npm run format`); the client keeps the linter Vite's template ships (oxlint, `npm run lint`) |
| Background removal | `@imgly/background-removal`, **default model** (`isnet_fp16`); the small model wasn't good enough. Runs on WebGPU (`device: 'gpu'`) with automatic fallback to the multi-threaded CPU. Measured per photo: laptop GPU ~2.4 s, laptop CPU ~8 s, phone GPU 2–4 s, phone CPU ~15 s; first photo slower; model downloads once. Needs HTTPS + cross-origin isolation (see "Cross-origin isolation"). Details in 03 §9.1 |
| Upload photo handling | Tip "For the best cutout, lay it flat on a plain floor or sheet." above the photo button; EXIF orientation applied automatically; a rotate button (90° clockwise per tap) applied before background removal and colour detection (03 §6.4) |
| Prisma | Prisma 7 (7.10.1, the latest stable; 8 was only a release candidate), `@prisma/adapter-pg`, `prisma.config.ts`, generated client not committed |
| Database checks | Phase 2's SQL checks live in `server/prisma/checks/` and run by hand with `npm run db:check` (psql); every check rolls back or fails its own COMMIT, so no data is left. Not an automated test |
| Neon SSL | Connection URLs use `sslmode=verify-full` |
| Database decisions from phase 2 | PostgreSQL 18, `timestamptz(3)`, deferred block foreign keys, seed via `seed.ts`: see 01 §9 |
| Liked count | `Me.counts.liked` = liked items + favourite outfits (the two tabs of the Liked page) |
| Refresh reuse | 10-second grace window for parallel refreshes; after that, reuse revokes the whole session (02 §6) |
| Login guard | `authenticate` mounted once after the `/auth` routes; unknown `/api/v1` paths answer 401 without a token |
| Auth rate limit | 10 **failed** signup/login attempts per 15 minutes per IP, counted separately per route |
| Wishlist link cleaning | Generic rules (tracking list, sorted params, no fragment/trailing `/`) + one canonical host for known shops + Amazon links reduced to `/dp/<ASIN>` (01 §3.14) |
| Upload signature lifetime | 1 hour, Cloudinary's fixed limit (was written as 10 minutes); the file is still verified on save (02 §8.12) |
| Account delete files | Delete the whole `wardrobe/<userId>/` Cloudinary folder; if Cloudinary fails, the account is deleted anyway (02 §8.3) |
| Malformed path ids | `/items/123` answers 404 `NOT_FOUND`, like an id that isn't yours |
| Shop-only page titles | A page title that is only the shop's name (Amazon's "Amazon.in" bot page) is ignored; the name comes from the link instead (02 §8.9) |
| Phase 4 small defaults | New subcategory at the end; "This item is in 2 outfits and 1 look…" message; reused upload → `UPLOAD_INVALID` without deleting the file; weather: rain message for rain and storm, `place` null with `lat`/`lon`; stats leave out zero colours/subcategories; accessories/tags newest first; one new package (`cloudinary`); the cleanup jobs (02 §11) are written in phase 10 |
| Phone testing | `npm run phone`: built app on `vite preview` (forwards `/api` to the server) behind a Cloudflare quick tunnel for trusted HTTPS; `cloudflared` installed once on the laptop, not in the repo (03 §10.1) |
| Phase 5 placeholders | Unbuilt pages show only their header; Home shows name, @username and the Lookbooks/Stats/Settings icon buttons; Settings has only Account → Log out; in the + sheet, Upload clothes is disabled until phase 6 |
| App icon | A white hanger on plum, drawn as `icon.svg`; PNGs (192, 512, maskable 512) made from it once. Replaceable any time |
| Phase 5 small defaults | React Router data router (`createBrowserRouter`); `@hookform/resolvers` 5 (6 has a broken peer-dependency tree); shadcn components restyled to the prototype (pill buttons, bottom sheet → centred card from 640 px); wrong login shown above the button; logout that fails keeps you logged in with a toast; service worker only in the built app; model caching added in phase 6 (done, see "Background removal files") |
| Server dev watcher | `tsx watch` froze the API on Windows when started by `concurrently` (`npm run dev`, `npm run phone`): concurrently gives each command a stdin pipe that stays open, `tsx watch` reads stdin (Enter = rerun), and that pending read stopped the server process before it could listen. Replaced by Node's built-in watch mode (doesn't read stdin) with tsx as the loader. It watches only `server/src` (`--watch-path=src`): plain `--watch` follows every imported file, packages in `node_modules` included, and restarted on its own |
| Server ready line | On start the server prints `API ready on http://localhost:<PORT>/api/v1` (the only `console.log`), so a server that never starts is visible |
| Trust proxy | Express `trust proxy` comes from the optional `TRUST_PROXY` env var, default `loopback`: behind the dev tunnel only proxies on the laptop (cloudflared, `vite preview`) are trusted and the client IP comes from Cloudflare's `X-Forwarded-For`, so the auth rate limit counts each phone separately. Production sets it (usually a hop count like `1`) with hosting. Never `true` (anyone could fake their IP) (02 §10) |
| Cross-origin isolation | The whole app is isolated: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`, sent by Vite's dev and preview servers now and by the host later. With `credentialless`, Cloudinary images (every photo, wishlist ones included), Google Fonts and the model files load unchanged. Browsers without `credentialless` (Safari) just aren't isolated: everything works, the CPU fallback is single-threaded there (03 §12) |
| Background removal files | Model + WASM come from img.ly's CDN (`staticimgly.com`, path pinned to the package version); the service worker caches them cache-first for a year, so each device downloads once. Nothing big in the repo |
| Category tab photos | Until the owner's 5 photos are in `client/public/categories/`, each tab shows a line icon in its circle; dropping in `all/top/bottom/shoes/accessory.webp` replaces them with no code change |
| Phase 6 small defaults | No "removal strength" slider (prototype only); the cutout is trimmed to the garment with a small margin; a failed removal shows a toast and turns the switch off so the photo can be saved as is; removals run one at a time; photos are worked on at 1200 px; the upload flow has a separate photo step (tip + "Choose a photo"); delete confirm and "in use" message are boxes inside the item sheet, as in the prototype; the filter sheet offers only colours (from `GET /stats`) and subcategories that tab has; after saving, Home opens on that tab with filters cleared; Home shows a simple skeleton while loading and a "Try again" box if the list fails |
| Shared detail sheets | The item and outfit detail sheets are opened from other pages too (Liked now; Lookbooks and Stats later), so other features may use `closet/ItemDetailSheet` and `outfits/OutfitDetailSheet` as well as the api hooks (03 §2) |
| No shoes in the builder | An outfit may have no shoes, so the shoes row starts with a "No shoes" slide. A new outfit starts on the first pair; editing an outfit without shoes starts on "No shoes"; Shuffle only picks real shoes (03 §6.6) |
| Phase 7 small defaults | Builder picks are kept by item id (not index), so a row can reload or be filtered without losing them; the subcategory dropdown is a native select listing only subcategories with items, and changing it keeps the pick if it's still shown (else the first item); the lock shows only when a row has more than one slide; Shuffle with nothing to move says "All rows are locked. Unlock one to shuffle." or "Add more clothes to shuffle."; an empty row says "No tops yet. Add some from your closet." and a row that fails to load says "Couldn't load your tops. Try again"; the locked message shows only when a locked row could otherwise have moved; Back returns to where the builder was opened from (Outfits when opened from a link), and after saving Outfits replaces the builder in the history; the accessories sheet can't be closed while saving; accessory picks are kept between openings of the sheet, Skip saves with none, at most 10 can be picked (02 §8.7); duplicate message: "You already saved this outfit. Change the accessories, or go back and change a piece." (or "…without accessories. Add one, or go back and change a piece."); an outfit card shows up to 4 accessory circles, then "+N"; the outfit sheet lists each piece as thumbnail + subcategory + category, and Delete is a confirm box inside the sheet ("Delete this outfit? Your clothes stay in your closet.", no undo); the Outfits count line ("3 saved outfits. Pick one for today.") is hidden at 0, the weather card comes in phase 9; Liked has the prototype's subtitle and the counts in the switch ("Clothes · 4"); an unliked card leaves the Liked page when the list refreshes (the heart itself changes at once); editing an outfit that no longer exists says "That's no longer here." and goes back to Outfits; shared bits moved to `components/` (`Segmented`, `ConfirmBox`, `OutfitFigure`, `OutfitGrid`, `ItemGridSkeleton`) |
| Phase 8 small defaults | Built without the owner (away; asked to finish the app without questions). Wishlist: the photo is the shop page's own (`og:image`); there's no own-photo upload (02 §8.9 takes only `url`), so "with or without a photo" means the shop gave one or not (Myntra does, Amazon hides it from bots); a link without `http(s)://` gets `https://`; the input clears at once and several links can be added at the same time, each with its own pending card showing the link's host; a failed link comes back into the input; "Already in your wishlist." and validation messages show under the input; remove is a confirm sheet as in the prototype; the + sheet's "Add to wishlist" focuses the link input. Lookbooks: **Add look** opens the photo picker straight away (no separate photo step), the photo is compressed before the New look sheet; "Tag clothes" turns the look sheet into the same picker and closes it after saving; a tagged piece opens the item sheet in place of the look sheet; the "N tagged" badge is hidden at 0; editing tags waits for the closet to load, a new look can still be saved untagged if it can't load; item changes now refresh looks too; the upload progress bar moved to `components/ProgressBar` (03 §6.8, §6.9) |
| Phase 9 small defaults | Built without the owner (away; asked to finish the app without questions). Stats: plain SVG/CSS charts (no chart library), tooltips on hover/tap, the previous category's numbers stay while the next loads, "See them" opens Home on All with only *not in any outfit* on, Most styled reads "Navy top". Settings: groups in the spec's order (Profile first, the prototype had Appearance first); name/username edited in a sheet; avatar = centre square 512 px, cover keeps its shape (max 1600 px), Remove without confirm; accent applied before the server answers (and the browser's theme-color follows), rolled back on error; switch and °C/°F also instant; the city saves on Enter or blur, empty clears it; subcategory delete without confirm (as in the prototype), blocked locally when it has items; account delete is a sheet with a typed `DELETE`. Weather: the card sits under the count line (as in the prototype) with loading / "Add your city in Settings" / "Try again" states, the pill only shows real weather; an unanswered location prompt counts as a refusal after 15 s; the location is cached until logout. Name/username rules moved to `lib/profile-rules.ts` so signup and Settings share them (03 §6.5, §6.10, §6.11, §8) |
| Phase 10 hosting | Built without the owner (away). Recommended: **Render**'s free web service in Singapore (no card, HTTPS, deploys from GitHub, 750 h/month = always on) kept awake by a free cron-job.org ping every 10 minutes, since free Render services sleep after 15 idle minutes. Fallback: an Oracle Cloud Always Free VM (Mumbai/Hyderabad/Singapore, never sleeps, but needs a card check and self-setup with Caddy + DuckDNS). Fly.io, Railway and Koyeb were ruled out (no lasting free tier, or no region near India). The owner signs up and deploys with `DEPLOY.md`; nothing was signed up for |
| Phase 10 single origin | In production the Express server also serves `client/dist` (SPA fallback to `index.html` for page paths; paths with a file extension and `/api/*` still get the 404 envelope), so app and API share one address: `COOKIE_SAMESITE=lax`, `CLIENT_URL` = the app's address, CORS only on `/api` (02 §13). `/assets/*` (hashed) cached a year, everything else `no-cache`. The production build uses `VITE_API_URL=/api/v1` (`vite build --mode deploy`) unless the host sets another |
| Phase 10 security headers | helmet sends COOP `same-origin` + COEP `credentialless` on everything, and a CSP listing what the app loads (self, Google Fonts, Cloudinary, img.ly's CDN, `blob:` workers/scripts, WebAssembly). It needs `'unsafe-eval'`: the background-removal library uses `new Function()`. Checked in headless Chrome against the production build: login renders, the page is cross-origin isolated, and a background removal runs with no CSP violations (02 §13) |
| Phase 10 clean-up jobs | Run inside the production server (no host cron needed): expired refresh tokens (> 7 days past expiry) daily, orphan uploads (files under `wardrobe/` with no `images` row, > 24 h old) weekly, each also once 5/10 minutes after start so restarts don't skip them; a run never overlaps itself; failures only `console.error`. Not started in development, because a laptop's database may not own the Cloudinary files. `npm run job:tokens` / `job:uploads` (server) run one by hand, silently. Orphan listing stops after 20 pages (10,000 files) per run to stay well under the Admin API limit. Review fixes: the orphan job only deletes app-named files of users that exist in this database, and stops without deleting if more than 20 files and more than half of the old files have no row; upload verification refuses files older than 12 h so a file the job may delete can never be saved (02 §8.12, §11) |
| Phase 10 scripts | Root `npm run build` (server `tsc` + client deploy build), `npm start` (production server), `npm run db:deploy` (migrations), `npm run install:ci` (`npm ci --include=dev` in all three, so a host that sets `NODE_ENV=production` still installs the build tools) |
| Phase 10 lazy loading | Every page is a lazy chunk (`app/pages.tsx`, React.lazy + Suspense): a page skeleton inside the app layout, a spinner in the auth card and for the full-screen builder. The upload flow loads on first open. The four tab pages and the upload flow are preloaded 1.5 s after the app opens. Main chunk 744 kB → 321 kB (102 kB gzip). The background-removal runtime (`ort*.js`) is left out of the service worker's precache (03 §10). A page whose code fails to load (an old tab after a new deploy) reloads the app, at most once a minute; offline it waits for the connection (`lib/load-chunk.ts`) |
| Phase 10 session reset | Per-user Zustand stores (closet filters + tab, builder, upload flow) register a reset in `lib/session-reset.ts`; `endSession()` runs them on logout, account delete and an expired session (03 §4.2) |
| Phase 10 small defaults | Wishlist: a pasted share message ("Check out this product https://…") uses its first `http(s)` link, else its first `www.` link, without trailing punctuation; text with spaces and no link is still "doesn't look like a link" (03 §6.8). Reduced motion: animations and transitions end at once instead of being removed (sheets still close cleanly); only spinners keep turning, slowly (03 §7). Accessibility: loading skeletons are `role="status"`, the item sheet's "Change" buttons say what they change (+ `aria-expanded`), builder slides read colour + subcategory, look cards say how many pieces are tagged, the new-subcategory error is announced |
