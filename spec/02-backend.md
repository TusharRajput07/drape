# 02 — Backend & API

How the server is built and every endpoint it exposes. Read `01-database.md` first; this file assumes its tables, rules and error mapping.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 24 LTS |
| Language | TypeScript (strict mode) |
| HTTP framework | Express 5. Async errors reach the error handler without wrappers |
| ORM / migrations | Prisma (+ hand-written SQL migrations, section 4) |
| Database | PostgreSQL on Neon |
| Validation | Zod: request body, params and query, plus environment variables |
| Auth | JWT access tokens (`jsonwebtoken`) + rotating refresh tokens (DB) |
| Passwords | `bcryptjs`, cost 12 |
| Images | Cloudinary Node SDK (signing, verifying, deleting) |
| Weather | Open-Meteo forecast + geocoding APIs (free, no key) |
| Security middleware | `helmet`, `cors` (credentials, single origin), `cookie-parser`, `express-rate-limit` (auth routes only) |
| Logging | **None.** Only `console.error` for unexpected errors (section 9) |
| Tests | None in v1 |

---

## 2. Repository layout

One repository with two apps:

```
drape/
├── client/            React app (see 03-frontend.md)
├── server/            this document
├── spec/              these specs
└── README.md
```

### 2.1 `server/` folder structure (layered)

```
server/
├── prisma/
│   ├── schema.prisma              models matching 01-database.md
│   ├── migrations/                Prisma + hand-written SQL migrations
│   ├── seed.ts                    categories, colors, subcategory_templates
│   └── checks/                    manual SQL checks for 01's rules (npm run db:check, needs psql)
├── src/
│   ├── generated/prisma/          generated Prisma client (not committed; prisma generate on install)
│   ├── server.ts                  starts the HTTP server
│   ├── app.ts                     builds the Express app (middleware + routes)
│   ├── config/
│   │   ├── env.ts                 Zod-validated process.env (fails fast on startup)
│   │   └── cloudinary.ts          configured Cloudinary client
│   ├── db/
│   │   └── prisma.ts              single PrismaClient instance
│   ├── routes/
│   │   ├── index.ts               mounts every router under /api/v1
│   │   ├── auth.routes.ts
│   │   ├── me.routes.ts
│   │   ├── lookups.routes.ts      categories + colors
│   │   ├── subcategories.routes.ts
│   │   ├── items.routes.ts
│   │   ├── outfits.routes.ts
│   │   ├── looks.routes.ts
│   │   ├── wishlist.routes.ts
│   │   ├── stats.routes.ts
│   │   ├── weather.routes.ts
│   │   └── uploads.routes.ts
│   ├── controllers/               read req → call a service → send a response. No business logic
│   │   └── *.controller.ts        one per routes file
│   ├── services/                  business logic + Prisma calls. No req/res objects
│   │   ├── auth.service.ts
│   │   ├── token.service.ts       sign/verify JWT, rotate refresh tokens
│   │   ├── user.service.ts
│   │   ├── subcategory.service.ts
│   │   ├── item.service.ts
│   │   ├── outfit.service.ts
│   │   ├── look.service.ts
│   │   ├── wishlist.service.ts    + page fetching and URL normalising
│   │   ├── stats.service.ts
│   │   ├── weather.service.ts
│   │   └── image.service.ts       Cloudinary sign / verify / delete + images rows
│   ├── validators/                Zod schemas, one file per resource
│   │   └── *.schema.ts
│   ├── middlewares/
│   │   ├── authenticate.ts        requires a valid access token; sets req.user
│   │   ├── validate.ts            validate({ body, query, params }) using Zod
│   │   ├── rate-limit.ts          limits for /auth routes
│   │   ├── not-found.ts           404 for unknown routes
│   │   └── error-handler.ts       turns every error into the standard error response
│   ├── utils/
│   │   ├── api-response.ts        ok(res, data, meta?, status?) helpers
│   │   ├── app-error.ts           AppError class + error code catalogue
│   │   ├── prisma-errors.ts       maps Postgres/Prisma errors to AppError (01 §8)
│   │   ├── cursor.ts              encode/decode pagination cursors
│   │   ├── url-normalize.ts       wishlist link cleaning
│   │   └── weather-message.ts     temperature → short what-to-wear message
│   └── types/
│       └── express.d.ts           adds req.user to Express's Request type
├── .env.example
├── package.json
├── prisma.config.ts               Prisma CLI config (schema, migrations, seed, DIRECT_URL)
├── tsconfig.json                  type-checks everything (src, prisma, config)
└── tsconfig.build.json            builds src/ to dist/
```

