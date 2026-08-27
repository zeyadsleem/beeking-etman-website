CREATE TABLE `store_admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `store_admin_audit_createdAt_idx` ON `store_admin_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `store_admin_audit_targetType_targetId_idx` ON `store_admin_audit` (`target_type`,`target_id`);