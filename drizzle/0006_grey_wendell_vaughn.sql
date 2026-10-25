ALTER TABLE "orders" ADD COLUMN "customer_name" text;

-- Backfill nama pelanggan manual POS yang sebelumnya disimpan di notes.
UPDATE "orders"
SET "customer_name" = btrim(substring("notes" from 'Pelanggan: ([^·]+)'))
WHERE "channel" = 'pos'
  AND "customer_name" IS NULL
  AND "notes" LIKE '%Pelanggan: %';