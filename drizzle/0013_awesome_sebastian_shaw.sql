CREATE TABLE `store_blend_benefit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value_ar` text NOT NULL,
	`value_en` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_blend_benefit_key_unique` ON `store_blend_benefit` (`key`);