CREATE TABLE `store_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_number` text NOT NULL,
	`product_id` text NOT NULL,
	`season_name` text NOT NULL,
	`season_name_en` text DEFAULT '' NOT NULL,
	`apiary_source` text DEFAULT '' NOT NULL,
	`harvest_date` integer NOT NULL,
	`expiry_date` integer NOT NULL,
	`lab_cert_url` text,
	`qr_code` text,
	`initial_quantity_kg` real NOT NULL,
	`quantity_kg` real NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `store_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_batch_batch_number_unique` ON `store_batch` (`batch_number`);--> statement-breakpoint
CREATE INDEX `store_batch_productId_idx` ON `store_batch` (`product_id`);--> statement-breakpoint
CREATE INDEX `store_batch_expiry_idx` ON `store_batch` (`expiry_date`);--> statement-breakpoint
CREATE TABLE `store_coupon` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'percent' NOT NULL,
	`value` integer NOT NULL,
	`min_spend` integer DEFAULT 0 NOT NULL,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`valid_from` integer,
	`valid_until` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_coupon_code_unique` ON `store_coupon` (`code`);--> statement-breakpoint
CREATE TABLE `store_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE INDEX `store_notification_type_idx` ON `store_notification` (`type`);--> statement-breakpoint
CREATE TABLE `store_packaging_material` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`sku` text,
	`unit_label` text DEFAULT '' NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`reorder_point` integer DEFAULT 0 NOT NULL,
	`cost_per_unit` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store_return` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`reason` text NOT NULL,
	`damage_type` text,
	`refund_amount` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `store_order`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_return_orderId_idx` ON `store_return` (`order_id`);--> statement-breakpoint
CREATE TABLE `store_review` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text,
	`rating` integer NOT NULL,
	`comment` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `store_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_review_productId_idx` ON `store_review` (`product_id`);--> statement-breakpoint
CREATE TABLE `store_stock_conversion` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`raw_kgs_used` real NOT NULL,
	`units_produced` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `store_batch`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `store_product_variant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_stock_conversion_batchId_idx` ON `store_stock_conversion` (`batch_id`);--> statement-breakpoint
CREATE TABLE `store_stock_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`item_type` text DEFAULT 'variant' NOT NULL,
	`item_id` text NOT NULL,
	`warehouse_id` text,
	`quantity` integer NOT NULL,
	`ref_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `store_warehouse`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_stock_movement_itemType_itemId_idx` ON `store_stock_movement` (`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `store_stock_movement_createdAt_idx` ON `store_stock_movement` (`created_at`);--> statement-breakpoint
CREATE TABLE `store_transfer` (
	`id` text PRIMARY KEY NOT NULL,
	`from_warehouse_id` text NOT NULL,
	`to_warehouse_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`from_warehouse_id`) REFERENCES `store_warehouse`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_warehouse_id`) REFERENCES `store_warehouse`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_transfer_status_idx` ON `store_transfer` (`status`);--> statement-breakpoint
CREATE INDEX `store_transfer_fromWarehouseId_idx` ON `store_transfer` (`from_warehouse_id`);--> statement-breakpoint
CREATE TABLE `store_transfer_item` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_id` text NOT NULL,
	`item_type` text DEFAULT 'variant' NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`transfer_id`) REFERENCES `store_transfer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_transfer_item_transferId_idx` ON `store_transfer_item` (`transfer_id`);--> statement-breakpoint
CREATE TABLE `store_warehouse` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL
);
