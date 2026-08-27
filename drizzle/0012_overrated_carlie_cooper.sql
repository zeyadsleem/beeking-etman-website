ALTER TABLE `store_category` ADD `department` text DEFAULT 'honey' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_category` ADD `parent_id` text REFERENCES store_category(id);--> statement-breakpoint
ALTER TABLE `store_product` ADD `department` text DEFAULT 'honey' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_product` ADD `sku` text;--> statement-breakpoint
ALTER TABLE `store_product` ADD `published` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `store_product` ADD `cost_price` integer;--> statement-breakpoint
ALTER TABLE `store_product` ADD `weight_grams` integer;