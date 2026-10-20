# 01 — Database

Drape. Multi-user: every user sees only their own data.
This document is the source of truth for the database. Build migrations from it exactly.

- **Engine:** PostgreSQL 18 (hosted on Neon, free plan)
- **Images:** stored as files in Cloudinary; the database stores only their id and URL
- **Status:** agreed with the product owner on 2026-10-18

---

## 1. Conventions

| Rule | Detail |
|---|---|
| Primary keys | `uuid` everywhere, `DEFAULT gen_random_uuid()` |
| Time | `timestamptz(3)` (millisecond precision) everywhere; `created_at`/`updated_at` default `now()`. Milliseconds because JavaScript dates hold milliseconds: microseconds would be cut off in pagination cursors, and rows could be skipped (02 §7) |
| `updated_at` | Kept current by the `set_updated_at()` trigger (section 5.1) |
| Case-insensitive text | `citext` for email, username and subcategory names |
| Ownership | Every user-owned table has `user_id`. Child rows repeat `user_id` and use **composite foreign keys** so a row can never point at another user's data |
| Deletes | See section 2. "Block" = `ON DELETE NO ACTION`, `DEFERRABLE INITIALLY DEFERRED` (checked at COMMIT) |
| Dates in the UI | Never shown to users. `created_at` is kept only for sorting and records |
| Naming | snake_case, plural table names, `<table>_<cols>_idx` for indexes |

---

## 2. Delete rules

The product rule: **anything still in use cannot be deleted; the user is told where it is used and removes it from there first.**

| Deleting… | While used by… | Behaviour | How |
|---|---|---|---|
| Subcategory | items | **Blocked** | FK `NO ACTION`, deferred |
| Item | outfits (`outfit_items`) | **Blocked** | FK `NO ACTION`, deferred |
| Item | looks (`look_items`) | **Blocked** | FK `NO ACTION`, deferred |
| Image of an item / look | its item / look | **Blocked** (delete the item/look first, then the image) | FK `NO ACTION`, deferred |
| Outfit | its `outfit_items` rows | Allowed, rows removed | `CASCADE` |
| Look | its `look_items` rows | Allowed, rows removed | `CASCADE` |
| Avatar / cover image | `users` | Allowed, profile falls back to initials | `SET NULL` |
| Wishlist photo | `wishlist_items` | Allowed, card falls back to name + link | `SET NULL` |
| User (account) | everything they own | Allowed, everything removed | `CASCADE` from `users` |

**Why deferred `NO ACTION` and not `RESTRICT` or plain `NO ACTION`:** all three block a direct delete.
But deleting a user cascades into `items`, `images`, `outfit_items`, `look_items` and `subcategories`, and
Postgres runs each cascade step as its own internal statement. `RESTRICT` checks immediately, and plain
`NO ACTION` checks at the end of each *step*, so account deletion fails whenever, for example, the cascade into
`items` runs before the one into `outfit_items` (found in phase 2: it did fail). Deferred to COMMIT, the whole
cascade finishes first, so account deletion works while single deletes are still blocked (the error then comes
at COMMIT). The five deferred keys: `outfit_items → items`, `look_items → items`, `items → images`,
`items → subcategories`, `looks → images`.

