CREATE TYPE "public"."business_type" AS ENUM('ecommerce', 'lead-gen', 'saas', 'local');--> statement-breakpoint
ALTER TABLE "client_accounts" ADD COLUMN "business_type" "business_type" DEFAULT 'ecommerce' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_client_accounts_business_type" ON "client_accounts" USING btree ("business_type");