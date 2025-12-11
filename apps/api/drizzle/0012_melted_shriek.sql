CREATE TYPE "public"."serialization_mode" AS ENUM('full', 'compact');--> statement-breakpoint
CREATE TABLE "report_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"business_type" varchar(50) NOT NULL,
	"skill_version" varchar(20) NOT NULL,
	"using_fallback" boolean DEFAULT false NOT NULL,
	"constraint_violations" integer DEFAULT 0 NOT NULL,
	"violations_by_rule" text DEFAULT '{}' NOT NULL,
	"roas_mentions" integer DEFAULT 0 NOT NULL,
	"product_schema_recommended" boolean DEFAULT false NOT NULL,
	"invalid_metrics_detected" text[] DEFAULT '{}' NOT NULL,
	"skill_load_time_ms" integer,
	"scout_duration_ms" integer,
	"researcher_duration_ms" integer,
	"sem_duration_ms" integer,
	"seo_duration_ms" integer,
	"director_duration_ms" integer,
	"total_duration_ms" integer,
	"serialization_mode" serialization_mode,
	"truncation_applied" boolean DEFAULT false NOT NULL,
	"keywords_dropped" integer DEFAULT 0 NOT NULL,
	"pages_dropped" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "report_metrics" ADD CONSTRAINT "report_metrics_report_id_interplay_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."interplay_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_metrics" ADD CONSTRAINT "report_metrics_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_report_metrics_report_id" ON "report_metrics" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_report_metrics_client_account_id" ON "report_metrics" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_report_metrics_business_type" ON "report_metrics" USING btree ("business_type");--> statement-breakpoint
CREATE INDEX "idx_report_metrics_created_at" ON "report_metrics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_report_metrics_skill_version" ON "report_metrics" USING btree ("skill_version");