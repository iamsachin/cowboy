use std::path::{Path, PathBuf};
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::{mpsc, oneshot};

use crate::ingestion;
use crate::server::AppState;

/// Represents which coding agent a file change corresponds to.
#[derive(Debug, Clone, PartialEq)]
pub enum AgentKind {
    ClaudeCode,
    Cursor,
}

impl AgentKind {
    /// Returns a stable string key used for debounce grouping.
    pub fn debounce_key(&self) -> &'static str {
        match self {
            AgentKind::ClaudeCode => "claude-code",
            AgentKind::Cursor => "cursor",
        }
    }

    /// Returns the debounce duration for this agent kind.
    pub fn debounce_duration(&self) -> Duration {
        match self {
            AgentKind::ClaudeCode => Duration::from_secs(1),
            AgentKind::Cursor => Duration::from_secs(3),
        }
    }
}

/// Classifies a filesystem event path into an AgentKind, or None if irrelevant.
pub fn classify_event(path: &Path) -> Option<AgentKind> {
    let file_name = path.file_name()?.to_str()?;

    if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
        return Some(AgentKind::ClaudeCode);
    }

    if file_name == "state.vscdb" {
        return Some(AgentKind::Cursor);
    }

    None
}

/// Handle for a running file watcher. Dropping it shuts down the watcher.
pub struct FileWatcherHandle {
    _watcher: RecommendedWatcher,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl Drop for FileWatcherHandle {
    fn drop(&mut self) {
        // Sending on shutdown_tx signals the debounce loop to exit
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

/// Triggers an ingestion run, logging errors without panicking.
async fn trigger_ingestion(state: &AppState) {
    let status = ingestion::new_shared_status();
    if let Err(e) = ingestion::run_ingestion(state, status).await {
        eprintln!("Watcher-triggered ingestion error: {}", e);
    }
}

/// Starts the file watcher. Watches the given paths (or defaults) for relevant file changes
/// and triggers ingestion after a debounce period.
pub fn start_watcher(
    state: AppState,
    claude_path: Option<String>,
    cursor_path: Option<String>,
    claude_enabled: bool,
    cursor_enabled: bool,
) -> Result<FileWatcherHandle, notify::Error> {
    let (event_tx, mut event_rx) = mpsc::channel::<notify::Event>(100);

    // Create the native watcher with an mpsc bridge to tokio
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            // Best-effort send; if channel is full, we'll catch the next event
            let _ = event_tx.blocking_send(event);
        }
    })?;

    // Determine default paths
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));

    // Watch Claude Code path
    if claude_enabled {
        let claude_dir = claude_path
            .as_ref()
            .map(|p| expand_tilde(p, &home))
            .unwrap_or_else(|| home.join(".claude/projects"));

        if claude_dir.is_dir() {
            if let Err(e) = watcher.watch(&claude_dir, RecursiveMode::Recursive) {
                eprintln!("Failed to watch Claude Code path {:?}: {}", claude_dir, e);
            } else {
                println!("Watching Claude Code: {:?}", claude_dir);
            }
        } else {
            eprintln!("Claude Code path not found: {:?}", claude_dir);
        }
    }

    // Watch Cursor path
    if cursor_enabled {
        let cursor_dir = cursor_path
            .as_ref()
            .map(|p| expand_tilde(p, &home))
            .unwrap_or_else(|| home.join("Library/Application Support/Cursor/User/globalStorage"));

        if cursor_dir.is_dir() {
            if let Err(e) = watcher.watch(&cursor_dir, RecursiveMode::NonRecursive) {
                eprintln!("Failed to watch Cursor path {:?}: {}", cursor_dir, e);
            } else {
                println!("Watching Cursor: {:?}", cursor_dir);
            }
        } else {
            eprintln!("Cursor path not found: {:?}", cursor_dir);
        }
    }

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

    // Spawn the debounce loop
    tokio::spawn(async move {
        let mut claude_timer: Option<tokio::time::Instant> = None;
        let mut cursor_timer: Option<tokio::time::Instant> = None;

        loop {
            // Calculate the next deadline from active timers
            let next_deadline = match (claude_timer, cursor_timer) {
                (Some(c), Some(cu)) => Some(c.min(cu)),
                (Some(c), None) => Some(c),
                (None, Some(cu)) => Some(cu),
                (None, None) => None,
            };

            tokio::select! {
                // Check for shutdown signal
                _ = &mut shutdown_rx => {
                    println!("File watcher shutting down");
                    break;
                }

                // Process incoming filesystem events
                event = event_rx.recv() => {
                    match event {
                        Some(ev) => {
                            for path in &ev.paths {
                                if let Some(kind) = classify_event(path) {
                                    let deadline = tokio::time::Instant::now() + kind.debounce_duration();
                                    match kind {
                                        AgentKind::ClaudeCode => claude_timer = Some(deadline),
                                        AgentKind::Cursor => cursor_timer = Some(deadline),
                                    }
                                }
                            }
                        }
                        None => break, // Channel closed
                    }
                }

                // Fire when a timer expires
                _ = async {
                    match next_deadline {
                        Some(deadline) => tokio::time::sleep_until(deadline).await,
                        None => std::future::pending::<()>().await,
                    }
                } => {
                    let now = tokio::time::Instant::now();

                    if let Some(deadline) = claude_timer {
                        if now >= deadline {
                            claude_timer = None;
                            println!("Debounce fired: Claude Code ingestion triggered");
                            trigger_ingestion(&state).await;
                        }
                    }

                    if let Some(deadline) = cursor_timer {
                        if now >= deadline {
                            cursor_timer = None;
                            println!("Debounce fired: Cursor ingestion triggered");
                            trigger_ingestion(&state).await;
                        }
                    }
                }
            }
        }
    });

    Ok(FileWatcherHandle {
        _watcher: watcher,
        shutdown_tx: Some(shutdown_tx),
    })
}

/// Expands a tilde prefix in a path string.
fn expand_tilde(path: &str, home: &Path) -> PathBuf {
    if path.starts_with("~/") || path == "~" {
        home.join(&path[2..])
    } else {
        PathBuf::from(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn classify_event_jsonl_returns_claude_code() {
        let path = PathBuf::from("/home/user/.claude/projects/foo/conversation.jsonl");
        assert_eq!(classify_event(&path), Some(AgentKind::ClaudeCode));
    }

    #[test]
    fn classify_event_vscdb_returns_cursor() {
        let path = PathBuf::from("/home/user/Library/Application Support/Cursor/User/globalStorage/state.vscdb");
        assert_eq!(classify_event(&path), Some(AgentKind::Cursor));
    }

    #[test]
    fn classify_event_txt_returns_none() {
        let path = PathBuf::from("/home/user/notes.txt");
        assert_eq!(classify_event(&path), None);
    }

    #[test]
    fn classify_event_directory_returns_none() {
        let path = PathBuf::from("/home/user/.claude/projects/");
        assert_eq!(classify_event(&path), None);
    }

    #[test]
    fn debounce_key_values() {
        assert_eq!(AgentKind::ClaudeCode.debounce_key(), "claude-code");
        assert_eq!(AgentKind::Cursor.debounce_key(), "cursor");
    }

    #[test]
    fn debounce_duration_values() {
        assert_eq!(AgentKind::ClaudeCode.debounce_duration(), Duration::from_secs(1));
        assert_eq!(AgentKind::Cursor.debounce_duration(), Duration::from_secs(3));
    }
}
