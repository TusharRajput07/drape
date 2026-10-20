-- Manual database checks for phase 2's "Done when" list (spec/00-overview.md) and 01 §2 / §5.
-- Run: npm run db:check   (needs psql). Not an automated test: read the output.
-- Every check builds its own data in a transaction that ends in a failed COMMIT or a ROLLBACK,
-- so nothing is left behind. Expected errors are printed as ERROR lines with their SQLSTATE.

\set QUIET on
\set VERBOSITY verbose
\set SHOW_CONTEXT never
\pset footer off

\set u          00000000-0000-4000-8000-000000000001
\set img_top1   00000000-0000-4000-8000-000000000101
\set img_top2   00000000-0000-4000-8000-000000000102
\set img_bottom 00000000-0000-4000-8000-000000000103
\set img_shoes  00000000-0000-4000-8000-000000000104
\set img_acc    00000000-0000-4000-8000-000000000105
\set img_look   00000000-0000-4000-8000-000000000106
\set img_avatar 00000000-0000-4000-8000-000000000107
\set img_wish   00000000-0000-4000-8000-000000000108
\set top1       00000000-0000-4000-8000-000000000201
\set top2       00000000-0000-4000-8000-000000000202
\set bottom     00000000-0000-4000-8000-000000000203
\set shoes      00000000-0000-4000-8000-000000000204
\set acc        00000000-0000-4000-8000-000000000205
\set outfit1    00000000-0000-4000-8000-000000000301
\set outfit2    00000000-0000-4000-8000-000000000302
\set look1      00000000-0000-4000-8000-000000000401

-- Leftovers from an interrupted run (normally nothing).
DELETE FROM users WHERE id = :'u';

\echo
\echo '=== 0. Setup: a valid outfit (top + bottom + shoes + watch) passes and gets a signature'
BEGIN;
\ir fixture.sql
SELECT o.signature IS NOT NULL AS has_signature, count(oi.item_id) AS pieces
FROM outfits o JOIN outfit_items oi ON oi.outfit_id = o.id
WHERE o.id = :'outfit1' GROUP BY o.id;
ROLLBACK;

\echo
\echo '=== 1. Same items as an existing outfit -> unique violation (23505) at COMMIT'
BEGIN;
\ir fixture.sql
INSERT INTO outfits (id, user_id) VALUES (:'outfit2', :'u');
INSERT INTO outfit_items (outfit_id, user_id, item_id, category_id)
SELECT :'outfit2', user_id, id, category_id FROM items WHERE id IN (:'acc', :'shoes', :'bottom', :'top1');
\echo 'Inserts accepted (the check is deferred). Committing:'
COMMIT;

\echo
\echo '=== 2a. Two tops -> check violation (23514) at COMMIT'
BEGIN;
\ir fixture.sql
INSERT INTO outfits (id, user_id) VALUES (:'outfit2', :'u');
INSERT INTO outfit_items (outfit_id, user_id, item_id, category_id)
SELECT :'outfit2', user_id, id, category_id FROM items WHERE id IN (:'top1', :'top2', :'bottom');
\echo 'Inserts accepted (the check is deferred). Committing:'
COMMIT;

\echo
\echo '=== 2b. No bottom -> check violation (23514) at COMMIT'
BEGIN;
\ir fixture.sql
INSERT INTO outfits (id, user_id) VALUES (:'outfit2', :'u');
INSERT INTO outfit_items (outfit_id, user_id, item_id, category_id)
SELECT :'outfit2', user_id, id, category_id FROM items WHERE id IN (:'top1', :'shoes');
\echo 'Inserts accepted (the check is deferred). Committing:'
COMMIT;

\echo
\echo '=== 3. Deleting things that are still used -> blocked (23503) at COMMIT'
\echo '(The block FKs are deferred so account deletion can cascade; see migration 20261020000005.)'
\echo '3a. Item in an outfit:'
BEGIN;
\ir fixture.sql
DELETE FROM items WHERE id = :'top1';
COMMIT;
\echo '3b. Item in a look:'
BEGIN;
\ir fixture.sql
DELETE FROM items WHERE id = :'top2';
COMMIT;
\echo '3c. Subcategory that still has items:'
BEGIN;
\ir fixture.sql
DELETE FROM subcategories WHERE id = (SELECT subcategory_id FROM items WHERE id = :'bottom');
COMMIT;
\echo '3d. Control: an item that is not used anywhere can be deleted (and its image after it):'
BEGIN;
\ir fixture.sql
INSERT INTO images (id, user_id, kind, public_id, url)
VALUES ('00000000-0000-4000-8000-000000000109', :'u', 'item', 'db-check/spare', 'https://example.com/spare.webp');
INSERT INTO items (id, user_id, category_id, subcategory_id, color_id, image_id)
SELECT '00000000-0000-4000-8000-000000000206', user_id, category_id, subcategory_id, color_id,
       '00000000-0000-4000-8000-000000000109'
FROM items WHERE id = :'acc';
DELETE FROM items WHERE id = '00000000-0000-4000-8000-000000000206';
DELETE FROM images WHERE id = '00000000-0000-4000-8000-000000000109';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT 'deleted unused item and its image; commit-time checks passed' AS result;
ROLLBACK;

\echo
\echo '=== 4. Deleting the user -> everything of theirs disappears'
BEGIN;
\ir fixture.sql
\echo 'Before:'
CREATE TEMP VIEW db_check_rows AS
  SELECT 'users' AS table_name, count(*) AS rows FROM users WHERE id = :'u'
  UNION ALL SELECT 'user_settings',  count(*) FROM user_settings  WHERE user_id = :'u'
  UNION ALL SELECT 'refresh_tokens', count(*) FROM refresh_tokens WHERE user_id = :'u'
  UNION ALL SELECT 'images',         count(*) FROM images         WHERE user_id = :'u'
  UNION ALL SELECT 'subcategories',  count(*) FROM subcategories  WHERE user_id = :'u'
  UNION ALL SELECT 'items',          count(*) FROM items          WHERE user_id = :'u'
  UNION ALL SELECT 'outfits',        count(*) FROM outfits        WHERE user_id = :'u'
  UNION ALL SELECT 'outfit_items',   count(*) FROM outfit_items   WHERE user_id = :'u'
  UNION ALL SELECT 'looks',          count(*) FROM looks          WHERE user_id = :'u'
  UNION ALL SELECT 'look_items',     count(*) FROM look_items     WHERE user_id = :'u'
  UNION ALL SELECT 'wishlist_items', count(*) FROM wishlist_items WHERE user_id = :'u';
SELECT * FROM db_check_rows;
DELETE FROM users WHERE id = :'u';
\echo 'After DELETE FROM users (then COMMIT, so the deferred outfit triggers run too):'
SELECT * FROM db_check_rows;
COMMIT;
\echo 'Rows left for the test user after COMMIT:'
SELECT (SELECT count(*) FROM users WHERE id = :'u') + (SELECT count(*) FROM images WHERE user_id = :'u')
     + (SELECT count(*) FROM items WHERE user_id = :'u') + (SELECT count(*) FROM outfits WHERE user_id = :'u')
     AS rows_left;
