-- Hand-written (02 §4): CHECK constraints and partial indexes from 01 §4 that Prisma's schema can't express.
-- CHECKs are named <table>_<column>_check so a 23514 error can be mapped back to the field.

-- users
ALTER TABLE users
  ADD CONSTRAINT users_name_check     CHECK (char_length(btrim(name)) > 0),
  ADD CONSTRAINT users_username_check CHECK (username ~ '^[a-z0-9_.]{3,24}$');

-- images
ALTER TABLE images
  ADD CONSTRAINT images_width_check  CHECK (width  > 0),
  ADD CONSTRAINT images_height_check CHECK (height > 0),
  ADD CONSTRAINT images_bytes_check  CHECK (bytes  > 0);

-- user_settings
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_temp_unit_check   CHECK (temp_unit IN ('C', 'F')),
  ADD CONSTRAINT user_settings_city_lat_check    CHECK (city_lat BETWEEN -90 AND 90),
  ADD CONSTRAINT user_settings_city_lon_check    CHECK (city_lon BETWEEN -180 AND 180),
  ADD CONSTRAINT user_settings_city_coords_check CHECK ((city_lat IS NULL) = (city_lon IS NULL));

-- categories
ALTER TABLE categories
  ADD CONSTRAINT categories_outfit_min_check CHECK (outfit_min >= 0),
  ADD CONSTRAINT categories_outfit_max_check CHECK (outfit_max IS NULL OR outfit_max >= outfit_min);

-- subcategory_templates / subcategories
ALTER TABLE subcategory_templates
  ADD CONSTRAINT subcategory_templates_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 24);
ALTER TABLE subcategories
  ADD CONSTRAINT subcategories_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 24);

-- colors
ALTER TABLE colors
  ADD CONSTRAINT colors_hex_check CHECK (hex ~ '^#[0-9A-F]{6}$');

-- wishlist_items
ALTER TABLE wishlist_items
  ADD CONSTRAINT wishlist_items_url_check CHECK (url ~* '^https?://' AND char_length(url) <= 2048);

-- Partial indexes. Prisma doesn't know about these: delete any DROP INDEX lines for them
-- that show up in future generated migrations.
CREATE INDEX items_user_liked_idx ON items (user_id) WHERE is_liked;
CREATE INDEX outfits_user_fav_idx ON outfits (user_id) WHERE is_favourite;
