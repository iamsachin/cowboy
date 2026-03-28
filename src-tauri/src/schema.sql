-- Cowboy v3.0 SQLite schema
-- Hand-written from Drizzle migrations 0000-0006
-- Must match packages/backend/src/db/schema.ts exactly

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY NOT NULL,
    agent TEXT NOT NULL,
    project TEXT,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    parent_conversation_id TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL,
    content TEXT,
    thinking TEXT,
    created_at TEXT NOT NULL,
    model TEXT
);

CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL REFERENCES messages(id),
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    name TEXT NOT NULL,
    input TEXT,
    output TEXT,
    status TEXT,
    duration INTEGER,
    created_at TEXT NOT NULL,
    subagent_conversation_id TEXT,
    subagent_summary TEXT
);

CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    message_id TEXT REFERENCES messages(id),
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    source_message_id TEXT NOT NULL REFERENCES messages(id),
    title TEXT NOT NULL,
    total_steps INTEGER NOT NULL,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unknown',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_steps (
    id TEXT PRIMARY KEY NOT NULL,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    step_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compaction_events (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    timestamp TEXT NOT NULL,
    summary TEXT,
    tokens_before INTEGER,
    tokens_after INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingested_files (
    file_path TEXT PRIMARY KEY NOT NULL,
    mtime_ms INTEGER NOT NULL,
    size INTEGER NOT NULL,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    claude_code_path TEXT NOT NULL DEFAULT '',
    claude_code_enabled INTEGER NOT NULL DEFAULT 1,
    sync_enabled INTEGER NOT NULL DEFAULT 0,
    sync_url TEXT NOT NULL DEFAULT '',
    sync_frequency INTEGER NOT NULL DEFAULT 900,
    sync_categories TEXT NOT NULL DEFAULT '["conversations","messages","toolCalls","tokenUsage","plans"]',
    last_sync_at TEXT,
    last_sync_error TEXT,
    last_sync_success INTEGER,
    server_port INTEGER NOT NULL DEFAULT 8123
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_role ON messages(conversation_id, role);
CREATE INDEX IF NOT EXISTS idx_token_usage_conversation_id ON token_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_conv_model ON token_usage(conversation_id, model);
CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation_id ON tool_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_compaction_events_conversation_id ON compaction_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON conversations(parent_conversation_id);
