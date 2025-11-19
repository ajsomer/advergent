CREATE TABLE "ga4_landing_page_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"landing_page" text NOT NULL,
	"session_source" varchar(100),
	"session_medium" varchar(100),
	"sessions" integer DEFAULT 0,
	"engagement_rate" numeric(5, 4),
	"conversions" numeric(10, 2) DEFAULT '0',
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_session_duration" numeric(10, 2),
	"bounce_rate" numeric(5, 4),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ga4_landing_page_metrics" ADD CONSTRAINT "ga4_landing_page_metrics_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ga4_landing_page_metrics_client" ON "ga4_landing_page_metrics" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_ga4_landing_page_metrics_date" ON "ga4_landing_page_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_ga4_landing_page_metrics_page" ON "ga4_landing_page_metrics" USING btree ("landing_page");--> statement-breakpoint
CREATE INDEX "idx_ga4_landing_page_metrics_source_medium" ON "ga4_landing_page_metrics" USING btree ("session_source","session_medium");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ga4_landing_page_metrics_unique" ON "ga4_landing_page_metrics" USING btree ("client_account_id","date","landing_page","session_source","session_medium");