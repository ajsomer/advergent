CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'analyzing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."billing_tier" AS ENUM('starter', 'growth', 'agency');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."detected_via" AS ENUM('auction_insights');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('google_ads_sync', 'search_console_sync', 'full_sync');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'approved', 'rejected', 'applied');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('reduce', 'pause', 'increase', 'maintain');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."sync_frequency" AS ENUM('daily');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"billing_tier" "billing_tier" NOT NULL,
	"client_limit" integer NOT NULL,
	"stripe_customer_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_overlap_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending',
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"ai_tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"google_ads_customer_id" varchar(20),
	"google_ads_refresh_token_encrypted" text,
	"google_ads_refresh_token_key_version" integer DEFAULT 1,
	"search_console_site_url" varchar(500),
	"search_console_refresh_token_encrypted" text,
	"search_console_refresh_token_key_version" integer DEFAULT 1,
	"sync_frequency" varchar(20) DEFAULT 'daily',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impression_share" numeric(5, 2),
	"overlap_rate" numeric(5, 2),
	"position_above_rate" numeric(5, 2),
	"top_of_page_rate" numeric(5, 2),
	"outranking_share" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"competitor_domain" varchar(255) NOT NULL,
	"detected_via" varchar(50) DEFAULT 'auction_insights',
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_ads_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"search_query_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"cost_micros" bigint DEFAULT 0,
	"conversions" numeric(10, 2) DEFAULT '0',
	"ctr" numeric(5, 4),
	"avg_cpc_micros" bigint,
	"campaign_id" varchar(50),
	"campaign_name" varchar(255),
	"ad_group_id" varchar(50),
	"ad_group_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "query_overlaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"search_query_id" uuid NOT NULL,
	"overlap_detected_at" timestamp with time zone DEFAULT now(),
	"last_analyzed_at" timestamp with time zone,
	"analysis_status" "analysis_status" DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"query_overlap_id" uuid NOT NULL,
	"recommendation_type" "recommendation_type" NOT NULL,
	"confidence_level" "confidence_level" NOT NULL,
	"current_monthly_spend" numeric(12, 2),
	"recommended_monthly_spend" numeric(12, 2),
	"estimated_monthly_savings" numeric(12, 2),
	"reasoning" text NOT NULL,
	"key_factors" text[],
	"encrypted_snapshot" text,
	"encrypted_snapshot_key_version" integer DEFAULT 1,
	"status" "recommendation_status" DEFAULT 'pending',
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_console_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"search_query_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"ctr" numeric(5, 4),
	"position" numeric(5, 2),
	"device" varchar(20),
	"country" varchar(2),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"query_text" text NOT NULL,
	"query_normalized" text NOT NULL,
	"query_hash" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'pending',
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"records_processed" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"password_algorithm" varchar(20) DEFAULT 'bcrypt' NOT NULL,
	"password_cost" integer DEFAULT 12 NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_query_overlap_id_query_overlaps_id_fk" FOREIGN KEY ("query_overlap_id") REFERENCES "public"."query_overlaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_metrics" ADD CONSTRAINT "competitor_metrics_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD CONSTRAINT "google_ads_queries_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_queries" ADD CONSTRAINT "google_ads_queries_search_query_id_search_queries_id_fk" FOREIGN KEY ("search_query_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_overlaps" ADD CONSTRAINT "query_overlaps_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_overlaps" ADD CONSTRAINT "query_overlaps_search_query_id_search_queries_id_fk" FOREIGN KEY ("search_query_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_query_overlap_id_query_overlaps_id_fk" FOREIGN KEY ("query_overlap_id") REFERENCES "public"."query_overlaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_console_queries" ADD CONSTRAINT "search_console_queries_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_console_queries" ADD CONSTRAINT "search_console_queries_search_query_id_search_queries_id_fk" FOREIGN KEY ("search_query_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agencies_billing_tier" ON "agencies" USING btree ("billing_tier");--> statement-breakpoint
CREATE INDEX "idx_agencies_stripe_customer_id" ON "agencies" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_overlap" ON "analysis_jobs" USING btree ("query_overlap_id");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_status" ON "analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_created_at" ON "analysis_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_client_accounts_agency_id" ON "client_accounts" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "idx_client_accounts_is_active" ON "client_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_client_accounts_google_ads_customer_id" ON "client_accounts" USING btree ("google_ads_customer_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_metrics_competitor" ON "competitor_metrics" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_metrics_date" ON "competitor_metrics" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_competitor_metrics_unique" ON "competitor_metrics" USING btree ("competitor_id","date");--> statement-breakpoint
CREATE INDEX "idx_competitors_client" ON "competitors" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_competitors_domain" ON "competitors" USING btree ("competitor_domain");--> statement-breakpoint
CREATE INDEX "idx_competitors_is_active" ON "competitors" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_competitors_unique" ON "competitors" USING btree ("client_account_id","competitor_domain");--> statement-breakpoint
CREATE INDEX "idx_google_ads_queries_client" ON "google_ads_queries" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_google_ads_queries_search_query" ON "google_ads_queries" USING btree ("search_query_id");--> statement-breakpoint
CREATE INDEX "idx_google_ads_queries_date" ON "google_ads_queries" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_google_ads_queries_unique" ON "google_ads_queries" USING btree ("client_account_id","search_query_id","date");--> statement-breakpoint
CREATE INDEX "idx_query_overlaps_client" ON "query_overlaps" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_query_overlaps_search_query" ON "query_overlaps" USING btree ("search_query_id");--> statement-breakpoint
CREATE INDEX "idx_query_overlaps_status" ON "query_overlaps" USING btree ("analysis_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_query_overlaps_unique" ON "query_overlaps" USING btree ("client_account_id","search_query_id");--> statement-breakpoint
CREATE INDEX "idx_recommendations_client" ON "recommendations" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_recommendations_overlap" ON "recommendations" USING btree ("query_overlap_id");--> statement-breakpoint
CREATE INDEX "idx_recommendations_status" ON "recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recommendations_type" ON "recommendations" USING btree ("recommendation_type");--> statement-breakpoint
CREATE INDEX "idx_recommendations_confidence" ON "recommendations" USING btree ("confidence_level");--> statement-breakpoint
CREATE INDEX "idx_search_console_queries_client" ON "search_console_queries" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_search_console_queries_search_query" ON "search_console_queries" USING btree ("search_query_id");--> statement-breakpoint
CREATE INDEX "idx_search_console_queries_date" ON "search_console_queries" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_search_console_queries_unique" ON "search_console_queries" USING btree ("client_account_id","search_query_id","date","device","country");--> statement-breakpoint
CREATE INDEX "idx_search_queries_client_account_id" ON "search_queries" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_search_queries_hash" ON "search_queries" USING btree ("query_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_search_queries_unique" ON "search_queries" USING btree ("client_account_id","query_hash");--> statement-breakpoint
CREATE INDEX "idx_sync_jobs_client" ON "sync_jobs" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_sync_jobs_status" ON "sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sync_jobs_created_at" ON "sync_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_access_token" ON "user_sessions" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_refresh_token" ON "user_sessions" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires" ON "user_sessions" USING btree ("access_token_expires_at","refresh_token_expires_at");--> statement-breakpoint
CREATE INDEX "idx_users_agency_id" ON "users" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");