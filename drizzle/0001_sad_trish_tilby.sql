CREATE TABLE `reset_events` (
	`id` text PRIMARY KEY NOT NULL,
	`announced_at` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`scope` text NOT NULL,
	`evidence_text` text NOT NULL,
	`evidence_url` text NOT NULL,
	`source` text NOT NULL,
	`discovered_at` text NOT NULL,
	`activity_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_reset_events_announced_at` ON `reset_events` (`announced_at`);