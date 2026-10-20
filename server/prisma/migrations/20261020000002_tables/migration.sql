-- CreateEnum
CREATE TYPE "accent_color" AS ENUM ('black', 'sage', 'blue', 'clay', 'plum');

-- CreateEnum
CREATE TYPE "image_kind" AS ENUM ('item', 'look', 'avatar', 'cover', 'wishlist');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "username" CITEXT NOT NULL,
    "avatar_image_id" UUID,
    "cover_image_id" UUID,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "accent" "accent_color" NOT NULL DEFAULT 'plum',
    "temp_unit" CHAR(1) NOT NULL DEFAULT 'C',
    "use_location" BOOLEAN NOT NULL DEFAULT true,
    "city_name" VARCHAR(80),
    "city_lat" DECIMAL(8,5),
    "city_lon" DECIMAL(8,5),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" "image_kind" NOT NULL,
    "public_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "format" VARCHAR(10),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(20) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "sort_order" SMALLINT NOT NULL,
    "outfit_min" SMALLINT NOT NULL DEFAULT 0,
    "outfit_max" SMALLINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategory_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "subcategory_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(20) NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "hex" CHAR(7) NOT NULL,
    "is_neutral" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "subcategory_id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "is_liked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "is_favourite" BOOLEAN NOT NULL DEFAULT false,
    "signature" CHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outfits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfit_items" (
    "outfit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "outfit_items_pkey" PRIMARY KEY ("outfit_id","item_id")
);

-- CreateTable
CREATE TABLE "looks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "looks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "look_items" (
    "look_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,

    CONSTRAINT "look_items_pkey" PRIMARY KEY ("look_id","item_id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "site_name" VARCHAR(60) NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "image_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "images_public_id_key" ON "images"("public_id");

-- CreateIndex
CREATE INDEX "images_user_id_idx" ON "images"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "images_id_user_id_key" ON "images"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_sort_order_key" ON "categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "subcategory_templates_category_id_name_key" ON "subcategory_templates"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "colors_slug_key" ON "colors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "colors_sort_order_key" ON "colors"("sort_order");

-- CreateIndex
CREATE INDEX "subcategories_user_category_idx" ON "subcategories"("user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_user_id_category_id_name_key" ON "subcategories"("user_id", "category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_id_user_id_category_id_key" ON "subcategories"("id", "user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_image_id_key" ON "items"("image_id");

-- CreateIndex
CREATE INDEX "items_user_category_created_idx" ON "items"("user_id", "category_id", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "items_subcategory_idx" ON "items"("subcategory_id", "user_id", "category_id");

-- CreateIndex
CREATE INDEX "items_user_color_idx" ON "items"("user_id", "color_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_id_user_id_key" ON "items"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_id_user_id_category_id_key" ON "items"("id", "user_id", "category_id");

-- CreateIndex
CREATE INDEX "outfits_user_created_idx" ON "outfits"("user_id", "created_at" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "outfits_user_signature_key" ON "outfits"("user_id", "signature");

-- CreateIndex
CREATE UNIQUE INDEX "outfits_id_user_id_key" ON "outfits"("id", "user_id");

-- CreateIndex
CREATE INDEX "outfit_items_item_idx" ON "outfit_items"("item_id", "user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "looks_image_id_key" ON "looks"("image_id");

-- CreateIndex
CREATE INDEX "looks_user_created_idx" ON "looks"("user_id", "created_at" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "looks_id_user_id_key" ON "looks"("id", "user_id");

-- CreateIndex
CREATE INDEX "look_items_item_idx" ON "look_items"("item_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_image_id_key" ON "wishlist_items"("image_id");

-- CreateIndex
CREATE INDEX "wishlist_user_created_idx" ON "wishlist_items"("user_id", "created_at" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_user_url_key" ON "wishlist_items"("user_id", "url");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cover_fk" FOREIGN KEY ("cover_image_id") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subcategory_templates" ADD CONSTRAINT "subcategory_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_subcategory_fk" FOREIGN KEY ("subcategory_id", "user_id", "category_id") REFERENCES "subcategories"("id", "user_id", "category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_image_fk" FOREIGN KEY ("image_id", "user_id") REFERENCES "images"("id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_outfit_id_user_id_fkey" FOREIGN KEY ("outfit_id", "user_id") REFERENCES "outfits"("id", "user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_item_id_user_id_category_id_fkey" FOREIGN KEY ("item_id", "user_id", "category_id") REFERENCES "items"("id", "user_id", "category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_image_id_user_id_fkey" FOREIGN KEY ("image_id", "user_id") REFERENCES "images"("id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_look_id_user_id_fkey" FOREIGN KEY ("look_id", "user_id") REFERENCES "looks"("id", "user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_item_id_user_id_fkey" FOREIGN KEY ("item_id", "user_id") REFERENCES "items"("id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