The backend should **count usages first** and return a friendly message (e.g. *"This shirt is in 2 outfits
and 1 look. Remove it from those first."*). The foreign keys are the safety net.

---

## 3. Tables

Overview:

```
users ─┬─ user_settings (1:1)
       ├─ refresh_tokens
       ├─ images ◄──────────── users (avatar, cover), items, looks, wishlist_items
       ├─ subcategories ──► categories (+ subcategory_templates)
       ├─ items ──► categories, subcategories, colors, images
       ├─ outfits ── outfit_items ──► items     (deferred trigger: counts + signature)
       ├─ looks ──── look_items ────► items
       └─ wishlist_items ──► images
```

| Group | Tables |
|---|---|
| Account | `users`, `user_settings`, `refresh_tokens` |
| Files | `images` |
| Shared lookups (seeded, read-only for users) | `categories`, `subcategory_templates`, `colors` |
| Per-user lookup | `subcategories` |
| Wardrobe | `items`, `outfits`, `looks`, `wishlist_items` |
| Mapping (many-to-many) | `outfit_items`, `look_items` |

### 3.1 `users`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id of the user |
| `email` | citext, UNIQUE | Login email, case-insensitive |
| `password_hash` | text | bcrypt/argon2 hash, never plain |
| `name` | varchar(60) | Display name on profile |
| `username` | citext, UNIQUE, `^[a-z0-9_.]{3,24}$` | Shown as @username |
| `avatar_image_id` | uuid → images, SET NULL | Profile photo |
| `cover_image_id` | uuid → images, SET NULL | Cover photo |
| `last_login_at` | timestamptz | Last successful login |
| `created_at` / `updated_at` | timestamptz | Record keeping |

No email verification or password reset in v1.

### 3.2 `user_settings` (1:1 with users, created at signup)

| Column | Type | Purpose |
|---|---|---|
| `user_id` | uuid, PK → users CASCADE | One row per user |
| `accent` | `accent_color` enum, default `plum` | App accent colour |
| `temp_unit` | char(1) `C`/`F`, default `C` | Temperature display unit |
| `use_location` | boolean, default true | Ask browser for location |
| `city_name` | varchar(80) | Backup city for weather |
| `city_lat` / `city_lon` | numeric(8,5) | City coordinates, geocoded once |
| `updated_at` | timestamptz | Last change |

When the user saves a city, the backend geocodes it once (Open-Meteo geocoding, free) and stores
the coordinates. `city_lat` and `city_lon` are both set or both null.

### 3.3 `refresh_tokens`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id of the token |
| `user_id` | uuid → users CASCADE | Token owner |
| `token_hash` | text, UNIQUE | SHA-256 of the token, never raw |
| `family_id` | uuid | Groups tokens from one login |
| `replaced_by_id` | uuid → refresh_tokens, SET NULL | Next token after rotation |
| `user_agent` | text | Device/browser that logged in |
| `expires_at` | timestamptz | When it stops working |
| `revoked_at` | timestamptz | Set on logout or reuse |
| `last_used_at` | timestamptz | Last refresh |
| `created_at` | timestamptz | When issued |

Session rules: access token ~15 min (in memory); refresh token in an httpOnly, Secure, SameSite cookie;
**30-day sliding expiry**; rotate on every refresh. If an already-rotated token is presented again,
revoke the whole `family_id`. Logout revokes the current device only. No device list in v1.
A daily job deletes tokens expired more than 7 days ago.

### 3.4 `images`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id of the image |
| `user_id` | uuid → users CASCADE | Owner of the file |
| `kind` | `image_kind` enum | item, look, avatar, cover, wishlist |
| `public_id` | text, UNIQUE | Cloudinary id, used to delete |
| `url` | text | Cloudinary URL shown in app |
| `width` / `height` | int | Pixel size |
| `bytes` | int | File size |
| `format` | varchar(10) | webp, png, jpg |
| `created_at` | timestamptz | When uploaded |

Item photos are the **cutout only** (background removed in the browser, or the original if the user
switched removal off). Original photos are never uploaded.

### 3.5 `categories` (shared, seeded, 4 rows)

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id |
| `slug` | varchar(20), UNIQUE | Code name: top, bottom… |
| `name` | varchar(40) | Display name: Tops… |
| `sort_order` | smallint, UNIQUE | Order of tabs and builder rows |
| `outfit_min` | smallint | Fewest allowed per outfit |
| `outfit_max` | smallint, NULL = unlimited | Most allowed per outfit |
| `created_at` | timestamptz | Record keeping |

### 3.6 `subcategory_templates` (shared, seeded)

Starter list copied into each new user's `subcategories` at signup. Editing it affects new users only.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id |
| `category_id` | uuid → categories | Main category it sits under |
| `name` | citext, 1–24 chars | Starter name, e.g. Shirts |
| `sort_order` | smallint | Order copied to users |

### 3.7 `subcategories` (per user)

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id |
| `user_id` | uuid → users CASCADE | Owner |
| `category_id` | uuid → categories | Main category it sits under |
| `name` | citext, 1–24 chars | Display name, case-insensitive |
| `sort_order` | smallint | Order in pickers |
| `created_at` / `updated_at` | timestamptz | Record keeping |

- `UNIQUE (user_id, category_id, name)` — no duplicate names in a category
- `UNIQUE (id, user_id, category_id)` — target of the composite FK from `items`
- Users can add, rename and delete their own subcategories. Delete is blocked while items use it.

### 3.8 `colors` (shared, seeded, 16 rows)

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id |
| `slug` | varchar(20), UNIQUE | Code name: navy… |
| `name` | varchar(30) | Display name |
| `hex` | char(7), `^#[0-9A-F]{6}$` | Swatch, and reference for detection |
| `is_neutral` | boolean | Used by the "mostly neutrals" stat |
| `sort_order` | smallint, UNIQUE | Order in pickers |

Fixed list. Users cannot add colours. Colour detection in the browser picks the nearest of these.

### 3.9 `items`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id of the piece |
| `user_id` | uuid → users CASCADE | Owner |
| `category_id` | uuid → categories | Main category |
| `subcategory_id` | uuid, composite FK, **required** | User's subcategory |
| `color_id` | uuid → colors, **required** | One main colour |
| `image_id` | uuid, UNIQUE, composite FK | The saved cutout |
| `is_liked` | boolean, default false | Heart on the card |
| `created_at` / `updated_at` | timestamptz | Sorting / record keeping |

- `(subcategory_id, user_id, category_id)` → `subcategories(id, user_id, category_id)`:
  the subcategory must be the user's own **and** under the same category.
- `(image_id, user_id)` → `images(id, user_id)`: the image must be the user's own.
- No name, brand, notes or price (decided).

### 3.10 `outfits`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id of the outfit |
| `user_id` | uuid → users CASCADE | Owner |
| `is_favourite` | boolean, default false | Heart on the outfit card |
| `signature` | char(64) | SHA-256 of sorted item ids, set by trigger |
| `created_at` / `updated_at` | timestamptz | Sorting / record keeping |

`UNIQUE (user_id, signature)` makes duplicate outfits impossible. Two outfits are duplicates when they
contain exactly the same items, accessories included.

### 3.11 `outfit_items` (mapping)

| Column | Type | Purpose |
|---|---|---|
| `outfit_id` | uuid | Which outfit |
| `user_id` | uuid | Owner, for safety checks |
| `item_id` | uuid | Which item |
| `category_id` | uuid | Item's category, checked against the item |

- PK `(outfit_id, item_id)`
- `(outfit_id, user_id)` → `outfits` **CASCADE**
- `(item_id, user_id, category_id)` → `items(id, user_id, category_id)` **NO ACTION** (blocks item delete)
- Rows are only **inserted or deleted**, never updated. Editing an outfit replaces its rows.
- Count rules come from `categories.outfit_min/outfit_max`: 1 top, 1 bottom, 0–1 shoes, any accessories.
  Enforced by the deferred trigger in section 5.2.

### 3.12 `looks` (Lookbook photos)

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id of the look |
| `user_id` | uuid → users CASCADE | Owner |
| `image_id` | uuid, UNIQUE, composite FK | The photo (background kept) |
| `created_at` / `updated_at` | timestamptz | Sorting / record keeping |

### 3.13 `look_items` (tags, mapping)

| Column | Type | Purpose |
|---|---|---|
| `look_id` | uuid | Which look |
| `user_id` | uuid | Owner, for safety checks |
| `item_id` | uuid | Which item is tagged |

PK `(look_id, item_id)`; `→ looks` CASCADE; `→ items(id, user_id)` NO ACTION. Tags are optional, any number.

### 3.14 `wishlist_items`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid, PK | Unique id |
| `user_id` | uuid → users CASCADE | Owner |
| `url` | text, http(s), ≤ 2048 | Cleaned product link |
| `site_name` | varchar(60) | Shop name, e.g. Myntra |
| `product_name` | varchar(200) | Title from the page or link |
| `image_id` | uuid, nullable, → images SET NULL | Product photo copied to Cloudinary |
| `created_at` / `updated_at` | timestamptz | Sorting / record keeping |

- `UNIQUE (user_id, url)` — the same product can't be saved twice ("Already in your wishlist").
- The backend **normalizes the URL** before saving (`utils/url-normalize.ts`):
  - every link: lowercase the host, remove the `#fragment`, remove user/password, remove tracking parameters
    (`utm_*`, `pd_rd_*`, `pf_rd_*`, `ref`, `ref_`, `fbclid`, `gclid`, `gclsrc`, `dclid`, `gbraid`, `wbraid`, `msclkid`, `yclid`,
    `igshid`, `igsh`, `srsltid`, `mc_cid`, `mc_eid`, `_ga`, `_gl`, `si`, `spm`, `scm`), sort the remaining parameters, remove a trailing `/`;
  - shops that serve both `www.`/`m.`/bare hosts get one canonical host: Myntra, AJIO, Flipkart, Zara → `www.<shop>.com`, H&M → `www2.hm.com`;
  - Amazon (any country domain) with a product id → `https://www.amazon.<tld>/dp/<ASIN>`, nothing else, so every form of the same product matches;
  - other hosts keep `www.`/`m.` as typed. Short links (`amzn.in/…`) are stored as pasted.
- If the page can't be fetched, the product name comes from the URL slug, and failing that
  `"<Site> item"`. `image_id` stays null and the card shows name + link.
- No price (decided).
- `image_id` uses a plain (single-column) FK. Ownership is guaranteed because wishlist photos are
  always created by the server itself, never sent by the client (Prisma cannot express a
  column-specific `SET NULL` on a composite FK).

---

## 4. Full schema (DDL)

Run in this order. Migrations are managed with **Prisma Migrate**; this SQL is the reference.
Parts Prisma's schema cannot express (citext extension, CHECKs, partial indexes, deferrable foreign keys,
triggers) go into hand-written SQL migrations — see `02-backend.md`, section 4.
In the migrations, CHECKs are named `<table>_<column>_check` (both-or-neither city: `user_settings_city_coords_check`),
and Prisma creates each `UNIQUE` as a unique index with the same name (it behaves the same for foreign keys and errors).

