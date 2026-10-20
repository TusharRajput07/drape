-- Hand-written (02 §4): triggers from 01 §5.

-- 5.1 updated_at --------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_settings_updated_at  BEFORE UPDATE ON user_settings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subcategories_updated_at  BEFORE UPDATE ON subcategories  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER items_updated_at          BEFORE UPDATE ON items          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER outfits_updated_at        BEFORE UPDATE ON outfits        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER looks_updated_at          BEFORE UPDATE ON looks          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER wishlist_items_updated_at BEFORE UPDATE ON wishlist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.2 Outfit rules and signature (deferred, runs at COMMIT) -----------------------
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
