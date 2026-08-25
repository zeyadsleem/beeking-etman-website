-- SQLite requires a non-null DEFAULT when adding a NOT NULL column.
-- 'local:credential' is better-auth's own synthetic issuer for password
-- accounts (createLocalAccountIssuer("credential")), so existing rows are
-- backfilled with exactly the value better-auth 1.7 writes at runtime.
ALTER TABLE `account` ADD `issuer` text NOT NULL DEFAULT 'local:credential';--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_accountId_uidx` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;