```sql
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums ---------------------------------------------------------------
CREATE TYPE accent_color AS ENUM ('black', 'sage', 'blue', 'clay', 'plum');
CREATE TYPE image_kind   AS ENUM ('item', 'look', 'avatar', 'cover', 'wishlist');

-- Users (image FKs are added after `images` exists) --------------------
CREATE TABLE users (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            citext       NOT NULL UNIQUE,
  password_hash    text         NOT NULL,
  name             varchar(60)  NOT NULL CHECK (char_length(btrim(name)) > 0),
  username         citext       NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_.]{3,24}$'),
  avatar_image_id  uuid,
  cover_image_id   uuid,
  last_login_at    timestamptz(3),
  created_at       timestamptz(3)  NOT NULL DEFAULT now(),
  updated_at       timestamptz(3)  NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        image_kind   NOT NULL,
  public_id   text         NOT NULL UNIQUE,
  url         text         NOT NULL,
  width       int          CHECK (width  > 0),
  height      int          CHECK (height > 0),
  bytes       int          CHECK (bytes  > 0),
  format      varchar(10),
  created_at  timestamptz(3)  NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX images_user_id_idx ON images (user_id);

ALTER TABLE users
  ADD CONSTRAINT users_avatar_fk FOREIGN KEY (avatar_image_id) REFERENCES images(id) ON DELETE SET NULL,
  ADD CONSTRAINT users_cover_fk  FOREIGN KEY (cover_image_id)  REFERENCES images(id) ON DELETE SET NULL;

CREATE TABLE user_settings (
  user_id       uuid          PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accent        accent_color  NOT NULL DEFAULT 'plum',
  temp_unit     char(1)       NOT NULL DEFAULT 'C' CHECK (temp_unit IN ('C', 'F')),
  use_location  boolean       NOT NULL DEFAULT true,
  city_name     varchar(80),
  city_lat      numeric(8,5)  CHECK (city_lat BETWEEN -90 AND 90),
  city_lon      numeric(8,5)  CHECK (city_lon BETWEEN -180 AND 180),
  updated_at    timestamptz(3)   NOT NULL DEFAULT now(),
  CHECK ((city_lat IS NULL) = (city_lon IS NULL))
);

CREATE TABLE refresh_tokens (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      text         NOT NULL UNIQUE,
  family_id       uuid         NOT NULL,
  replaced_by_id  uuid         REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent      text,
  expires_at      timestamptz(3)  NOT NULL,
  revoked_at      timestamptz(3),
  last_used_at    timestamptz(3),
  created_at      timestamptz(3)  NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx    ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_id_idx  ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);

-- Shared lookups --------------------------------------------------------
CREATE TABLE categories (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        varchar(20)  NOT NULL UNIQUE,
  name        varchar(40)  NOT NULL,
  sort_order  smallint     NOT NULL UNIQUE,
  outfit_min  smallint     NOT NULL DEFAULT 0 CHECK (outfit_min >= 0),
  outfit_max  smallint     CHECK (outfit_max IS NULL OR outfit_max >= outfit_min),
  created_at  timestamptz(3)  NOT NULL DEFAULT now()
);

CREATE TABLE subcategory_templates (
  id           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid      NOT NULL REFERENCES categories(id),
  name         citext    NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 24),
  sort_order   smallint  NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);

CREATE TABLE colors (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        varchar(20)  NOT NULL UNIQUE,
  name        varchar(30)  NOT NULL,
  hex         char(7)      NOT NULL CHECK (hex ~ '^#[0-9A-F]{6}$'),
  is_neutral  boolean      NOT NULL DEFAULT false,
  sort_order  smallint     NOT NULL UNIQUE
);

-- Per-user subcategories ------------------------------------------------
CREATE TABLE subcategories (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  uuid         NOT NULL REFERENCES categories(id),
  name         citext       NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 24),
  sort_order   smallint     NOT NULL DEFAULT 0,
  created_at   timestamptz(3)  NOT NULL DEFAULT now(),
  updated_at   timestamptz(3)  NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, name),
  UNIQUE (id, user_id, category_id)
);
CREATE INDEX subcategories_user_category_idx ON subcategories (user_id, category_id);

-- Items -------------------------------------------------------------------
CREATE TABLE items (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     uuid         NOT NULL REFERENCES categories(id),
  subcategory_id  uuid         NOT NULL,
  color_id        uuid         NOT NULL REFERENCES colors(id),
  image_id        uuid         NOT NULL UNIQUE,
  is_liked        boolean      NOT NULL DEFAULT false,
  created_at      timestamptz(3)  NOT NULL DEFAULT now(),
  updated_at      timestamptz(3)  NOT NULL DEFAULT now(),
  CONSTRAINT items_subcategory_fk FOREIGN KEY (subcategory_id, user_id, category_id)
    REFERENCES subcategories (id, user_id, category_id)             -- NO ACTION: blocks subcategory delete
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT items_image_fk FOREIGN KEY (image_id, user_id)
    REFERENCES images (id, user_id)                                   -- NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, category_id)
);
CREATE INDEX items_user_category_created_idx ON items (user_id, category_id, created_at DESC, id);
CREATE INDEX items_subcategory_idx           ON items (subcategory_id, user_id, category_id);
CREATE INDEX items_user_color_idx            ON items (user_id, color_id);
CREATE INDEX items_user_liked_idx            ON items (user_id) WHERE is_liked;

-- Outfits -------------------------------------------------------------------
CREATE TABLE outfits (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_favourite  boolean      NOT NULL DEFAULT false,
  signature     char(64),    -- set by check_outfit() at commit
  created_at    timestamptz(3)  NOT NULL DEFAULT now(),
  updated_at    timestamptz(3)  NOT NULL DEFAULT now(),
  CONSTRAINT outfits_user_signature_key UNIQUE (user_id, signature),
  UNIQUE (id, user_id)
);
CREATE INDEX outfits_user_created_idx ON outfits (user_id, created_at DESC, id);
CREATE INDEX outfits_user_fav_idx     ON outfits (user_id) WHERE is_favourite;

CREATE TABLE outfit_items (
  outfit_id    uuid NOT NULL,
  user_id      uuid NOT NULL,
  item_id      uuid NOT NULL,
  category_id  uuid NOT NULL,
  PRIMARY KEY (outfit_id, item_id),
  FOREIGN KEY (outfit_id, user_id) REFERENCES outfits (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id, user_id, category_id) REFERENCES items (id, user_id, category_id)   -- NO ACTION
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX outfit_items_item_idx ON outfit_items (item_id, user_id, category_id);

-- Looks -----------------------------------------------------------------------
CREATE TABLE looks (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_id    uuid         NOT NULL UNIQUE,
  created_at  timestamptz(3)  NOT NULL DEFAULT now(),
  updated_at  timestamptz(3)  NOT NULL DEFAULT now(),
  FOREIGN KEY (image_id, user_id) REFERENCES images (id, user_id)    -- NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, user_id)
);
CREATE INDEX looks_user_created_idx ON looks (user_id, created_at DESC, id);

CREATE TABLE look_items (
  look_id  uuid NOT NULL,
  user_id  uuid NOT NULL,
  item_id  uuid NOT NULL,
  PRIMARY KEY (look_id, item_id),
  FOREIGN KEY (look_id, user_id) REFERENCES looks (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id, user_id) REFERENCES items (id, user_id)    -- NO ACTION
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX look_items_item_idx ON look_items (item_id, user_id);

-- Wishlist ------------------------------------------------------------------------
CREATE TABLE wishlist_items (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url           text          NOT NULL CHECK (url ~* '^https?://' AND char_length(url) <= 2048),
  site_name     varchar(60)   NOT NULL,
  product_name  varchar(200)  NOT NULL,
  image_id      uuid          UNIQUE REFERENCES images(id) ON DELETE SET NULL,
  created_at    timestamptz(3)   NOT NULL DEFAULT now(),
  updated_at    timestamptz(3)   NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_user_url_key UNIQUE (user_id, url)
);
CREATE INDEX wishlist_user_created_idx ON wishlist_items (user_id, created_at DESC, id);
```

