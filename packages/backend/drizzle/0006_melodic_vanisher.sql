ALTER TABLE `conversations` ADD `parent_conversation_id` text;--> statement-breakpoint
ALTER TABLE `tool_calls` ADD `subagent_conversation_id` text;--> statement-breakpoint
ALTER TABLE `tool_calls` ADD `subagent_summary` text;