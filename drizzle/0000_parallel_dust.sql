CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`published_at` text NOT NULL,
	`day` text NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`target_handle` text,
	`author_handle` text,
	`source` text NOT NULL,
	`raw_title` text DEFAULT '' NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activities_published_at` ON `activities` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_activities_day_type` ON `activities` (`day`,`type`);--> statement-breakpoint
CREATE TABLE `fetch_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	`item_count` integer NOT NULL,
	`succeeded` integer DEFAULT true NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_fetch_runs_status_time` ON `fetch_runs` (`succeeded`,`fetched_at`);