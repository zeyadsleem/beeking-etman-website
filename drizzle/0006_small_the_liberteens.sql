CREATE INDEX `store_order_userId_createdAt_idx` ON `store_order` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `store_order_item_orderId_idx` ON `store_order_item` (`order_id`);--> statement-breakpoint
CREATE INDEX `store_product_categoryId_idx` ON `store_product` (`category_id`);--> statement-breakpoint
CREATE INDEX `store_product_image_productId_idx` ON `store_product_image` (`product_id`);--> statement-breakpoint
CREATE INDEX `store_product_variant_productId_idx` ON `store_product_variant` (`product_id`);--> statement-breakpoint
-- Hand-written: drizzle cannot emit data statements. Keeps the UNIQUE index
-- below applicable to legacy databases containing duplicate variants; keeps
-- the oldest row per pair. Nothing references store_product_variant.id
-- (order items snapshot variant_name as text), so this cannot orphan data.
DELETE FROM `store_product_variant` WHERE rowid NOT IN (SELECT MIN(rowid) FROM `store_product_variant` GROUP BY `product_id`, `name`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_product_variant_productId_name_unique` ON `store_product_variant` (`product_id`,`name`);