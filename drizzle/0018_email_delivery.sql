-- EM-1: outbox rebuild for the email delivery pipeline (spec §3.2).
-- Every row created before this migration is unverifiable: the previous app marked rows
-- 'sent' after a silent no-op and no provider message id was recorded. Legacy rows keep a
-- terminal 'sent' status and are never retried, which prevents duplicate sends; their
-- delivery cannot be proven.
CREATE TABLE `store_notification_new` (
  `id`                  text PRIMARY KEY NOT NULL,
  `type`                text NOT NULL,
  `channel`             text NOT NULL DEFAULT 'email',
  `recipient`           text NOT NULL,
  `from_address`        text NOT NULL DEFAULT '',
  `subject`             text NOT NULL,
  `body`                text NOT NULL,
  `status`              text NOT NULL DEFAULT 'pending'
                        CHECK (`status` IN ('pending','sending','sent','failed','dead')),
  `attempt_count`       integer NOT NULL DEFAULT 0,
  `next_attempt_at`     integer,
  `last_error`          text,
  `provider_message_id` text,
  `locked_at`           integer,
  `idempotency_key`     text,
  `created_at`          integer NOT NULL,
  `sent_at`             integer
);--> statement-breakpoint
INSERT INTO `store_notification_new` (
  `id`, `type`, `channel`, `recipient`, `from_address`, `subject`, `body`, `status`,
  `attempt_count`, `next_attempt_at`, `last_error`, `provider_message_id`, `locked_at`,
  `idempotency_key`, `created_at`, `sent_at`
)
SELECT
  `id`, `type`, `channel`, `recipient`, '', `subject`, `body`, 'sent',
  0, `created_at`, NULL, NULL, NULL, NULL, `created_at`, `sent_at`
FROM `store_notification`;--> statement-breakpoint
DROP TABLE `store_notification`;--> statement-breakpoint
ALTER TABLE `store_notification_new` RENAME TO `store_notification`;--> statement-breakpoint
CREATE INDEX `store_notification_type_idx` ON `store_notification` (`type`);--> statement-breakpoint
CREATE INDEX `store_notification_due_idx` ON `store_notification` (`status`, `next_attempt_at`);--> statement-breakpoint
CREATE INDEX `store_notification_created_idx` ON `store_notification` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_notification_idem_idx` ON `store_notification` (`idempotency_key`) WHERE `idempotency_key` IS NOT NULL;
