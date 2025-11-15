ALTER TABLE "user_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "user_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "clerk_org_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_user_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_agencies_clerk_org_id" ON "agencies" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "idx_users_clerk_user_id" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_algorithm";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_cost";--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_clerk_org_id_unique" UNIQUE("clerk_org_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id");