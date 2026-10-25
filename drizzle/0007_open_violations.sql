ALTER TABLE "orders" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "damage_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_refunded" integer DEFAULT 0 NOT NULL;