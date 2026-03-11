use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

pub enum AppError {
    NotFound(String),
    DbError(tokio_rusqlite::Error),
    BadRequest(String),
    SerializeError(serde_json::Error),
    NotImplemented(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::DbError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::SerializeError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            AppError::NotImplemented(msg) => (StatusCode::NOT_IMPLEMENTED, msg),
        };
        let body = axum::Json(json!({ "error": message }));
        (status, body).into_response()
    }
}

impl From<tokio_rusqlite::Error> for AppError {
    fn from(e: tokio_rusqlite::Error) -> Self {
        AppError::DbError(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::SerializeError(e)
    }
}
