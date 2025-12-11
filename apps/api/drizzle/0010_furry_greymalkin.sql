CREATE TYPE "public"."constraint_violation_source" AS ENUM('sem', 'seo');--> statement-breakpoint
CREATE TABLE "constraint_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"business_type" varchar(50) NOT NULL,
	"source" "constraint_violation_source" NOT NULL,
	"constraint_id" varchar(100) NOT NULL,
	"violating_content" text NOT NULL,
	"skill_version" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "interplay_reports" ADD COLUMN "skill_metadata_json" text;--> statement-breakpoint
ALTER TABLE "interplay_reports" ADD COLUMN "performance_metrics_json" text;--> statement-breakpoint
ALTER TABLE "interplay_reports" ADD COLUMN "warnings_json" text;--> statement-breakpoint
ALTER TABLE "constraint_violations" ADD CONSTRAINT "constraint_violations_report_id_interplay_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."interplay_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_violations" ADD CONSTRAINT "constraint_violations_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_report" ON "constraint_violations" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_client" ON "constraint_violations" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_business_type" ON "constraint_violations" USING btree ("business_type");--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_source" ON "constraint_violations" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_constraint_id" ON "constraint_violations" USING btree ("constraint_id");--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_created_at" ON "constraint_violations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_constraint_violations_trend" ON "constraint_violations" USING btree ("business_type","constraint_id","created_at");