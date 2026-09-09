INSERT INTO store_product_image (id, product_id, url, sort_order)
SELECT lower(hex(randomblob(16))), p.id, p.image,
  coalesce((SELECT min(i.sort_order) FROM store_product_image i WHERE i.product_id = p.id), 0) - 1
FROM store_product p
WHERE trim(p.image) <> ''
  AND NOT EXISTS (SELECT 1 FROM store_product_image i WHERE i.product_id = p.id AND i.url = p.image);
--> statement-breakpoint
CREATE TRIGGER store_product_legacy_cover_insert AFTER INSERT ON store_product
WHEN trim(NEW.image) <> ''
BEGIN
  INSERT INTO store_product_image (id, product_id, url, sort_order)
  VALUES (lower(hex(randomblob(16))), NEW.id, NEW.image, -1);
END;
--> statement-breakpoint
CREATE TRIGGER store_product_legacy_cover_update AFTER UPDATE OF image ON store_product
WHEN NEW.image <> OLD.image AND trim(NEW.image) <> ''
BEGIN
  INSERT INTO store_product_image (id, product_id, url, sort_order)
  SELECT lower(hex(randomblob(16))), NEW.id, NEW.image,
    coalesce((SELECT min(sort_order) FROM store_product_image WHERE product_id = NEW.id), 0) - 1
  WHERE NOT EXISTS (SELECT 1 FROM store_product_image WHERE product_id = NEW.id AND url = NEW.image);
  UPDATE store_product_image
  SET sort_order = (SELECT min(sort_order) - 1 FROM store_product_image WHERE product_id = NEW.id)
  WHERE product_id = NEW.id AND url = NEW.image;
END;