---

## 5. Triggers

### 5.1 `updated_at`

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- one BEFORE UPDATE trigger per table that has updated_at
CREATE TRIGGER users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_settings_updated_at  BEFORE UPDATE ON user_settings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subcategories_updated_at  BEFORE UPDATE ON subcategories  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER items_updated_at          BEFORE UPDATE ON items          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER outfits_updated_at        BEFORE UPDATE ON outfits        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER looks_updated_at          BEFORE UPDATE ON looks          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER wishlist_items_updated_at BEFORE UPDATE ON wishlist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 5.2 Outfit rules and signature (deferred, runs at COMMIT)

Chosen so the rules hold even if the backend has a bug or someone edits the database by hand.

```sql
CREATE OR REPLACE FUNCTION check_outfit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  oid    uuid;
  broken text;
  sig    char(64);
BEGIN
  IF TG_TABLE_NAME = 'outfits' THEN oid := NEW.id;
  ELSIF TG_OP = 'DELETE'        THEN oid := OLD.outfit_id;
  ELSE                               oid := NEW.outfit_id;
  END IF;

  -- the outfit itself was deleted in this transaction: nothing to check
  IF NOT EXISTS (SELECT 1 FROM outfits WHERE id = oid) THEN
    RETURN NULL;
  END IF;

  -- per-category counts must be within categories.outfit_min / outfit_max
  SELECT c.name INTO broken
  FROM categories c
  LEFT JOIN outfit_items oi ON oi.category_id = c.id AND oi.outfit_id = oid
  GROUP BY c.id, c.name, c.outfit_min, c.outfit_max
  HAVING count(oi.item_id) < c.outfit_min
      OR (c.outfit_max IS NOT NULL AND count(oi.item_id) > c.outfit_max)
  LIMIT 1;

  IF broken IS NOT NULL THEN
    RAISE EXCEPTION 'Outfit has the wrong number of %', broken
      USING ERRCODE = 'check_violation';
  END IF;

  -- signature = sha256 of the sorted item ids; a duplicate raises unique_violation
  SELECT encode(sha256(string_agg(item_id::text, ',' ORDER BY item_id)::bytea), 'hex')
    INTO sig
  FROM outfit_items
  WHERE outfit_id = oid;

  UPDATE outfits
     SET signature = sig
   WHERE id = oid
     AND signature IS DISTINCT FROM sig;

  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER outfit_items_check
  AFTER INSERT OR DELETE ON outfit_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_outfit();

CREATE CONSTRAINT TRIGGER outfits_check
  AFTER INSERT OR UPDATE OF signature ON outfits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_outfit();
```

