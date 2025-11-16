DROP INDEX "idx_search_console_queries_unique";--> statement-breakpoint
ALTER TABLE "search_console_queries" ADD COLUMN "page" text;--> statement-breakpoint
ALTER TABLE "search_console_queries" ADD COLUMN "search_appearance" varchar(50);--> statement-breakpoint
ALTER TABLE "search_console_queries" ADD COLUMN "search_type" varchar(20);--> statement-breakpoint
CREATE INDEX "idx_search_console_queries_page" ON "search_console_queries" USING btree ("page");--> statement-breakpoint
CREATE INDEX "idx_search_console_queries_device" ON "search_console_queries" USING btree ("device");--> statement-breakpoint
CREATE INDEX "idx_search_console_queries_search_type" ON "search_console_queries" USING btree ("search_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_search_console_queries_unique" ON "search_console_queries" USING btree ("client_account_id","search_query_id","date","page","device","country","search_appearance","search_type");