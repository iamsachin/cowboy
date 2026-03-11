use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::server::AppState;

static SEQ: AtomicU64 = AtomicU64::new(0);

/// Returns the next monotonic sequence number (1-based).
pub fn next_seq() -> u64 {
    SEQ.fetch_add(1, Ordering::Relaxed) + 1
}

/// Broadcasts a typed event to all connected WebSocket clients via the broadcast channel.
/// Automatically adds `seq` and `timestamp` fields.
pub fn broadcast_event(state: &AppState, event_type: &str, extra: Option<serde_json::Value>) {
    let mut event = serde_json::json!({
        "type": event_type,
        "seq": next_seq(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    if let Some(extra_fields) = extra {
        if let (Some(base), Some(ext)) = (event.as_object_mut(), extra_fields.as_object()) {
            for (k, v) in ext {
                base.insert(k.clone(), v.clone());
            }
        }
    }

    let _ = state.tx.send(event.to_string());
}

/// WebSocket upgrade handler for GET /api/ws
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Send initial connected handshake (matches Node.js protocol)
    let connected_msg = serde_json::json!({"type": "connected"}).to_string();
    if sender.send(Message::Text(connected_msg.into())).await.is_err() {
        return;
    }

    // Subscribe to broadcast channel
    let mut rx = state.tx.subscribe();

    // Forward broadcast messages to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Drain incoming messages (we don't process client->server messages)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
        }
    });

    // When either task finishes, abort the other
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
}