Layer rules:
- **routes → controllers → services → Prisma.** Never skip a layer, never go backwards.
- Controllers stay thin: validated input in, `ok(...)` out.
- Services take a `userId` as their first argument and **always filter by it**.
- Only `services/` and `db/` import Prisma.

---

## 3. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` |
| Style | REST, JSON bodies, `camelCase` fields in JSON (snake_case only in the database) |
| IDs | UUID strings |
| Auth | Every route requires `Authorization: Bearer <accessToken>` **except** the public ones in §6.1 |
| Ownership | A resource that belongs to someone else returns **404**, never 403, so ids can't be probed |
| Dates | Not returned unless a screen needs them (the UI never shows dates) |
| Validation | Every body/query/param goes through a Zod schema in `validators/`; unknown fields are stripped |
| Body size | `express.json({ limit: '100kb' })`. Images never go through the server |
| CORS | `origin: CLIENT_URL`, `credentials: true` |
| Status codes | 200 OK, 201 Created, 204 never (always return the JSON envelope), 400, 401, 404, 409, 422, 429, 500. Malformed JSON and bodies over the limit answer 400 `VALIDATION_ERROR` (not 413) |

---

## 4. Prisma notes

- **Prisma 7** (7.10.1): `prisma.config.ts` holds the CLI settings; the app connects through the
  `@prisma/adapter-pg` driver adapter; the client is generated into `src/generated/prisma`.
- `schema.prisma` models every table, column, enum, composite foreign key and `@@unique` in `01-database.md`.
  Map names with `@@map`/`@map` so the database stays snake_case and the code is camelCase.
