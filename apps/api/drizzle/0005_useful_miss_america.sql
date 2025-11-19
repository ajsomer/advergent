CREATE TABLE "ga4_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sessions" integer DEFAULT 0,
	"engagement_rate" numeric(5, 4),
	"views_per_session" numeric(5, 2),
	"conversions" numeric(10, 2) DEFAULT '0',
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_session_duration" numeric(10, 2),
	"bounce_rate" numeric(5, 4),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "client_accounts" ADD COLUMN "ga4_property_id" varchar(50);--> statement-breakpoint
ALTER TABLE "client_accounts" ADD COLUMN "ga4_refresh_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "client_accounts" ADD COLUMN "ga4_refresh_token_key_version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "ga4_metrics" ADD CONSTRAINT "ga4_metrics_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ga4_metrics_client" ON "ga4_metrics" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_ga4_metrics_date" ON "ga4_metrics" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ga4_metrics_unique" ON "ga4_metrics" USING btree ("client_account_id","date");