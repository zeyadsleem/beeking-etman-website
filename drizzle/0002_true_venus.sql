CREATE TABLE `store_rate_limit` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
ALTER TABLE `store_order` ADD `nonce` text;--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_nonce_unique` ON `store_order` (`nonce`);