- `onDelete` per `01-database.md` §2: `Cascade`, `NoAction` (the "block" rule) or `SetNull`, set explicitly on
  every relation (Prisma's default for required relations is `Restrict`), with `onUpdate: NoAction` to match the DDL.
- Use `@db.Citext` for `email`, `username` and subcategory `name`, `@db.Char(64)` for `signature`,
  `@db.Timestamptz(3)` for every timestamp (01 §1), and `dbgenerated("gen_random_uuid()")` for ids.
- **Hand-written SQL migrations** (create with `prisma migrate dev --create-only`, then add the SQL):
  1. `CREATE EXTENSION IF NOT EXISTS citext;` (the first migration, before any table)
  2. Partial indexes: `items_user_liked_idx`, `outfits_user_fav_idx`
  3. CHECK constraints Prisma can't express (username regex, name lengths, hex, url, lat/lon, both-or-neither city)
  4. `set_updated_at()` + its triggers, and `check_outfit()` + its two constraint triggers (01 §5)
  5. The five "block" foreign keys made `DEFERRABLE INITIALLY DEFERRED` (01 §2)

  In the repo: `20261020000001_citext`, `…0002_tables` (generated), `…0003_checks_and_partial_indexes`,
  `…0004_triggers`, `…0005_deferred_block_fks`.
- Prisma doesn't know about the partial indexes. **Review every generated migration** and delete any
  `DROP INDEX` lines that target them.
- Neon: `DATABASE_URL` = pooled connection string (used by the app), `DIRECT_URL` = direct connection (used by migrations, the seed and `db:check`).
  Both use `sslmode=verify-full` (the `pg` driver warns that `require` will change meaning in its next major version).
- Scripts: `db:migrate` (`migrate dev`), `db:deploy`, `db:seed`, `db:reset`, `db:check`, `db:generate`.
- `prisma/seed.ts` inserts the seed data from 01 §6 and is safe to re-run (upsert by slug).

---

## 5. Standard response format

Every response, success or error, uses this envelope.

**Success**
```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```
`meta` is present only when there is something to say (pagination, counts).

**Error**
```json
{
  "success": false,
  "error": {
    "code": "OUTFIT_DUPLICATE",
    "message": "You already saved this outfit.",
    "details": [ ]
  }
}
```
- `code`: stable, machine-readable; the frontend branches on it.
- `message`: human-readable, safe to show in the UI.
- `details`: optional. For validation errors, a list of `{ "field": "subcategoryId", "message": "Required" }`.
  For in-use errors, usage counts (e.g. `{ "outfits": 2, "looks": 1 }`).

### 5.1 Error codes

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation failed |
| 400 | `UPLOAD_INVALID` | Cloudinary file missing, not the user's, or wrong kind |
| 401 | `UNAUTHENTICATED` | No/invalid access token |
| 401 | `TOKEN_EXPIRED` | Access token expired → client should call `/auth/refresh` |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `SESSION_EXPIRED` | Refresh token missing, expired, revoked or reused |
| 404 | `NOT_FOUND` | Route, or a resource that doesn't exist / isn't yours |
| 409 | `EMAIL_TAKEN` | Signup with an existing email |
| 409 | `USERNAME_TAKEN` | Username already used |
| 409 | `SUBCATEGORY_EXISTS` | Same name already in that category |
| 409 | `SUBCATEGORY_IN_USE` | Delete blocked; `details: { items: n }` |
| 409 | `ITEM_IN_USE` | Delete blocked; `details: { outfits: n, looks: m }` |
| 409 | `OUTFIT_DUPLICATE` | Same items already saved as an outfit |
| 409 | `WISHLIST_DUPLICATE` | Same (normalized) link already saved |
| 422 | `OUTFIT_INVALID` | Breaks the 1 top / 1 bottom / ≤1 shoes rule, or items not in the right categories |
| 422 | `CONFIRMATION_REQUIRED` | Account delete without `"confirm": "DELETE"` |
| 429 | `RATE_LIMITED` | Too many auth attempts |
| 500 | `INTERNAL_ERROR` | Anything unexpected (generic message, no internals leaked) |

---

## 6. Authentication

| Token | Lifetime | Where it lives |
|---|---|---|
| Access token (JWT, HS256, `sub` = user id) | 15 minutes | Client memory only; sent as `Authorization: Bearer` |
| Refresh token (random 256-bit, stored hashed in `refresh_tokens`) | 30 days, sliding | httpOnly, Secure cookie `rt`, `path=/api/v1/auth`. `SameSite=Lax` if client and server share a site; `None` if they are on different domains (decide with hosting) |

- **Refresh** rotates: the old token gets `revoked_at` + `replaced_by_id`, a new one is issued, and its expiry resets to 30 days.
- **Reuse** of an already-rotated token → revoke the whole `family_id` → `SESSION_EXPIRED` (and the cookie is cleared).
  **Grace window: 10 s.** A token rotated less than 10 s ago that comes back (two tabs refreshing at once, React's dev mode
  running start-up twice) gets another fresh token in the same family instead, as long as the family is still alive.
- **Logout** revokes the current device's session (the token's `family_id`) and clears the cookie. Always answers `{ loggedOut: true }`, even without a cookie.
- `authenticate` middleware: verifies the JWT, sets `req.user = { id }`. No database call per request.
  It is mounted **once** in `routes/index.ts`, right after the `/auth` router, so every later router is protected
  automatically. Unknown `/api/v1` paths therefore answer 401 without a token and 404 with one.
