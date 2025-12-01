CREATE TYPE "public"."effort_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."impact_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."recommendation_category" AS ENUM('sem', 'seo', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."recommendation_source" AS ENUM('legacy', 'interplay_report');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'researching', 'analyzing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_trigger" AS ENUM('client_creation', 'manual', 'scheduled');--> statement-breakpoint
CREATE TABLE "interplay_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"trigger_type" "report_trigger" NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"date_range_start" date NOT NULL,
	"date_range_end" date NOT NULL,
	"date_range_days" integer DEFAULT 30 NOT NULL,
	"scout_findings_encrypted" text,
	"researcher_data_encrypted" text,
	"sem_agent_output_encrypted" text,
	"seo_agent_output_encrypted" text,
	"director_output_encrypted" text,
	"executive_summary_encrypted" text,
	"unified_recommendations_encrypted" text,
	"tokens_used" integer,
	"processing_time_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recommendations" ALTER COLUMN "query_overlap_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "source" "recommendation_source" DEFAULT 'legacy';--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "interplay_report_id" uuid;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "recommendation_category" "recommendation_category";--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "impact_level" "impact_level";--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "effort_level" "effort_level";--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "action_items" text[];--> statement-breakpoint
ALTER TABLE "interplay_reports" ADD CONSTRAINT "interplay_reports_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_interplay_reports_client" ON "interplay_reports" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_interplay_reports_status" ON "interplay_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_interplay_reports_created" ON "interplay_reports" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_interplay_report_id_interplay_reports_id_fk" FOREIGN KEY ("interplay_report_id") REFERENCES "public"."interplay_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recommendations_interplay_report" ON "recommendations" USING btree ("interplay_report_id");--> statement-breakpoint
CREATE INDEX "idx_recommendations_source" ON "recommendations" USING btree ("source");