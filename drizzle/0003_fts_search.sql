CREATE VIRTUAL TABLE IF NOT EXISTS store_product_fts USING fts5(
  product_id UNINDEXED,
  name,
  description,
  tokenize = 'unicode61'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS store_product_fts_ai AFTER INSERT ON store_product BEGIN
  INSERT INTO store_product_fts(product_id, name, description)
  VALUES (new.id, new.name, new.description);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS store_product_fts_ad AFTER DELETE ON store_product BEGIN
  DELETE FROM store_product_fts WHERE product_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS store_product_fts_au AFTER UPDATE ON store_product BEGIN
  DELETE FROM store_product_fts WHERE product_id = old.id;
  INSERT INTO store_product_fts(product_id, name, description)
  VALUES (new.id, new.name, new.description);
END;
--> statement-breakpoint
INSERT INTO store_product_fts(product_id, name, description)
SELECT id, name, description FROM store_product;