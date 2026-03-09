CREATE TABLE `compaction_events` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`summary` text,
	`tokens_before` integer,
	`tokens_after` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