---

## 6. Seed data

Inserted by `prisma/seed.ts` (`npm run db:seed`), which upserts every row (categories and colours by slug, templates by category + name), so it is safe to re-run. Users never write to these tables.

### 6.1 `categories`

| slug | name | sort_order | outfit_min | outfit_max |
|---|---|---|---|---|
| top | Tops | 1 | 1 | 1 |
| bottom | Bottoms | 2 | 1 | 1 |
| shoes | Shoes | 3 | 0 | 1 |
| accessory | Accessories | 4 | 0 | NULL |

### 6.2 `colors`

| sort | slug | name | hex | neutral |
|---|---|---|---|---|
| 1 | black | Black | #1F1F1F | yes |
| 2 | white | White | #F4F3EF | yes |
| 3 | grey | Grey | #9A9C9F | yes |
| 4 | beige | Beige | #D6C6A5 | yes |
| 5 | brown | Brown | #6B4A33 | yes |
| 6 | navy | Navy | #2B3A57 | yes |
| 7 | blue | Blue | #3F6FA8 | no |
| 8 | lightblue | Light blue | #A9C3DB | no |
| 9 | green | Green | #5E7A4E | no |
| 10 | olive | Olive | #6B7350 | no |
| 11 | red | Red | #B33A3A | no |
| 12 | maroon | Maroon | #6E2B33 | no |
| 13 | pink | Pink | #E3A6B4 | no |
| 14 | yellow | Yellow | #E2C044 | no |
| 15 | orange | Orange | #D9783A | no |
| 16 | purple | Purple | #6E4C8C | no |

