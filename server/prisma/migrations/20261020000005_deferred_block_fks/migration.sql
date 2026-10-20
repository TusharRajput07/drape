-- Hand-written: the "block" foreign keys between user-owned tables are checked at COMMIT (01 §2).
-- With plain NO ACTION, deleting a user failed: Postgres runs each ON DELETE CASCADE step as its own
-- internal statement and checks NO ACTION at the end of that step, so e.g. the cascade into items
-- was blocked by outfit_items rows whose own cascade hadn't run yet. Deferred to COMMIT, the whole
-- cascade finishes first. Deleting something still in use stays blocked (the error comes at COMMIT).
-- Prisma's schema can't express DEFERRABLE.
ALTER TABLE outfit_items ALTER CONSTRAINT outfit_items_item_id_user_id_category_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE look_items   ALTER CONSTRAINT look_items_item_id_user_id_fkey               DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE items        ALTER CONSTRAINT items_image_fk                                DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE items        ALTER CONSTRAINT items_subcategory_fk                          DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE looks        ALTER CONSTRAINT looks_image_id_user_id_fkey                   DEFERRABLE INITIALLY DEFERRED;
