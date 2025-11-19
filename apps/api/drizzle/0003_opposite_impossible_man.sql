DROP INDEX "idx_sync_jobs_client";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_jobs_active_per_client" ON "sync_jobs" USING btree ("client_account_id") WHERE status IN ('pending', 'running');--> statement-breakpoint
CREATE INDEX "idx_sync_jobs_client_all" ON "sync_jobs" USING btree ("client_account_id");