### 6.3 `subcategory_templates`

| Category | Starter subcategories (in order) |
|---|---|
| Tops | T-shirts, Shirts, Polos, Hoodies, Sweaters, Jackets |
| Bottoms | Jeans, Trousers, Chinos, Shorts, Joggers |
| Shoes | Sneakers, Boots, Loafers, Formal shoes, Sandals |
| Accessories | Watches, Caps, Bags, Sunglasses, Belts |

---

## 7. Flows (each in one transaction unless noted)

**Sign up**
1. Insert `users`.
2. Insert `user_settings` (defaults).
3. Copy the starter list:
   ```sql
   INSERT INTO subcategories (user_id, category_id, name, sort_order)
   SELECT $1, category_id, name, sort_order FROM subcategory_templates;
   ```
4. Issue tokens (insert `refresh_tokens`).

**Upload an item**
1. Browser: optional background removal, colour detection, user picks category + **required** subcategory.
2. Upload the cutout to Cloudinary (outside the transaction).
3. Transaction: insert `images` (kind `item`) → insert `items`.
4. If step 3 fails, delete the just-uploaded Cloudinary file.

**Delete an item**
1. Count `outfit_items` and `look_items` rows for the item. If any → return the "in N outfits and M looks" error.
2. Transaction: delete `items` row → delete `images` row.
3. After commit: delete the Cloudinary file.

