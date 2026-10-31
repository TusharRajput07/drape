# 03 — Frontend

The React app in `client/`. It talks only to the API in `02-backend.md` (and directly to Cloudinary for uploads).
The approved prototype is the visual reference for every screen: `prototype/index.html`
(published at https://claude.ai/artifact/1VpiD9w8AbgZQNMJsteY9y).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Build | Vite |
| UI library | React 19 + TypeScript (strict) |
| Routing | React Router (declarative routes) |
| Server state | TanStack Query v5 (queries, infinite queries, mutations) |
| Client state | Zustand (auth token, outfit builder, closet filters) |
| HTTP | Axios with interceptors |
| Validation | Zod (forms and API response parsing where useful) |
| Forms | react-hook-form + `@hookform/resolvers/zod` |
| Components | shadcn/ui (Radix-based, copied into the repo) + Tailwind CSS |
| Icons | lucide-react |
| Toasts | sonner (shadcn's toast) |
| Font | Inter (Google Fonts), fallback `system-ui` |
| Background removal | `@imgly/background-removal` (AGPL — fine, repo is public), default model, WebGPU with CPU fallback. Chosen by the test in §9.1 |
| PWA | `vite-plugin-pwa`: **installable only** (no offline data) |

---

## 2. Folder structure (by feature)

```
client/
├── public/
│   ├── categories/               fixed tab images: all.webp, top.webp, bottom.webp, shoes.webp, accessory.webp
│   │                             (real product photos supplied by the owner; line icons until then)
│   └── icons/                    PWA icons: icon.svg (also the favicon), icon-192/512.png, maskable-512.png
├── src/
│   ├── main.tsx                  React root, QueryClientProvider, RouterProvider, Toaster
│   ├── app/
│   │   ├── router.tsx            all routes (§3)
│   │   ├── query-client.ts       TanStack Query defaults
│   │   └── layouts/
│   │       ├── AppLayout.tsx     page + bottom nav
│   │       ├── AuthLayout.tsx    centred card for login/signup
│   │       └── ProtectedRoute.tsx
│   ├── lib/
│   │   ├── api.ts                Axios instance + interceptors (§5)
│   │   ├── api-types.ts          envelope + error types, error code union
│   │   ├── errors.ts             error code → user message helpers
│   │   ├── cloudinary.ts         signed direct upload with progress
│   │   ├── image.ts              resize/compress to WebP, transparency check
│   │   ├── color-detect.ts       nearest-palette colour detection (ported from the prototype)
│   │   ├── accent.ts             accent colour table (§7) + applyAccent()
│   │   ├── categories.ts         the 4 category slugs in tab order + labels (Tops / Top…)
│   │   ├── use-online.ts         online/offline hook (offline screen, session check)
│   │   └── utils.ts              cn() etc. (shadcn)
│   ├── components/
│   │   ├── ui/                   shadcn components (button, sheet, dialog, input, switch, select, tabs…)
│   │   ├── BottomNav.tsx
│   │   ├── PageHeader.tsx        title left, action button right (the agreed header pattern)
│   │   ├── FormField.tsx         label + input + error under it
│   │   ├── FullScreenLoader.tsx  shown while the session check runs
│   │   ├── OfflineScreen.tsx     "You're offline" (§10)
│   │   ├── HangerIcon.tsx        the prototype's hanger (lucide has none)
│   │   ├── CategoryImage.tsx     tab photo in a circle (line icon until the photo exists)
│   │   ├── Chip.tsx, ColorGrid.tsx, SwitchRow.tsx   the prototype's chips, colour swatches and switch row
│   │   ├── ItemCard.tsx          photo + heart
│   │   ├── ItemGrid.tsx          infinite-scroll grid
│   │   ├── OutfitFigure.tsx      stacked top/bottom/shoes + accessory circles
│   │   ├── EmptyState.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── InfiniteSentinel.tsx  loads the next page when scrolled into view
│   ├── features/
│   │   ├── auth/                 LoginPage, SignupPage, auth.api.ts, auth.store.ts, schemas.ts
│   │   ├── profile/              ProfileHeader (cover card, avatar, icons, stats), me.api.ts
│   │   ├── closet/               ClosetPage (Home), CategoryTabs, FilterSheet, ItemDetailSheet, items.api.ts, lookups.api.ts, filters.store.ts
│   │   ├── upload/               UploadFlow (category → photo → preview → save), useBackgroundRemoval.ts, upload.store.ts
│   │   ├── subcategories/        SubcategoryPicker, ManageSubcategories, subcategories.api.ts
│   │   ├── outfits/              OutfitsPage, OutfitDetailSheet, outfits.api.ts
│   │   ├── builder/              BuilderPage, BuilderRow, AccessoriesSheet, builder.store.ts
│   │   ├── looks/                LookbooksPage, AddLookFlow, LookDetailSheet, TagPicker, looks.api.ts
│   │   ├── wishlist/             WishlistPage, AddLinkForm, wishlist.api.ts
│   │   ├── liked/                LikedPage (Clothes | Outfits)
│   │   ├── stats/                StatsPage, ColorDonut, Bars, stats.api.ts
│   │   ├── weather/              WeatherPill, WeatherCard, useWeather.ts
│   │   └── settings/             SettingsPage, AccentPicker, WeatherSettings, DeleteAccountDialog
│   ├── styles/
│   │   └── globals.css           Tailwind + CSS variables (§7)
│   └── vite-env.d.ts
├── index.html
├── vite.config.ts                React + Tailwind + PWA plugins, `@` alias to src, `/api` forwarded to the server, `phone` mode
├── components.json               shadcn config
├── .env.example                  VITE_API_URL=http://localhost:4000/api/v1
└── tsconfig.json
```

Rules:
- A feature folder owns its pages, components, `*.api.ts` (query/mutation hooks) and stores.
- Features may import from `components/`, `lib/` and other features' **api hooks**, never another feature's internals.
- All server calls go through `lib/api.ts`. Components never call Axios directly; they use the feature's hooks.

---

## 3. Routes

| Path | Page | Access | Bottom nav |
|---|---|---|---|
| `/login` | LoginPage | public (logged-in → `/`) | no |
| `/signup` | SignupPage | public (logged-in → `/`) | no |
| `/` | ClosetPage (Home: profile header + tabs + grid) | protected | Home |
| `/outfits` | OutfitsPage (weather card + grid) | protected | Outfits |
| `/outfits/new` | BuilderPage | protected | hidden (full screen) |
| `/outfits/:id/edit` | BuilderPage (pre-selected) | protected | hidden |
| `/liked` | LikedPage (Clothes \| Outfits switch) | protected | Liked |
| `/wishlist` | WishlistPage | protected | Wishlist |
| `/lookbooks` | LookbooksPage | protected | — (from header icon) |
| `/stats` | StatsPage | protected | — (from header icon) |
| `/settings` | SettingsPage | protected | — (from header icon) |
| `*` | redirect to `/` | | |

- Item details, outfit details, look details, the filter sheet, the upload flow and confirmations are **sheets/dialogs**, not routes.
- The bottom nav's centre **+** opens a sheet: Upload clothes · Create outfit · Add to wishlist.
- Sub-pages (`/lookbooks`, `/stats`, `/settings`) show a back arrow in `PageHeader`.

---

## 4. State

### 4.1 Server state: TanStack Query

Query keys:

| Key | Endpoint | Type |
|---|---|---|
| `['me']` | `GET /me` | query |
| `['categories']`, `['colors']` | lookups | query, `staleTime: Infinity` |
| `['subcategories']` | `GET /subcategories` | query |
| `['items', filters]` | `GET /items` | **infinite** query |
| `['item', id]` | `GET /items/:id` | query |
| `['outfits', { favourite }]` | `GET /outfits` | infinite query |
| `['outfit', id]` | `GET /outfits/:id` | query |
| `['looks']`, `['look', id]` | looks | infinite / query |
| `['wishlist']` | `GET /wishlist` | infinite query |
| `['stats', category]` | `GET /stats` | query |
| `['weather', lat, lon]` | `GET /weather` | query, `staleTime: 15 min` |

- Infinite queries: `initialPageParam: undefined`, `getNextPageParam: last => last.meta.nextCursor ?? undefined`.
  `InfiniteSentinel` (IntersectionObserver) calls `fetchNextPage()`.
- Defaults: `staleTime: 30 s`, `retry: 1` (never retry 4xx), `refetchOnWindowFocus: true`.
- **Optimistic updates** for the hearts (item `isLiked`, outfit `isFavourite`): update the cache, roll back on error.
- After any create/update/delete, invalidate the affected keys plus `['me']` (counts) and `['stats']`.

### 4.2 Client state: Zustand

| Store | Holds | Persisted |
|---|---|---|
| `auth.store` | `accessToken`, `status: 'unknown' \| 'authed' \| 'guest'` | **No.** Memory only (the refresh cookie restores it) |
| `filters.store` | closet tab, subcategory/colour filters, liked, unused, sort | No |
| `builder.store` | current index per row, locks, subcategory per row, edit target, picked accessories | No |

---

## 5. API client and auth flow (`lib/api.ts`)

- `axios.create({ baseURL: import.meta.env.VITE_API_URL, withCredentials: true })`. Cookies are needed for `/auth/refresh`.
- **Request interceptor:** adds `Authorization: Bearer <accessToken>` if present.
- **Response interceptor:**
  - Success: returns `response.data` (the envelope). Hooks read `.data` and `.meta`.
  - `401 TOKEN_EXPIRED`: call `POST /auth/refresh` **once** (single-flight: concurrent 401s wait for the same refresh), store the new token, retry the original request once.
  - `401 SESSION_EXPIRED` / `UNAUTHENTICATED` after a refresh attempt: clear the auth store and the query cache, then navigate to `/login`.
  - Other errors: reject with a typed `ApiError { status, code, message, details }`.
- **App start:** `ProtectedRoute` shows a full-screen loader while `status === 'unknown'`, calls `/auth/refresh`, then sets `authed` or `guest`.
  `AuthLayout` (login/signup) runs the same check and sends a logged-in user to `/`. If the phone is offline the status stays
  `unknown` (the offline screen shows) and the check runs again once it's back online; any other failure counts as `guest`.
- **Session end** = clear the store and the query cache; `ProtectedRoute` then redirects to `/login` (no separate navigate call).
- After login/signup the returned `user` fills the `['me']` cache; `me.settings.accent` is applied to the CSS variables. Login/signup pages use plum.
- **Logout:** `POST /auth/logout`, then clear the store and cache, then go to `/login`.

---

## 6. Screens (behaviour)

The prototype is the visual reference. These are the rules to keep.

### 6.1 Login / Signup
- Signup: name, username (3–24, `a–z 0–9 _ .`), email, password (8–72). Zod in the form, matching the server rules.
- A centred card (the prototype has no login screen): "Drape" above it, the form inside, a link to the other page below the button.
- Login: `INVALID_CREDENTIALS` shows above the button ("Wrong email or password.").
- Server errors `EMAIL_TAKEN` / `USERNAME_TAKEN` show under the matching field.

### 6.2 Home (closet)
- **Profile header:**
  - Rounded cover card with the **weather pill** (icon + temperature only) top-left.
  - White name card overlapping the bottom of the cover.
  - Avatar overlapping both cover and card, top-left.
  - Three **icon-only** round buttons overlapping the same edge on the right: Lookbooks, Wardrobe stats, Settings.
  - Name, @username, and 5 tappable counts: items, outfits, looks, liked, wishlist.
  - No edit button. Profile editing is in Settings.
- **Category tabs:** circles with **fixed images** from `public/categories/` and labels: All, Tops, Bottoms, Shoes, Accessories. The row has side padding so the active ring isn't clipped.
  Until the owner's photos are there, each circle shows a line icon (`CategoryImage` falls back when the image is missing). Changing tab clears the subcategory filter.
- **Grid:** cards show **photo + heart only**. Infinite scroll. Tap → ItemDetailSheet.
- **Filter button** next to the count ("23 items · Filter (2)"; "5 of 23 items" while filtering). Filter sheet: subcategory, colour, liked only, not in any outfit, sort newest/oldest.
  Filters apply as they're tapped; it offers only the colours (from `GET /stats?category=`) and subcategories (`itemCount > 0`) the tab has; "Show N items" closes it.
- **No dates anywhere.**

### 6.3 Item detail sheet
- Shows the photo, subcategory (title), colour, and "in N outfits / M looks".
- Change subcategory (same category only, "+ New" inline) and colour.
- Like / Delete. Delete when used → `ITEM_IN_USE` message with counts and a button to Outfits or Lookbooks. Otherwise a confirm dialog.
  Both are boxes inside the sheet, as in the prototype ("This top is in 1 outfit. Remove it from there first, then delete it." / "Delete this top? This can't be undone.").

### 6.4 Upload flow (the + sheet → Upload clothes)
1. Pick a category (4 options with the fixed images).
2. Pick a photo (`<input type="file" accept="image/*">`) from a photo step with a "Choose a photo" button. HEIC or other undecodable formats → "Couldn't open that photo … Try a JPG or PNG".
   - A one-line tip above the photo button, in small grey (`--muted`) text: "For the best cutout, lay it flat on a plain floor or sheet."
   - The photo is decoded with the phone's built-in orientation (EXIF) applied automatically, so it never shows up sideways.
3. **Preview:**
   - **"Remove background" switch**: on by default, auto-off if the image already has transparency (§9).
   - **Rotate button**: each tap turns the photo 90° clockwise. The rotation is applied to the photo itself **before**
     background removal and colour detection (both re-run after a rotate), so the saved cutout is upright.
   - Checkered preview background.
   - **Subcategory picker (required)** with "+ New"; Save stays disabled until one is picked.
   - Detected **colour chip** ("Navy · detected · Change"; "chosen by you" after a manual pick).
   - The photo is worked on at 1200 px (the saved size). The cutout is trimmed to the garment with a small margin.
     If removal fails, a toast says so and the switch turns off, so the photo can still be saved as is.
     The prototype's "removal strength" slider is not used (the AI model doesn't need it).
4. Save:
   1. Compress to WebP (max 1200 px long side, quality 0.85; PNG fallback if WebP is unsupported).
   2. `POST /uploads/signature {kind:'item'}`.
   3. Upload to Cloudinary with a progress bar.
   4. `POST /items`.
   5. Toast "Added to Tops", then go to Home on that tab.

### 6.5 Outfits
- `PageHeader`: "My outfits" left, **Create outfit** button right; the count below.
- **WeatherCard** under the header: icon, temperature, condition, place, what-to-wear message.
- Grid of **OutfitFigure** cards: stacked top → bottom → shoes, the top **slightly** overlapping the bottom, accessories as small circles on the right, **heart top-left**. No name, no date.
- **OutfitDetailSheet:** the figure, the list of pieces, and three equal buttons in one row: **Favourite · Edit · Delete** (Delete = red text, with a confirm dialog).

### 6.6 Outfit builder (`/outfits/new`, `/outfits/:id/edit`)
- Full screen, no bottom nav. Header: back, title ("Create outfit" / "Edit outfit"), **Shuffle**.
- Three rows at a **fixed 30% / 60% / 10%** of the space between header and footer: Tops, Bottoms, Shoes.
- Each row:
  - Horizontal scroll-snap carousel; the centred item is selected and the neighbours are dimmed.
  - Row label is a **subcategory dropdown** ("All tops", "Shirts"…).
  - Lock button: a locked row keeps its item on shuffle.
- Rows use `GET /items?category=…&subcategoryId=…`. Load all pages up front (a closet is small); show a skeleton while loading.
- **Save:**
  1. Opens **AccessoriesSheet** (multi-select, can skip).
  2. `POST /outfits` (or `PUT` when editing).
  3. `OUTFIT_DUPLICATE` → inline message in the sheet; picks are kept.
  4. Success → `/outfits`, toast "Outfit saved" / "Outfit updated".
- Edit mode pre-selects the outfit's pieces and accessories.
- Save is disabled if the Tops or Bottoms row is empty.

### 6.7 Liked
- A two-way switch: **Clothes** (liked items grid) | **Outfits** (favourite outfits grid).

### 6.8 Wishlist
- `PageHeader` "Wishlist".
- A link input + **Add**:
  - While adding, a pending card shows "Getting details…".
  - `WISHLIST_DUPLICATE` → "Already in your wishlist".
- Cards: photo (or a fallback panel with the shop name), product name, shop name with an external-link icon. Tap → opens the shop link in a new tab.
- ✕ on a card → **confirm dialog** "Remove from wishlist?" → delete.

### 6.9 Lookbooks
- `PageHeader` with a back arrow: "Lookbooks" left, **Add look** right.
- Grid of 3:4 photos with an "N tagged" badge.
- **Add look:**
  1. Pick a photo (background kept, no removal).
  2. Compress to WebP (max 1600 px).
  3. Tag clothes with a category-chip filter and a 4-column picker (tags optional, up to 20).
  4. Upload and `POST /looks`.
- **LookDetailSheet:** the photo, a strip of tagged items (tap → ItemDetailSheet), **Tag clothes** (replaces the tags) and **Delete** (with confirm).

### 6.10 Wardrobe stats
- **Composition card:**
  - Chips: All · Tops · Bottoms · Shoes · Accessories.
  - **Colour donut** (SVG, slices in the real colour hex, 2 px gaps, hover/tap tooltip) with a legend list (swatch, name, count, %).
  - "By category" bars when on All; "By subcategory" bars when a category is picked.
- **Other cards:**
  - Outfit potential (possible / saved / looks).
  - Closet in use (meter + "See them" → Home with the *not in any outfit* filter).
  - Most styled (tap → ItemDetailSheet).
  - Your palette (neutrals %, top 3 colours).
  - Wishlist summary.
- Data: `GET /stats?category=`.

### 6.11 Settings
- **Profile:** name, username, change/remove profile photo, change/remove cover photo (each an upload of kind `avatar`/`cover`).
- **Appearance:** accent colour swatches (black, sage, dusty blue, clay, **plum = default**). Applied instantly.
- **Weather:** "Use my location" switch, backup city (saved with Enter or blur; `VALIDATION_ERROR` → "City not found"), °C/°F.
- **Subcategories:** per category, chips with item counts; tap → rename/delete sheet (`SUBCATEGORY_IN_USE` → "still has N items…"); "+ Add".
- **Account:** Log out; **Delete account** dialog that requires typing `DELETE`.

---

## 7. Styling

- White background everywhere (single light theme, no dark mode in v1).
- Inter for all text. Headings semibold, no serif.
- Tailwind theme via CSS variables in `globals.css`:
  - Neutrals: `--background` (#FFFFFF), `--foreground` (#161616), `--muted` (#6E6D69), `--border` (#E8E7E3), `--soft` (#F4F4F1).
  - `--accent` and `--accent-soft` are set at runtime from `me.settings.accent`:

| accent | `--accent` | `--accent-soft` |
|---|---|---|
| black | #161616 | #EEEEEA |
| sage | #55705A | #E7EDE6 |
| blue | #4A6683 | #E5EAF0 |
| clay | #9A5A3B | #F3E8E1 |
| plum (default) | #6A4566 | #EFE7EE |

- shadcn components are restyled through these variables (primary = accent).
- Phone first. Content max-width 1040 px on desktop. Grids: 2 columns on phones, more as width allows.
- Respect `prefers-reduced-motion`. Visible focus rings. Every icon-only button has an `aria-label`.

---

## 8. Weather (`features/weather/useWeather.ts`)

1. If `settings.useLocation` is on: ask `navigator.geolocation` **once per session** (5 s timeout).
   On success → `GET /weather?lat&lon` (coordinates rounded to 2 decimals).
2. If location is off, denied or fails → `GET /weather` (uses the saved city).
3. If there's no city either → the pill is hidden, and the WeatherCard says "Add your city in Settings".
4. Show °F when `settings.tempUnit === 'F'` (convert on the client).

---

## 9. Background removal and colour detection (`features/upload/`)

- `@imgly/background-removal` is **lazy-loaded** with a dynamic `import()` only when the upload preview opens, so it never slows the rest of the app.
- **Model:** the library's **default model** (`isnet_fp16`), chosen in §9.1.
- **First use on a device:** the model downloads once (~88 MB, plus ~12–23 MB of runtime WASM). Show "Getting the background remover ready…" with a progress bar from the library's progress callback.
  The files come from img.ly's CDN (`staticimgly.com`, the path is pinned to the package version); the PWA service worker caches them, so later uploads skip the download.
- One photo at a time: removals wait in line, and asking twice for the same photo reuses the first result (React runs effects twice in development).
- **Runs on the phone in the browser** with `device: 'gpu'` (WebGPU). The library falls back to the CPU (WASM, multi-threaded when the page is cross-origin isolated) automatically when WebGPU isn't available.
  Typical time is 2–4 s on a phone GPU, ~15 s on a phone CPU (§9.1); show a spinner. The model is loaded once per session and reused for every photo.
- **Transparency check** (`lib/image.ts`): if more than 1% of sampled pixels are already see-through, the switch starts **off** with the note "Your photo already has a see-through background."
- Switch off → the photo is saved as-is (still compressed).
- **Colour detection** (`lib/color-detect.ts`): ported from the prototype.
  1. Sample opaque pixels.
  2. Match each to the nearest of the 16 colours from `GET /colors` (redmean RGB distance).
  3. The most common one wins.

  Re-runs when the switch changes or the photo is rotated, unless the user picked a colour by hand.

### 9.1 Model test (phase 1): result

A throwaway page ran `@imgly/background-removal` 1.7.0 on **10 of the owner's real clothes photos** (about 1.2 MP each),
comparing the default model (`isnet_fp16`, ~88 MB) with the small one (`isnet_quint8`, ~44 MB). The page was then deleted.

**Decision:**
- Use `@imgly/background-removal` with the **default model** (`isnet_fp16`). The small model's cutouts weren't good enough.
- Run on **WebGPU** (`device: 'gpu'`), with the library's automatic fallback to the **multi-threaded CPU**.

**Quality:** good on plain backgrounds (clothes laid flat on a floor work well), poor on busy ones. Hence the tip in §6.4.

**Measured times** (per photo, model only; default model):

| Device | GPU (WebGPU) | CPU (WASM, multi-threaded) |
|---|---|---|
| Laptop (Chrome, Intel GPU, 8 cores) | ~2.4 s | ~8 s |
| Owner's phone | 2–4 s | ~15 s |

- The **first photo** after loading is slower (laptop: ~8 s GPU, ~13 s CPU) while the engine warms up.
- The **model downloads once** per device (then cached); loading it into memory takes ~6–10 s once per session.
- Without cross-origin isolation the CPU runs on **one thread**: ~25 s per photo, even on the laptop.

**Requirements this creates** (decided in §12):
- **WebGPU** needs a secure context (HTTPS; `localhost` is fine in development).
- **The multi-threaded CPU fallback** also needs cross-origin isolation:
  `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy`.
- Testing on a phone during development therefore needs HTTPS too (the Cloudflare tunnel, §10.1).

---

## 10. PWA (installable only)

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- **Manifest:**
  - `name` / `short_name`: **Drape**.
  - `display: standalone`, `start_url: /`, `background_color: #FFFFFF`, `theme_color`: plum `#6A4566`.
  - Icons 192, 512 and maskable 512.
- **Service worker caches:** the app shell (JS/CSS/fonts/HTML), the category images, and the background-removal model/WASM files (`staticimgly.com`, cache-first, 1 year).
- **Not cached:** API responses and Cloudinary images. The app needs internet for data (offline browsing is out of scope).
- If the app is opened offline: a simple "You're offline" screen. It also covers the app whenever the phone goes offline, and goes away when it's back.
- The service worker only runs in the built app (`npm run phone`), not in `npm run dev`.

### 10.1 Trying it on a phone (development)

Installing needs HTTPS the phone trusts (a self-signed certificate isn't enough), and the refresh cookie is `Secure`.
`npm run phone` (root) starts the API, builds the client in `phone` mode (`VITE_API_URL=/api/v1`), serves it with `vite preview`
on port 4173 (which forwards `/api` to the server, so the app and API share one address) and opens a **Cloudflare quick tunnel**
(`cloudflared`, installed once with `winget install Cloudflare.cloudflared`, not in the repo). The phone opens the printed
`https://….trycloudflare.com` address. It's public while the command runs and changes every run.

---

## 11. Error handling in the UI

| Error code | Shown as |
|---|---|
| `VALIDATION_ERROR` | Inline under the matching field (`details[].field`), else a toast |
| `ITEM_IN_USE`, `SUBCATEGORY_IN_USE` | Message inside the sheet, with the counts from `details` |
| `OUTFIT_DUPLICATE`, `OUTFIT_INVALID` | Message inside the accessories sheet |
| `WISHLIST_DUPLICATE` | Under the link input |
| `UPLOAD_INVALID` | Toast "Upload failed. Try again." |
| `RATE_LIMITED` | Toast "Too many attempts. Try again in a few minutes." |
| `NOT_FOUND` | Close the sheet, refetch the list, toast "That's no longer here." |
| `INTERNAL_ERROR` / network | Toast "Something went wrong. Try again." |
| `SESSION_EXPIRED` | Redirect to `/login` |

Copy rules: short, plain, active voice; errors say what to do next; no dates; no "Outfit 3"-style numbering.

---

## 12. Open items

| Topic | Note |
|---|---|
| Category tab photos | Owner supplies 5 real photos (all, top, bottom, shoes, accessory) |
| HTTPS + cross-origin isolation | **Decided in phase 6.** The whole app is isolated with `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` (set in `vite.config.ts` for the dev and preview servers; the host must send the same two headers, phase 10). With `credentialless` the cross-origin files load unchanged: Cloudinary images (items, looks, avatar, cover, wishlist photos; Cloudinary also sends CORS headers), Google Fonts and the model files (img.ly's CDN sends CORS + CORP headers). Browsers without `credentialless` support (Safari) simply aren't isolated: nothing breaks, the CPU fallback is single-threaded there. HTTPS for phone testing: the Cloudflare tunnel (§10.1) |
| Hosting | Decided later. Affects `VITE_API_URL` and the cookie `SameSite` setting |
