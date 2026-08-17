ALTER TABLE `store_category` ADD `name_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_product` ADD `name_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_product` ADD `description_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_product_variant` ADD `name_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
DROP TRIGGER IF EXISTS `store_product_fts_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `store_product_fts_ad`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `store_product_fts_au`;--> statement-breakpoint
DROP TABLE IF EXISTS `store_product_fts`;--> statement-breakpoint
CREATE VIRTUAL TABLE `store_product_fts` USING fts5(
  product_id UNINDEXED,
  name,
  description,
  name_en,
  description_en,
  tokenize = 'unicode61'
);--> statement-breakpoint
CREATE TRIGGER `store_product_fts_ai` AFTER INSERT ON `store_product` BEGIN
  INSERT INTO `store_product_fts`(product_id, name, description, name_en, description_en)
  VALUES (new.id, new.name, new.description, new.name_en, new.description_en);
END;--> statement-breakpoint
CREATE TRIGGER `store_product_fts_ad` AFTER DELETE ON `store_product` BEGIN
  DELETE FROM `store_product_fts` WHERE product_id = old.id;
END;--> statement-breakpoint
CREATE TRIGGER `store_product_fts_au` AFTER UPDATE ON `store_product` BEGIN
  DELETE FROM `store_product_fts` WHERE product_id = old.id;
  INSERT INTO `store_product_fts`(product_id, name, description, name_en, description_en)
  VALUES (new.id, new.name, new.description, new.name_en, new.description_en);
END;--> statement-breakpoint
INSERT INTO `store_product_fts`(product_id, name, description, name_en, description_en)
SELECT id, name, description, name_en, description_en FROM `store_product`;