**Save / edit an outfit**
1. New: insert `outfits` (no signature) → insert `outfit_items` rows.
2. Edit: delete the outfit's `outfit_items` → insert the new rows.
3. At commit the trigger checks counts and sets the signature.
   - Unique violation on `outfits_user_signature_key` → "already saved".
   - Check violation → "an outfit needs 1 top and 1 bottom".

**Delete an outfit** — delete `outfits`; `outfit_items` cascade.

**Add / edit a look**
1. Upload to Cloudinary (outside the transaction).
2. Transaction: insert `images` (kind `look`) → `looks` → `look_items` tags.
3. Edit tags: delete the look's `look_items`, insert the new ones.

**Delete a look**
1. Transaction: delete `looks` (tags cascade) → delete `images`.
2. After commit: delete the Cloudinary file.

**Add to wishlist**
1. Normalize the URL.
2. Fetch the page server-side for name + photo; on failure, fall back to the URL slug, no photo.
3. If there's a photo, upload it to Cloudinary.
4. Transaction: `images` (kind `wishlist`, optional) → `wishlist_items`.
5. Unique violation on `wishlist_user_url_key` → "Already in your wishlist" (and remove the uploaded photo).

**Delete a subcategory** — if any items use it → "still has N items" error; otherwise delete.

**Change profile / cover photo**
1. Upload the new image.
2. Transaction: insert `images` → update `users.avatar_image_id` → delete the old `images` row.
3. After commit: delete the old Cloudinary file.

