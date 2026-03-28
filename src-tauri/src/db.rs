use std::path::PathBuf;
use tokio_rusqlite::rusqlite;
use tokio_rusqlite::Connection;

pub async fn init_database(
    db_path: PathBuf,
) -> Result<Connection, Box<dyn std::error::Error>> {
    // Ensure parent directory exists (e.g. ~/Library/Application Support/cowboy/)
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(&db_path).await?;

    // Set pragmas: WAL mode for concurrent reads, foreign keys for referential integrity
    conn.call(|conn| {
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )?;
        Ok::<(), rusqlite::Error>(())
    })
    .await?;

    // Create all tables and indexes
    conn.call(|conn| {
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok::<(), rusqlite::Error>(())
    })
    .await?;

    // Migration: add server_port column to settings if missing (added in v3.0 Phase 40)
    conn.call(|conn| {
        let has_column: bool = conn
            .prepare("SELECT server_port FROM settings LIMIT 0")
            .is_ok();
        if !has_column {
            conn.execute_batch(
                "ALTER TABLE settings ADD COLUMN server_port INTEGER NOT NULL DEFAULT 8123;",
            )?;
        }
        Ok::<(), rusqlite::Error>(())
    })
    .await?;

    // Migration: remove cursor columns from settings (v3.1 Phase 44)
    conn.call(|conn| {
        let has_column: bool = conn
            .prepare("SELECT cursor_path FROM settings LIMIT 0")
            .is_ok();
        if has_column {
            conn.execute_batch(
                "CREATE TABLE settings_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    claude_code_path TEXT NOT NULL DEFAULT '',
                    claude_code_enabled INTEGER NOT NULL DEFAULT 1,
                    sync_enabled INTEGER NOT NULL DEFAULT 0,
                    sync_url TEXT NOT NULL DEFAULT '',
                    sync_frequency INTEGER NOT NULL DEFAULT 900,
                    sync_categories TEXT NOT NULL DEFAULT '[\"conversations\",\"messages\",\"toolCalls\",\"tokenUsage\",\"plans\"]',
                    last_sync_at TEXT,
                    last_sync_error TEXT,
                    last_sync_success INTEGER,
                    server_port INTEGER NOT NULL DEFAULT 8123
                );
                INSERT INTO settings_new (id, claude_code_path, claude_code_enabled, sync_enabled, sync_url, sync_frequency, sync_categories, last_sync_at, last_sync_error, last_sync_success, server_port)
                    SELECT id, claude_code_path, claude_code_enabled, sync_enabled, sync_url, sync_frequency, sync_categories, last_sync_at, last_sync_error, last_sync_success, server_port FROM settings;
                DROP TABLE settings;
                ALTER TABLE settings_new RENAME TO settings;",
            )?;
        }
        Ok::<(), rusqlite::Error>(())
    })
    .await?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_schema_creates_all_tables() {
        let conn = Connection::open_in_memory().await.unwrap();

        // Apply schema
        conn.call(|conn| {
            conn.execute_batch(include_str!("schema.sql"))?;
            Ok::<(), rusqlite::Error>(())
        })
        .await
        .unwrap();

        // Enable foreign keys
        conn.call(|conn| {
            conn.execute_batch("PRAGMA foreign_keys = ON;")?;
            Ok::<(), rusqlite::Error>(())
        })
        .await
        .unwrap();

        // Count application tables (exclude sqlite_* internal tables)
        let table_count: i64 = conn
            .call(|conn| {
                let count = conn.query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                    [],
                    |row| row.get(0),
                )?;
                Ok::<i64, rusqlite::Error>(count)
            })
            .await
            .unwrap();

        assert_eq!(table_count, 9, "Expected 9 application tables");

        // Verify specific table names exist
        let expected_tables = vec![
            "conversations",
            "messages",
            "tool_calls",
            "token_usage",
            "plans",
            "plan_steps",
            "compaction_events",
            "ingested_files",
            "settings",
        ];

        for table_name in expected_tables {
            let exists: bool = conn
                .call(move |conn| {
                    let count: i64 = conn.query_row(
                        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                        [table_name],
                        |row| row.get(0),
                    )?;
                    Ok::<bool, rusqlite::Error>(count > 0)
                })
                .await
                .unwrap();
            assert!(exists, "Table '{}' should exist", table_name);
        }

        // Verify indexes exist (7 performance indexes)
        let index_count: i64 = conn
            .call(|conn| {
                let count = conn.query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
                    [],
                    |row| row.get(0),
                )?;
                Ok::<i64, rusqlite::Error>(count)
            })
            .await
            .unwrap();

        assert_eq!(index_count, 7, "Expected 7 performance indexes");
    }
}
