CREATE TABLE `plan_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`source_message_id` text NOT NULL,
	`title` text NOT NULL,
	`total_steps` integer NOT NULL,
	`completed_steps` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
