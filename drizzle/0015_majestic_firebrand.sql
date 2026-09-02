ALTER TABLE `store_order` ADD `governorate` text DEFAULT 'cairo' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order` ADD `shipping_cost` integer DEFAULT 0 NOT NULL;