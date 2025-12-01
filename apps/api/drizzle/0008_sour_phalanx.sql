CREATE TYPE "public"."data_source" AS ENUM('api', 'csv_upload');--> statement-breakpoint
CREATE TABLE "auction_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"campaign_name" varchar(255),
	"ad_group_name" varchar(255),
	"keyword" varchar(500),
	"keyword_match_type" varchar(20),
	"competitor_domain" varchar(255) NOT NULL,
	"is_own_account" boolean DEFAULT false,
	"date_range_start" date NOT NULL,
	"date_range_end" date NOT NULL,
	"impression_share" numeric(5, 2),
	"lost_impression_share_rank" numeric(5, 2),
	"lost_impression_share_budget" numeric(5, 2),
	"outranking_share" numeric(5, 2),
	"overlap_rate" numeric(5, 2),
	"top_of_page_rate" numeric(5, 2),
	"position_above_rate" numeric(5, 2),
	"abs_top_of_page_rate" numeric(5, 2),
	"impression_share_below_threshold" boolean DEFAULT false,
	"data_source" "data_source" DEFAULT 'csv_upload',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"campaign_name" varchar(255) NOT NULL,
	"campaign_group_name" varchar(255),
	"campaign_status" varchar(20),
	"date_range_start" date NOT NULL,
	"date_range_end" date NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"cost_micros" bigint DEFAULT 0,
	"ctr" numeric(5, 4),
	"data_source" "data_source" DEFAULT 'csv_upload',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "csv_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"upload_session_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"row_count" integer DEFAULT 0,
	"date_range_start" date,
	"date_range_end" date,
	"status" varchar(20) DEFAULT 'processing',
	"error_message" text,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_account_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"cost_micros" bigint DEFAULT 0,
	"avg_cpc_micros" bigint,
	"data_source" "data_source" DEFAULT 'csv_upload',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"device" varchar(50) NOT NULL,
	"date_range_start" date NOT NULL,
	"date_range_end" date NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"cost_micros" bigint DEFAULT 0,
	"data_source" "data_source" DEFAULT 'csv_upload',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "data_source" "data_source" DEFAULT 'api';--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "match_type" varchar(20);--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "criterion_status" varchar(20);--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "campaign_status" varchar(20);--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "ad_group_status" varchar(20);--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "date_range_start" date;--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD COLUMN "date_range_end" date;--> statement-breakpoint
ALTER TABLE "auction_insights" ADD CONSTRAINT "auction_insights_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_uploads" ADD CONSTRAINT "csv_uploads_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_uploads" ADD CONSTRAINT "csv_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_account_metrics" ADD CONSTRAINT "daily_account_metrics_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auction_insights_client" ON "auction_insights" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_auction_insights_competitor" ON "auction_insights" USING btree ("competitor_domain");--> statement-breakpoint
CREATE INDEX "idx_auction_insights_date_range" ON "auction_insights" USING btree ("date_range_start","date_range_end");--> statement-breakpoint
CREATE INDEX "idx_auction_insights_keyword" ON "auction_insights" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "idx_auction_insights_campaign" ON "auction_insights" USING btree ("campaign_name");--> statement-breakpoint
CREATE INDEX "idx_campaign_metrics_client" ON "campaign_metrics" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_metrics_campaign" ON "campaign_metrics" USING btree ("campaign_name");--> statement-breakpoint
CREATE INDEX "idx_csv_uploads_client" ON "csv_uploads" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_csv_uploads_session" ON "csv_uploads" USING btree ("upload_session_id");--> statement-breakpoint
CREATE INDEX "idx_csv_uploads_type" ON "csv_uploads" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "idx_csv_uploads_status" ON "csv_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_daily_account_metrics_client" ON "daily_account_metrics" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_daily_account_metrics_date" ON "daily_account_metrics" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_account_metrics_unique" ON "daily_account_metrics" USING btree ("client_account_id","date");--> statement-breakpoint
CREATE INDEX "idx_device_metrics_client" ON "device_metrics" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_device_metrics_device" ON "device_metrics" USING btree ("device");--> statement-breakpoint
CREATE INDEX "idx_google_ads_queries_data_source" ON "google_ads_queries" USING btree ("data_source");