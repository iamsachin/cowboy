use axum::{extract::State, routing::get, Json, Router};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio_rusqlite::Connection;

use crate::analytics;
use crate::conversations;
use crate::plans;

pub type AppState = Arc<Connection>;

pub async fn start(db: Connection) {
    let shared_db: AppState = Arc::new(db);

    let app = Router::new()
        .route("/api/health", get(health))
        .merge(conversations::routes())
        .merge(analytics::routes())
        .merge(plans::routes())
        .with_state(shared_db);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
        .await
        .expect("failed to bind to 127.0.0.1:3001");

    println!("Cowboy Rust server listening on http://127.0.0.1:3001");

    axum::serve(listener, app)
        .await
        .expect("axum server error");
}

async fn health(State(db): State<AppState>) -> Json<Value> {
    // Query database to confirm connectivity and schema existence
    let tables_ok = db
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
