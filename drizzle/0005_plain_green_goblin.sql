CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"opening_days" text DEFAULT '' NOT NULL,
	"opening_hours" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT '' NOT NULL,
	"footer_description" text DEFAULT '' NOT NULL,
	"instagram_url" text,
	"youtube_url" text,
	"facebook_url" text,
	"tiktok_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
