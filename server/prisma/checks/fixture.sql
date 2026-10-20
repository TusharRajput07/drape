-- Test user with one of everything, for checks.sql. Runs inside the caller's open transaction.
-- Uses the psql variables set at the top of checks.sql.

INSERT INTO users (id, email, password_hash, name, username)
VALUES (:'u', 'db-check@drape.test', 'not-a-real-hash', 'DB Check', 'db_check');
INSERT INTO user_settings (user_id) VALUES (:'u');
INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
VALUES (:'u', 'db-check-token-hash', gen_random_uuid(), now() + interval '30 days');

-- Starter subcategories, exactly as signup copies them (01 §7).
INSERT INTO subcategories (user_id, category_id, name, sort_order)
SELECT :'u', category_id, name, sort_order FROM subcategory_templates;

INSERT INTO images (id, user_id, kind, public_id, url) VALUES
  (:'img_top1',   :'u', 'item',     'db-check/top-1',    'https://example.com/top-1.webp'),
  (:'img_top2',   :'u', 'item',     'db-check/top-2',    'https://example.com/top-2.webp'),
  (:'img_bottom', :'u', 'item',     'db-check/bottom',   'https://example.com/bottom.webp'),
  (:'img_shoes',  :'u', 'item',     'db-check/shoes',    'https://example.com/shoes.webp'),
  (:'img_acc',    :'u', 'item',     'db-check/watch',    'https://example.com/watch.webp'),
  (:'img_look',   :'u', 'look',     'db-check/look',     'https://example.com/look.webp'),
  (:'img_avatar', :'u', 'avatar',   'db-check/avatar',   'https://example.com/avatar.webp'),
  (:'img_wish',   :'u', 'wishlist', 'db-check/wishlist', 'https://example.com/wishlist.webp');
UPDATE users SET avatar_image_id = :'img_avatar' WHERE id = :'u';

-- Two tops, a bottom, shoes and a watch, each in the user's own subcategory of the right category.
INSERT INTO items (id, user_id, category_id, subcategory_id, color_id, image_id)
SELECT v.id::uuid, s.user_id, s.category_id, s.id, (SELECT id FROM colors WHERE slug = 'black'), v.image_id::uuid
FROM (VALUES
  (:'top1',   'top',       'T-shirts', :'img_top1'),
  (:'top2',   'top',       'Shirts',   :'img_top2'),
  (:'bottom', 'bottom',    'Jeans',    :'img_bottom'),
  (:'shoes',  'shoes',     'Sneakers', :'img_shoes'),
  (:'acc',    'accessory', 'Watches',  :'img_acc')
) AS v (id, category, subcategory, image_id)
JOIN categories c ON c.slug = v.category
JOIN subcategories s ON s.user_id = :'u' AND s.category_id = c.id AND s.name = v.subcategory;

-- A valid outfit: top 1 + bottom + shoes + watch.
INSERT INTO outfits (id, user_id) VALUES (:'outfit1', :'u');
INSERT INTO outfit_items (outfit_id, user_id, item_id, category_id)
SELECT :'outfit1', user_id, id, category_id FROM items WHERE id IN (:'top1', :'bottom', :'shoes', :'acc');

-- A look tagged with top 2, and a wishlist item with a photo.
INSERT INTO looks (id, user_id, image_id) VALUES (:'look1', :'u', :'img_look');
INSERT INTO look_items (look_id, user_id, item_id) VALUES (:'look1', :'u', :'top2');
INSERT INTO wishlist_items (user_id, url, site_name, product_name, image_id)
VALUES (:'u', 'https://www.myntra.com/shirts/db-check/123', 'Myntra', 'Check shirt', :'img_wish');

-- Run the deferred outfit check now, so the valid outfit is checked and gets its signature,
-- then go back to checking at COMMIT for whatever the caller does next.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
