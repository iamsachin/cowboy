use std::path::Path;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::{mpsc, oneshot};

use crate::ingestion;
use crate::server::AppState;

/// Classifies a filesystem event path as relevant (JSONL file) or not.
pub fn classify_event(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()) == Some("jsonl")
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
    let status = state.ingestion_status.clone();
    if let Err(e) = ingestion::run_ingestion(state, status).await {
        eprintln!("Watcher-triggered ingestion error: {}", e);
    }
}

/// Starts the file watcher. Watches the given Claude Code path for JSONL file changes
/// and triggers ingestion after a debounce period.
pub fn start_watcher(
    state: AppState,
    claude_path: Option<String>,
    claude_enabled: bool,
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
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/tmp"));

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

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

    // Spawn the debounce loop
    tokio::spawn(async move {
        let mut debounce_timer: Option<tokio::time::Instant> = None;

        loop {
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
                                if classify_event(path) {
                                    debounce_timer = Some(
                                        tokio::time::Instant::now() + Duration::from_secs(1),
                                    );
                                }
                            }
                        }
                        None => break, // Channel closed
                    }
                }

                // Fire when the timer expires
                _ = async {
                    match debounce_timer {
                        Some(deadline) => tokio::time::sleep_until(deadline).await,
                        None => std::future::pending::<()>().await,
                    }
                } => {
                    let now = tokio::time::Instant::now();

                    if let Some(deadline) = debounce_timer {
                        if now >= deadline {
                            debounce_timer = None;
                            println!("Debounce fired: Claude Code ingestion triggered");
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
fn expand_tilde(path: &str, home: &Path) -> std::path::PathBuf {
    if path.starts_with("~/") || path == "~" {
        home.join(&path[2..])
    } else {
        std::path::PathBuf::from(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn classify_event_jsonl_returns_true() {
        let path = PathBuf::from("/home/user/.claude/projects/foo/conversation.jsonl");
        assert!(classify_event(&path));
    }

    #[test]
    fn classify_event_txt_returns_false() {
        let path = PathBuf::from("/home/user/notes.txt");
        assert!(!classify_event(&path));
    }

    #[test]
    fn classify_event_directory_returns_false() {
        let path = PathBuf::from("/home/user/.claude/projects/");
        assert!(!classify_event(&path));
    }
}
