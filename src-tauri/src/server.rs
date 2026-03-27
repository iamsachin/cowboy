use axum::{extract::State, routing::{any, get}, Json, Router};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_rusqlite::Connection;

use crate::analytics;
use crate::conversations;
use crate::ingestion;
use crate::plans;
use crate::settings;
use crate::watcher::{self, FileWatcherHandle};
use crate::websocket;

pub struct AppStateInner {
    pub db: Connection,
    pub tx: broadcast::Sender<String>,
    pub watcher: tokio::sync::Mutex<Option<FileWatcherHandle>>,
}

pub type AppState = Arc<AppStateInner>;

pub async fn start(db: Connection) {
    let (tx, _rx) = broadcast::channel::<String>(256);

    let shared_state: AppState = Arc::new(AppStateInner {
        db,
        tx,
        watcher: tokio::sync::Mutex::new(None),
    });

    let app = Router::new()
        .route("/api/health", get(health))
        .merge(conversations::routes())
        .merge(analytics::routes())
        .merge(plans::routes())
        .merge(settings::routes())
        .merge(ingestion::routes())
        .route("/api/ws", any(websocket::ws_handler))
        .with_state(shared_state.clone());

    // Read port from settings table (default 8123)
    let port: i64 = shared_state
        .db
        .call(|conn| {
            let port = conn
                .query_row("SELECT server_port FROM settings WHERE id = 1", [], |r| {
                    r.get::<_, i64>(0)
                })
                .unwrap_or(8123);
            Ok::<i64, tokio_rusqlite::Error>(port)
        })
        .await
        .unwrap_or(8123);

    let bind_addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .unwrap_or_else(|_| panic!("failed to bind to {}", bind_addr));

    println!("Cowboy Rust server listening on http://{}", bind_addr);

    // Initialize file watcher with settings from DB
    {
        let state_clone = shared_state.clone();
        let watcher_settings = shared_state
            .db
            .call(|conn| {
                let result = conn.query_row(
                    "SELECT claude_code_path, claude_code_enabled FROM settings WHERE id = 1",
                    [],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, i32>(1)? != 0,
                        ))
                    },
                );
                match result {
                    Ok(s) => Ok::<_, tokio_rusqlite::Error>(Some(s)),
                    Err(_) => Ok(None),
                }
            })
            .await
            .ok()
            .flatten();

        if let Some((claude_path, claude_enabled)) = watcher_settings {
            match watcher::start_watcher(
                state_clone.clone(),
                Some(claude_path),
                claude_enabled,
            ) {
                Ok(handle) => {
                    let mut w = state_clone.watcher.lock().await;
                    *w = Some(handle);
                    println!("File watcher initialized");
                }
                Err(e) => eprintln!("Failed to start file watcher: {}", e),
            }
        } else {
            // No settings row yet; start watcher with defaults
            match watcher::start_watcher(state_clone.clone(), None, true) {
                Ok(handle) => {
                    let mut w = state_clone.watcher.lock().await;
                    *w = Some(handle);
                    println!("File watcher initialized with defaults");
                }
                Err(e) => eprintln!("Failed to start file watcher: {}", e),
            }
        }
    }

    // Also run initial ingestion
    ingestion::spawn_auto_ingest(shared_state);

    axum::serve(listener, app)
        .await
        .expect("axum server error");
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    // Query database to confirm connectivity and schema existence
    let tables_ok = state
        .db
        .call(|conn| {
            let count: i64 = conn.query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                [],
                |row| row.get(0),
            )?;
            Ok::<bool, tokio_rusqlite::rusqlite::Error>(count == 9)
        })
        .await
        .unwrap_or(false);

    Json(json!({
        "status": "ok",
        "server": "cowboy-rust",
        "version": env!("CARGO_PKG_VERSION"),
        "tables_ok": tables_ok
    }))
}
