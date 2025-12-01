ALTER TABLE "ga4_landing_page_metrics" ALTER COLUMN "engagement_rate" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "ga4_landing_page_metrics" ALTER COLUMN "bounce_rate" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "ga4_metrics" ALTER COLUMN "engagement_rate" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "ga4_metrics" ALTER COLUMN "bounce_rate" SET DATA TYPE numeric(5, 2);