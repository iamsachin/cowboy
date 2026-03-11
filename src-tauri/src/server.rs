use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

pub async fn start() {
    let app = Router::new().route("/api/health", get(health));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
        .await
        .expect("failed to bind to 127.0.0.1:3001");

    println!("Cowboy Rust server listening on http://127.0.0.1:3001");

    axum::serve(listener, app)
        .await
        .expect("axum server error");
}

async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "server": "cowboy-rust",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