**Delete account** (typed confirmation "DELETE")
1. Delete everything under the user's Cloudinary folder `wardrobe/<userId>/` (by prefix, so abandoned uploads go too), then the empty folders.
   If Cloudinary fails, log it and carry on: the account is still deleted.
2. `DELETE FROM users WHERE id = $1`. Everything else cascades.

---

## 8. Error mapping (Postgres → API)

| SQLSTATE | Constraint / source | Message to the user |
|---|---|---|
| 23505 | `users_email_key` | "An account with this email already exists." |
| 23505 | `users_username_key` | "That username is taken." |
| 23505 | `subcategories_user_id_category_id_name_key` | "\"Kurtas\" already exists in Tops." |
| 23505 | `outfits_user_signature_key` | "You already saved this outfit." |
| 23505 | `wishlist_user_url_key` | "Already in your wishlist." |
| 23503 | FK on delete (item / subcategory in use), raised at COMMIT: `outfit_items_item_id_user_id_category_id_fkey`, `look_items_item_id_user_id_fkey` → item in use; `items_subcategory_fk` → subcategory in use | "This is still used in … Remove it from there first." (backend normally catches this earlier by counting) |
| 23514 | `check_outfit()` | "An outfit needs 1 top and 1 bottom, and at most 1 pair of shoes." |
| 23514 | other CHECKs | Validation error for the field |

Constraint names above are Postgres defaults or names set in the DDL. Verified against the database after the phase 2 migrations.

---

## 9. Decisions log

| Topic | Decision |
|---|---|
| Database | PostgreSQL on Neon (free) |
| IDs | UUID everywhere |
| Images | Central `images` table; files in Cloudinary; only cutouts stored, never originals |
| Background removal | In the browser, optional (switch on upload; auto-off if the photo is already transparent) |
| Categories | 4 fixed shared categories; per-user subcategories copied from templates; subcategory required |
| Colours | 16 fixed shared colours; one required main colour per item |
| Deletes | Block anything in use; cascade only owned mapping rows and account deletion |
| Duplicate outfits | Blocked via signature (same items incl. accessories = duplicate) |
| Outfit rules | Data-driven (`outfit_min`/`outfit_max`), enforced by a deferred DB trigger |
| Wishlist | Photo copied to Cloudinary; links normalized and unique per user; no price |
| Sessions | 30-day sliding refresh tokens with rotation and reuse detection; no device list in v1 |
| Email | No verification or password reset in v1 |
| Outfit builder rows | Fixed 30 / 60 / 10 (UI, not stored) |
| Dates | Never shown in the UI |
| Engine version | PostgreSQL 18 (what Neon runs; was written as 16) |
| Timestamps | `timestamptz(3)` (milliseconds) so pagination cursors built from JavaScript dates are exact |
| Block foreign keys | `NO ACTION` + `DEFERRABLE INITIALLY DEFERRED` (checked at COMMIT), because plain `NO ACTION` made account deletion fail (section 2) |
| Seed data | `prisma/seed.ts`, re-runnable upserts (not a migration) |
| Wishlist link cleaning | Generic rules + known-shop canonical hosts + Amazon `/dp/<ASIN>` (section 3.14) |
| Account delete files | The whole `wardrobe/<userId>/` folder is deleted (also catches abandoned uploads); a Cloudinary failure doesn't block the delete |