- `express-rate-limit` on `/auth/signup` and `/auth/login`: 10 **failed** requests per 15 minutes per IP (successful ones
  don't count, `skipSuccessfulRequests`), with a separate counter for each route.
- Login: a wrong email still runs one bcrypt comparison (against a dummy hash), so the response time doesn't reveal
  whether an email has an account.
- Input rules: email and username are trimmed and lowercased before validation; password 8–72 characters **and**
  at most 72 bytes (bcrypt ignores anything after 72 bytes).

### 6.1 Public routes (the only exceptions to "every route is protected")

| Method | Path | Why public |
|---|---|---|
| POST | `/auth/signup` | User has no account yet |
| POST | `/auth/login` | User isn't logged in yet |
| POST | `/auth/refresh` | Access token expired; authenticated by the refresh cookie instead |
| POST | `/auth/logout` | Must work even with an expired access token (uses the refresh cookie) |

Everything else in §8 goes through `authenticate`.

---

## 7. Cursor pagination

Used by every list endpoint.

**Request:** `?limit=24&cursor=<opaque string>`
- `limit`: default 24, min 1, max 60.
- `cursor`: omit for the first page. Pass back `meta.nextCursor` for the next one.

**Response meta**
```json
{ "limit": 24, "nextCursor": "eyJ0IjoiMjAyNi0x...", "hasMore": true, "total": 58 }
```
- `nextCursor` is `null` when `hasMore` is false.
- `total` = number of rows matching the same filters (one extra `COUNT`, fine at wardrobe scale).

**How it works (`utils/cursor.ts`)**
- Lists are ordered by `created_at DESC, id DESC` (newest first), or `ASC, ASC` when `sort=oldest`.
- The cursor is base64url of `{ "t": "<created_at of last row>", "id": "<id of last row>", "s": "newest|oldest" }`.
- Next page: `WHERE (created_at, id) < (t, id)` for newest (`>` for oldest). Fetch `limit + 1` rows; if the extra row exists, `hasMore = true` and it's dropped.
- A cursor whose `s` doesn't match the requested `sort`, or that can't be decoded → `VALIDATION_ERROR`.
- The composite indexes in 01 (`… created_at DESC, id`) make this fast.

---

## 8. Endpoints

All paths are under `/api/v1`. 🔒 = requires an access token (everything except §6.1).
Response shapes show `data` only; the envelope (§5) is implied.

### 8.1 Shapes reused below

```ts
Image        = { url: string; width: number | null; height: number | null }
Category     = { id: string; slug: 'top' | 'bottom' | 'shoes' | 'accessory'; name: string }
Subcategory  = { id: string; categoryId: string; name: string; itemCount?: number }
Color        = { id: string; slug: string; name: string; hex: string }
Item         = { id: string; category: Category; subcategory: Subcategory; color: Color; image: Image; isLiked: boolean }
Outfit       = { id: string; isFavourite: boolean; top: Item; bottom: Item; shoes: Item | null; accessories: Item[] }
Look         = { id: string; image: Image; items: Item[] }
WishlistItem = { id: string; url: string; siteName: string; productName: string; image: Image | null }
Me           = { id; email; name; username; avatar: Image | null; cover: Image | null;
                 settings: { accent; tempUnit: 'C' | 'F'; useLocation: boolean; cityName: string | null };
                 counts: { items; outfits; looks; liked; wishlist } }   // liked = liked items + favourite outfits
```

### 8.2 Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password (8–72 chars), name, username }` | 201 `{ accessToken, user: Me }` + sets `rt` cookie |
| POST | `/auth/login` | `{ email, password }` | 200 `{ accessToken, user: Me }` + sets `rt` cookie |
| POST | `/auth/refresh` | — (cookie) | 200 `{ accessToken }` + rotates cookie |
| POST | `/auth/logout` | — (cookie) | 200 `{ loggedOut: true }` + clears cookie |

Signup runs in one transaction: `users` → `user_settings` → copy `subcategory_templates` → `refresh_tokens` (01 §7).
Login updates `last_login_at`. Wrong email and wrong password both return `INVALID_CREDENTIALS`.

### 8.3 Me (profile, settings, account) 🔒

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/me` | — | `Me` |
| PATCH | `/me` | `{ name?, username? }` | `Me` |
| PUT | `/me/avatar` | `{ publicId }` (from an upload, kind `avatar`) | `Me` |
| DELETE | `/me/avatar` | — | `Me` |
| PUT | `/me/cover` | `{ publicId }` (kind `cover`) | `Me` |
| DELETE | `/me/cover` | — | `Me` |
| PATCH | `/me/settings` | `{ accent?, tempUnit?, useLocation?, cityName? (null clears) }` | `Me` |
| DELETE | `/me` | `{ confirm: "DELETE" }` | `{ deleted: true }` + clears cookie |

- Setting `cityName` geocodes it with Open-Meteo (first match) and stores lat/lon, and the **geocoder's spelling** of the name
  ("pune" → "Pune"). Not found → `VALIDATION_ERROR` on `cityName`. Geocoder unreachable → 500 "Couldn't look up that city right now".
- Replacing an avatar/cover deletes the old image (01 §7).

### 8.4 Lookups 🔒

| Method | Path | Returns |
|---|---|---|
| GET | `/categories` | `Category[]` (by `sort_order`) |
| GET | `/colors` | `(Color & { isNeutral })[]` (by `sort_order`) |

Small and fixed. The client caches them for the session.

### 8.5 Subcategories 🔒

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/subcategories` | `?categoryId=` (optional) | `Subcategory[]` with `itemCount` (by category, then `sort_order`, then name) |
| POST | `/subcategories` | `{ categoryId, name }` | 201 `Subcategory` |
| PATCH | `/subcategories/:id` | `{ name }` | `Subcategory` |
| DELETE | `/subcategories/:id` | — | `{ deleted: true }` or 409 `SUBCATEGORY_IN_USE` |

Not paginated (a user has a few dozen at most). Names are trimmed, inner spaces collapsed, 1–24 chars.

### 8.6 Items 🔒

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/items` | see filters below + `limit`, `cursor` | `Item[]` + pagination meta |
| GET | `/items/:id` | — | `Item & { usage: { outfits: number; looks: number } }` |
| POST | `/items` | `{ publicId, categoryId, subcategoryId, colorId }` | 201 `Item` |
| PATCH | `/items/:id` | `{ subcategoryId?, colorId?, isLiked? }` | `Item` |
| DELETE | `/items/:id` | — | `{ deleted: true }` or 409 `ITEM_IN_USE` |

**Filters for `GET /items`** (all optional, combined with AND):

| Query | Meaning |
|---|---|
| `category` | slug: `top`, `bottom`, `shoes`, `accessory` (Home tabs, builder rows) |
| `subcategoryId` | repeatable: `?subcategoryId=a&subcategoryId=b` (OR within) |
| `colorId` | repeatable (OR within) |
| `liked` | `true` → liked only |
| `unused` | `true` → items not in any outfit |
| `sort` | `newest` (default) or `oldest` |

- `POST /items` verifies the upload (§8.12), checks that `subcategoryId` belongs to the user and the category, then inserts `images` + `items` in one transaction.
- `PATCH` with a `subcategoryId` from another category → `VALIDATION_ERROR` (an item can't change category).
- `DELETE` counts usage first; if used → 409 with `details: { outfits, looks }`. Otherwise it deletes the item and image rows, then the Cloudinary file.

### 8.7 Outfits 🔒

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/outfits` | `?favourite=true`, `limit`, `cursor` | `Outfit[]` + pagination meta |
| GET | `/outfits/:id` | — | `Outfit` |
| POST | `/outfits` | `{ topId, bottomId, shoesId?, accessoryIds?: string[] }` | 201 `Outfit` |
| PUT | `/outfits/:id` | same body as POST (replaces the pieces) | `Outfit` |
| PATCH | `/outfits/:id` | `{ isFavourite }` | `Outfit` |
| DELETE | `/outfits/:id` | — | `{ deleted: true }` |

- The service loads every given item **filtered by the user** and checks each is in the right category
  (`topId` must be a top, etc.) → otherwise `OUTFIT_INVALID`. `accessoryIds` are de-duplicated. Max 10 accessories.
- Writes happen in one transaction; the deferred trigger checks counts and the signature at commit.
  Unique violation → `OUTFIT_DUPLICATE`. Check violation → `OUTFIT_INVALID`.
- `PUT` on an outfit with the same pieces as itself is fine (no duplicate error against itself).

### 8.8 Looks (Lookbooks) 🔒

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/looks` | `limit`, `cursor` | `Look[]` + pagination meta |
| GET | `/looks/:id` | — | `Look` |
| POST | `/looks` | `{ publicId, itemIds?: string[] }` | 201 `Look` |
| PUT | `/looks/:id/items` | `{ itemIds: string[] }` (replaces the tags) | `Look` |
| DELETE | `/looks/:id` | — | `{ deleted: true }` |

All `itemIds` must belong to the user (else `VALIDATION_ERROR`). Max 20 tags.

### 8.9 Wishlist 🔒

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/wishlist` | `limit`, `cursor` | `WishlistItem[]` + pagination meta |
| POST | `/wishlist` | `{ url }` | 201 `WishlistItem` |
| DELETE | `/wishlist/:id` | — | `{ deleted: true }` |

**`POST /wishlist` steps (`wishlist.service.ts`)**
1. Validate the URL (http/https, ≤ 2048 chars) and normalize it (`utils/url-normalize.ts`, rules in 01 §3.14).
2. Already saved → `WISHLIST_DUPLICATE`, before fetching anything.
3. Fetch the page server-side: 8 s timeout, ≤ 2 MB, browser-like `User-Agent`, max 3 redirects.
   Read `og:title` / `<title>` and `og:image`.
   **SSRF guard:** only http(s); reject hosts that resolve to private, loopback or link-local IPs.
4. Site name: `og:site_name`, else a known-shops map (myntra → Myntra, amazon → Amazon, ajio → AJIO, flipkart → Flipkart, hm → H&M, zara → Zara, …), else the capitalised domain.
5. Product name: page title, else the URL slug (`…/dp/` segment for Amazon, longest hyphenated segment otherwise, title-cased), else `"<Site> item"`. Max 200 chars.
6. Photo: if `og:image` exists, upload it to Cloudinary from the URL (kind `wishlist`). Any failure → no photo, not an error.
7. Insert `images` (if any) + `wishlist_items` in one transaction.

### 8.10 Stats 🔒

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/stats` | `?category=` (slug, optional) | object below |

```ts
{
  composition: { total: number; byColor: { color: Color; count: number; percent: number }[] },  // filtered by ?category
  bySubcategory: { subcategory: Subcategory; count: number; percent: number }[] | null,        // only when ?category is set
  byCategory: { category: Category; count: number; percent: number }[],                        // whole closet
  outfitPotential: { possible: number; saved: number; looks: number },  // tops × bottoms × max(1, shoes)
  closetInUse: { inOutfits: number; total: number; percent: number },
  mostStyled: { item: Item; outfits: number; looks: number } | null,    // highest outfits + looks, ties → newest
  palette: { neutralPercent: number; top: Color[] },                    // top 3 colours, whole closet
  wishlist: { count: number; topSite: string | null }
}
```
Percentages are rounded integers. Computed with aggregate SQL (`groupBy` / `$queryRaw`), never by loading every item.

### 8.11 Weather 🔒

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/weather` | `?lat=&lon=` (optional) | `{ tempC: number; condition: 'clear' \| 'cloudy' \| 'rain' \| 'snow' \| 'fog' \| 'storm'; message: string; place: string \| null }` |

- With `lat`/`lon` (the browser gave its location) → use them. Otherwise use the saved city. Neither → `VALIDATION_ERROR` with code-specific message "Add your city in Settings".
- Calls Open-Meteo `current=temperature_2m,weather_code`. Maps `weather_code` to `condition`.
- `message` comes from `utils/weather-message.ts`, the same rules as the prototype:
  - rain → "Rain on the way. Skip suede and light bottoms today."
  - ≤ 10 °C → "Cold out. Layer up with a hoodie or jacket."
  - ≤ 18 °C → "Cool and easy. Full sleeves or a light layer."
  - ≤ 26 °C → "Perfect weather. Tee and jeans territory."
  - ≤ 33 °C → "Warm one. Breathable cotton, lighter colours."
  - else → "Scorching. Linen, shorts, nothing dark."
- Always returns Celsius. The client converts to °F if the setting says so.
- Cached in memory per rounded location (2 decimals) for 15 minutes.

### 8.12 Uploads (direct to Cloudinary) 🔒

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/uploads/signature` | `{ kind: 'item' \| 'look' \| 'avatar' \| 'cover' }` | `{ cloudName, apiKey, timestamp, signature, folder, publicId, allowedFormats, maxBytes }` |

**Flow**
1. Client asks for a signature for a `kind`.
2. Server signs upload params: folder `wardrobe/<userId>/<kind>`, `public_id` = new UUID, allowed formats (`webp, png, jpg`), max size 8 MB. Valid for 10 minutes.
3. Browser uploads the file straight to Cloudinary with those params.
4. Client calls the resource endpoint (`POST /items`, `POST /looks`, `PUT /me/avatar`, `PUT /me/cover`) with the `publicId`.
5. Server **verifies** with the Cloudinary Admin API that the file exists, is under the user's folder and the right kind's folder, and is within limits. Then it reads `url/width/height/bytes/format` and creates the `images` row.
   Anything wrong → `UPLOAD_INVALID`.
6. If the database write fails after verification → delete the Cloudinary file.

Abandoned uploads (signed and uploaded, but never saved) are cleaned up by a weekly job that deletes files in `wardrobe/*` with no `images` row older than 24 h.

---

## 9. Errors and console output

- Throw `new AppError(code, message, status, details?)` from services for expected failures.
- `utils/prisma-errors.ts` converts database errors using the table in 01 §8:
  - Prisma `P2002` (unique) → by constraint name: `EMAIL_TAKEN`, `USERNAME_TAKEN`, `SUBCATEGORY_EXISTS`, `OUTFIT_DUPLICATE`, `WISHLIST_DUPLICATE`.
  - Prisma `P2003` (foreign key) → `ITEM_IN_USE` / `SUBCATEGORY_IN_USE`.
  - Errors raised at COMMIT (the deferred outfit trigger and the deferred block foreign keys) arrive, inside a
    `$transaction`, as a raw `DriverAdapterError` (verified in phase 3). Its `cause` holds the Postgres code
    (`originalCode`) and the constraint (`constraint.index`): `23505` → `OUTFIT_DUPLICATE`, `23514` → `OUTFIT_INVALID`,
    `23503` → `ITEM_IN_USE` / `SUBCATEGORY_IN_USE`. Prisma-wrapped errors carry the same `cause` in `meta.driverAdapterError`.
  - Other CHECK violations (Prisma `P2039`, code `23514`) → `VALIDATION_ERROR` on the field taken from the constraint
    name (`<table>_<column>_check`).
  - Prisma `P2025` (record not found) → `NOT_FOUND`.
- `error-handler.ts` (last middleware):
  - `ZodError` → 400 `VALIDATION_ERROR` with `details` (a missing field reads "Required")
  - `AppError` → its status/code/message
  - anything else → **`console.error(err)`** and 500 `INTERNAL_ERROR` with a generic message
- `try/catch` blocks that swallow or translate an error (Cloudinary clean-up, page fetch, geocoding) also `console.error` what they caught.
- No logging library, request logging or log files.

---

## 10. Environment variables (`.env.example`)

```
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://...-pooler.../wardrobe?sslmode=verify-full   # Neon pooled
DIRECT_URL=postgresql://.../wardrobe?sslmode=verify-full                # Neon direct (migrations)

JWT_ACCESS_SECRET=change-me-64-random-chars
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SAMESITE=lax        # lax | none (none when client and server are on different domains)

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`config/env.ts` parses these with Zod at startup and exits with a clear message if any are missing or invalid.

---

## 11. Background jobs

No job runner in v1. Two small scripts (`npm run job:tokens`, `npm run job:uploads`), scheduled later with the host's cron feature:

| Job | Frequency | Does |
|---|---|---|
| Expired tokens | daily | delete `refresh_tokens` expired more than 7 days ago |
| Orphan uploads | weekly | delete Cloudinary files with no `images` row, older than 24 h |

---

## 12. Open items (decide later)

| Topic | Note |
|---|---|
| Hosting | Not decided. Must not sleep for long (owner's requirement). Affects `COOKIE_SAMESITE` and the cron jobs |
| Email verification / password reset | Out of scope for v1 |
| Tests | Out of scope for v1 |
