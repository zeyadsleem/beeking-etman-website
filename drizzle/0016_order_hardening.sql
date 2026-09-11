ALTER TABLE `store_order` ADD `payment_status` text DEFAULT 'simulated' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order` ADD `stock_version` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE TABLE `store_order_item_new` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL REFERENCES `store_order`(`id`),
  `product_id` text NOT NULL REFERENCES `store_product`(`id`),
  `variant_id` text REFERENCES `store_product_variant`(`id`),
  `product_name` text NOT NULL,
  `variant_name` text NOT NULL DEFAULT '',
  `quantity` integer NOT NULL CHECK (`quantity` > 0),
  `unit_price` integer NOT NULL CHECK (`unit_price` >= 0)
);--> statement-breakpoint
INSERT INTO `store_order_item_new` (`id`, `order_id`, `product_id`, `variant_id`, `product_name`, `variant_name`, `quantity`, `unit_price`)
SELECT `id`, `order_id`, `product_id`, NULL, `product_name`, `variant_name`, `quantity`, `unit_price` FROM `store_order_item`;--> statement-breakpoint
UPDATE `store_order_item_new`
SET `variant_id` = (
  SELECT `id` FROM `store_product_variant`
  WHERE `store_product_variant`.`product_id` = `store_order_item_new`.`product_id`
  AND `store_product_variant`.`name` = `store_order_item_new`.`variant_name`
);--> statement-breakpoint
DROP TABLE `store_order_item`;--> statement-breakpoint
ALTER TABLE `store_order_item_new` RENAME TO `store_order_item`;--> statement-breakpoint
CREATE INDEX `store_order_item_orderId_idx` ON `store_order_item` (`order_id`);--> statement-breakpoint
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
CREATE TRIGGER `trg_order_item_quantity_positive`
BEFORE INSERT ON `store_order_item`
WHEN NEW.`quantity` <= 0
BEGIN
  SELECT RAISE(ABORT, 'INVALID_QUANTITY');
END;--> statement-breakpoint
CREATE TRIGGER `trg_order_item_price_non_negative`
BEFORE INSERT ON `store_order_item`
WHEN NEW.`unit_price` < 0
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PRICE');
END;--> statement-breakpoint
CREATE TRIGGER `trg_product_variant_stock_non_negative`
BEFORE UPDATE OF `stock` ON `store_product_variant`
WHEN NEW.`stock` < 0
BEGIN
  SELECT RAISE(ABORT, 'STOCK_NEGATIVE');
END;--> statement-breakpoint
CREATE TRIGGER `trg_order_status_cancel_restock`
AFTER UPDATE OF `status` ON `store_order`
WHEN NEW.`status` = 'cancelled' AND OLD.`status` != 'cancelled' AND NEW.`stock_version` = 'atomic'
BEGIN
  UPDATE `store_product_variant`
  SET `stock` = `stock` + COALESCE((
    SELECT SUM(`quantity`)
    FROM `store_order_item`
    WHERE `order_id` = NEW.`id` AND `variant_id` = `store_product_variant`.`id`
  ), 0)
  WHERE `id` IN (SELECT `variant_id` FROM `store_order_item` WHERE `order_id` = NEW.`id` AND `variant_id` IS NOT NULL);
END;
