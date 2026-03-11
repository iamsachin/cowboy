use axum::Router;

use crate::server::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
}
