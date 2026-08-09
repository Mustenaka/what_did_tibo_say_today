CREATE TABLE `analysis_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`latest_reset_id` text,
	`analysis_window_start` text,
	`latest_activity_id` text,
	`activity_ids_json` text NOT NULL,
	`context_json` text NOT NULL,
	`result_json` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`outcome_reset_id` text,
	`evaluated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_snapshots_generated_at` ON `analysis_snapshots` (`generated_at`);--> statement-breakpoint
CREATE INDEX `idx_analysis_snapshots_outcome_reset_id` ON `analysis_snapshots` (`outcome_reset_id`);--> statement-breakpoint
ALTER TABLE `reset_events` ADD `effective_at` text;--> statement-breakpoint
ALTER TABLE `reset_events` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `reset_events` ADD `confidence` text DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE `reset_events` ADD `extraction_version` text DEFAULT 'legacy-v1' NOT NULL;--> statement-breakpoint
UPDATE `reset_events` SET `effective_at` = `announced_at` WHERE `effective_at` IS NULL;--> statement-breakpoint
UPDATE `reset_events` SET `completed_at` = `announced_at` WHERE `completed_at` IS NULL AND `status` = 'completed';--> statement-breakpoint
PRAGMA optimize;
