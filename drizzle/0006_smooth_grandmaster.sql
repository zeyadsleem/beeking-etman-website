PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_store_order` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`nonce` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_store_order`("id", "number", "nonce", "email", "name", "phone", "address", "city", "total", "status", "user_id", "created_at") SELECT "id", "number", "nonce", "email", "name", "phone", "address", "city", "total", "status", "user_id", "created_at" FROM `store_order`;--> statement-breakpoint
DROP TABLE `store_order`;--> statement-breakpoint
ALTER TABLE `__new_store_order` RENAME TO `store_order`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_number_unique` ON `store_order` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_nonce_unique` ON `store_order` (`nonce`);--> statement-breakpoint
CREATE INDEX `store_order_userId_createdAt_idx` ON `store_order` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `store_order_item_orderId_idx` ON `store_order_item` (`order_id`);--> statement-breakpoint
CREATE INDEX `store_product_categoryId_idx` ON `store_product` (`category_id`);--> statement-breakpoint
CREATE INDEX `store_product_image_productId_idx` ON `store_product_image` (`product_id`);--> statement-breakpoint
CREATE INDEX `store_product_variant_productId_idx` ON `store_product_variant` (`product_id`);--> statement-breakpoint
-- Deduplicate variants before enforcing UNIQUE(product_id, name): keep the
-- oldest row per pair. Nothing references store_product_variant.id (order
-- items snapshot variant_name as text), so this cannot orphan data.
DELETE FROM `store_product_variant` WHERE rowid NOT IN (SELECT MIN(rowid) FROM `store_product_variant` GROUP BY `product_id`, `name`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_product_variant_productId_name_unique` ON `store_product_variant` (`product_id`,`name`);