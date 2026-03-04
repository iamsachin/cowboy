CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`claude_code_path` text DEFAULT '' NOT NULL,
	`claude_code_enabled` integer DEFAULT true NOT NULL,
	`cursor_path` text DEFAULT '' NOT NULL,
	`cursor_enabled` integer DEFAULT true NOT NULL,
	`sync_enabled` integer DEFAULT false NOT NULL,
	`sync_url` text DEFAULT '' NOT NULL,
	`sync_frequency` integer DEFAULT 900 NOT NULL,
	`sync_categories` text DEFAULT '["conversations","messages","toolCalls","tokenUsage","plans"]' NOT NULL,
	`last_sync_at` text,
	`last_sync_error` text,
	`last_sync_success` integer,
	`sync_cursor` text
);
