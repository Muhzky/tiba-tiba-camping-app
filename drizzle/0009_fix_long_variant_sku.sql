-- Perbaikan data: SKU varian hasil generate `${slug}-default` bisa melebihi batas
-- skema (64 karakter) untuk nama produk panjang. Samakan dengan helper `variantSku`:
-- potong bagian slug agar total tepat 64, sufiks `-default` tetap utuh.
UPDATE "product_variants"
SET "sku" = regexp_replace(left("sku", 56), '-+$', '') || '-default'
WHERE length("sku") > 64 AND "sku" LIKE '%-default';
