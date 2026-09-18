-- SET-2: settlement schema (spec docs/superpowers/specs/2026-09-17-manual-settlement-design.md §4.1).
-- This migration folds the DI D1 store_order rebuild (roadmap C2/§8.5): the physical defaults
-- align to pending_confirmation/unpaid, ck_order_stock_version lands here, and every 0016
-- store_order trigger is recreated. Migration 0021 will never be created.
-- No backfill: pre-pivot rows keep their stored placed/paid/simulated values and read through
-- the legacy aliases.
--
-- Foreign keys: D1 applies every migration inside an implicit transaction, where
-- PRAGMA foreign_keys=OFF is a no-op (documented D1 behavior). PRAGMA defer_foreign_keys=ON is
-- the supported mechanism: it defers constraint checks to the commit, after the renamed table
-- carries the same ids again. Both store_order child tables (store_order_item,
-- store_payment_event) use NO ACTION, so the implicit DELETE on DROP never cascades.
CREATE TABLE `store_payment_event` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`actor` text DEFAULT 'system' NOT NULL,
	`actor_user_id` text,
	`method` text,
	`reference` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `store_order`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `store_payment_event_orderId_createdAt_idx` ON `store_payment_event` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `trg_payment_event_no_update`
BEFORE UPDATE ON `store_payment_event`
BEGIN
  SELECT RAISE(ABORT, 'PAYMENT_EVENT_APPEND_ONLY');
END;--> statement-breakpoint
CREATE TRIGGER `trg_payment_event_no_delete`
BEFORE DELETE ON `store_payment_event`
BEGIN
  SELECT RAISE(ABORT, 'PAYMENT_EVENT_APPEND_ONLY');
END;--> statement-breakpoint
CREATE TRIGGER `trg_payment_event_values_valid`
BEFORE INSERT ON `store_payment_event`
WHEN NEW.`type` NOT IN ('claim','verified','rejected','refund','expiry','note')
  OR NEW.`actor` NOT IN ('customer','admin','system')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PAYMENT_EVENT_VALUES');
END;--> statement-breakpoint
-- The store_order rebuild would leave the order_item reserve trigger with a stale table
-- reference, so drop it before the rebuild and recreate it from its captured 0016 definition
-- after the rename.
DROP TRIGGER IF EXISTS `trg_order_item_reserve_stock`;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_store_order` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`nonce` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`governorate` text DEFAULT 'cairo' NOT NULL,
	`shipping_cost` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'pending_confirmation' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`stock_version` text DEFAULT 'legacy' NOT NULL,
	`payment_method` text DEFAULT 'simulated' NOT NULL,
	`payment_reference` text,
	`payment_claimed_at` integer,
	`payment_reviewed_at` integer,
	`payment_reviewed_by` text,
	`hold_expires_at` integer,
	`paid_at` integer,
	`user_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "ck_order_stock_version" CHECK("__new_store_order"."stock_version" IN ('atomic','legacy'))
);--> statement-breakpoint
INSERT INTO `__new_store_order` (
	`id`, `number`, `nonce`, `email`, `name`, `phone`, `address`, `city`, `governorate`,
	`shipping_cost`, `total`, `status`, `payment_status`, `stock_version`,
	`payment_method`, `payment_reference`, `payment_claimed_at`, `payment_reviewed_at`,
	`payment_reviewed_by`, `hold_expires_at`, `paid_at`, `user_id`, `created_at`
)
SELECT
	`id`, `number`, `nonce`, `email`, `name`, `phone`, `address`, `city`, `governorate`,
	`shipping_cost`, `total`, `status`, `payment_status`, `stock_version`,
	'simulated', NULL, NULL, NULL, NULL, NULL, NULL, `user_id`, `created_at`
FROM `store_order`;--> statement-breakpoint
DROP TABLE `store_order`;--> statement-breakpoint
ALTER TABLE `__new_store_order` RENAME TO `store_order`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_number_unique` ON `store_order` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_nonce_unique` ON `store_order` (`nonce`);--> statement-breakpoint
CREATE INDEX `store_order_userId_createdAt_idx` ON `store_order` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `store_order_hold_idx` ON `store_order` (`hold_expires_at`) WHERE "store_order"."status" IN ('pending_confirmation','confirmed','processing');--> statement-breakpoint
CREATE TRIGGER `trg_order_item_reserve_stock`
BEFORE INSERT ON `store_order_item`
WHEN (SELECT `stock_version` FROM `store_order` WHERE `id` = NEW.`order_id`) = 'atomic'
BEGIN
  SELECT (CASE
    WHEN NEW.`variant_id` IS NULL THEN
      RAISE(ABORT, 'MISSING_VARIANT_ID')
  END);
  UPDATE `store_product_variant`
  SET `stock` = `stock` - NEW.`quantity`
  WHERE `id` = NEW.`variant_id` AND `stock` >= NEW.`quantity`;
  SELECT (CASE
    WHEN (SELECT changes()) = 0 THEN
      RAISE(ABORT, 'OUT_OF_STOCK')
  END);
END;--> statement-breakpoint
CREATE TRIGGER `trg_order_status_cancel_restock`
AFTER UPDATE OF `status` ON `store_order`
WHEN NEW.`status` = 'cancelled' AND OLD.`status` != 'cancelled' AND NEW.`stock_version` = 'atomic'
  AND OLD.`status` IN ('pending_confirmation','confirmed','processing','placed','paid')
BEGIN
  UPDATE `store_product_variant`
  SET `stock` = `stock` + COALESCE((
    SELECT SUM(`quantity`)
    FROM `store_order_item`
    WHERE `order_id` = NEW.`id` AND `variant_id` = `store_product_variant`.`id`
  ), 0)
  WHERE `id` IN (SELECT `variant_id` FROM `store_order_item` WHERE `order_id` = NEW.`id` AND `variant_id` IS NOT NULL);
END;--> statement-breakpoint
CREATE TRIGGER `trg_order_settlement_values_valid`
BEFORE INSERT ON `store_order`
WHEN NEW.`status` NOT IN ('pending_confirmation','confirmed','processing','shipped','delivered','cancelled','placed','paid')
  OR NEW.`payment_status` NOT IN ('unpaid','pending_review','paid','failed','refunded','simulated')
  OR NEW.`payment_method` NOT IN ('cod','instapay','wallet','simulated','paymob')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_ORDER_VALUES');
END;--> statement-breakpoint
CREATE TRIGGER `trg_order_settlement_values_valid_update`
BEFORE UPDATE OF `status`, `payment_status`, `payment_method` ON `store_order`
WHEN NEW.`status` NOT IN ('pending_confirmation','confirmed','processing','shipped','delivered','cancelled','placed','paid')
  OR NEW.`payment_status` NOT IN ('unpaid','pending_review','paid','failed','refunded','simulated')
  OR NEW.`payment_method` NOT IN ('cod','instapay','wallet','simulated','paymob')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_ORDER_VALUES');
END;--> statement-breakpoint
-- `cancelled` is terminal (spec §3.1). This guard also makes double restocking impossible:
-- without it, cancelled -> processing -> cancelled would fire the restock trigger twice.
CREATE TRIGGER `trg_order_cancelled_terminal`
BEFORE UPDATE OF `status` ON `store_order`
WHEN OLD.`status` = 'cancelled' AND NEW.`status` != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'CANCELLED_IS_TERMINAL');
END;
