use std::path::Path;
use std::time::Duration;

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
    // Must be a file (has extension or known filename), not a directory path ending in /
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
    // Will be filled in Task 1
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
        // A path without a file extension that isn't state.vscdb
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
