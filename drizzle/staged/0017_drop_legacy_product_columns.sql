DROP TRIGGER IF EXISTS store_product_legacy_cover_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS store_product_legacy_cover_update;
--> statement-breakpoint
ALTER TABLE store_product DROP COLUMN price;
--> statement-breakpoint
ALTER TABLE store_product DROP COLUMN stock;
--> statement-breakpoint
ALTER TABLE store_product DROP COLUMN image;
