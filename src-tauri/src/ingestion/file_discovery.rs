use std::path::{Path, PathBuf};
use tokio::fs;

use super::types::DiscoveredFile;

fn default_base_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".claude")
        .join("projects")
}

/// Recursively discover all .jsonl files under a base directory.
/// Each top-level subdirectory is treated as a project directory.
/// Files under /subagents/ paths are flagged accordingly.
pub async fn discover_jsonl_files(base_dir: Option<&str>) -> Vec<DiscoveredFile> {
    let base = match base_dir {
        Some(dir) => PathBuf::from(dir),
        None => default_base_dir(),
    };

    let mut files = Vec::new();

    let mut project_dirs = match fs::read_dir(&base).await {
        Ok(rd) => rd,
        Err(_) => return files,
    };

    while let Ok(Some(entry)) = project_dirs.next_entry().await {
        let project_path = entry.path();

        let meta = match fs::metadata(&project_path).await {
            Ok(m) => m,
            Err(_) => continue,
        };

        if !meta.is_dir() {
            continue;
        }

        let project_dir = entry.file_name().to_string_lossy().to_string();

        // Recursively find all .jsonl files
        let mut stack = vec![project_path.clone()];
        while let Some(dir) = stack.pop() {
            let mut rd = match fs::read_dir(&dir).await {
                Ok(rd) => rd,
                Err(_) => continue,
            };

            while let Ok(Some(child)) = rd.next_entry().await {
                let child_path = child.path();
                let child_meta = match fs::metadata(&child_path).await {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                if child_meta.is_dir() {
                    stack.push(child_path);
                } else if child_path.extension().map_or(false, |e| e == "jsonl") {
                    // Compute relative path from project dir
                    let relative = child_path
                        .strip_prefix(&project_path)
                        .unwrap_or(&child_path)
                        .to_string_lossy()
                        .to_string();

                    let filename = child_path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    let is_subagent = relative.contains("subagents/")
                        || relative.contains("subagents\\");

                    let session_id = if is_subagent {
                        filename.strip_prefix("agent-").unwrap_or(&filename).to_string()
                    } else {
                        filename
                    };

                    let parent_session_id = if is_subagent {
                        extract_parent_session_id(&relative)
                    } else {
                        None
                    };

                    files.push(DiscoveredFile {
                        file_path: child_path.to_string_lossy().to_string(),
                        project_dir: project_dir.clone(),
                        is_subagent,
                        session_id,
                        parent_session_id,
                    });
                }
            }
        }
    }

    files
}

/// Extract parent session ID from a relative path containing "subagents/".
/// Path structure: {parentSessionId}/subagents/agent-{id}.jsonl
fn extract_parent_session_id(relative_path: &str) -> Option<String> {
    let idx = relative_path.find("subagents/")
        .or_else(|| relative_path.find("subagents\\"));

    if let Some(idx) = idx {
        if idx > 0 {
            let parent_path = &relative_path[..idx.saturating_sub(1)]; // -1 for trailing /
            let first_slash = parent_path.find('/');
            let id = if let Some(slash) = first_slash {
                &parent_path[..slash]
            } else {
                parent_path
            };
            return Some(id.to_string());
        }
    }
    None
}

/// Derive a human-readable project name from a Claude Code directory name.
///
/// Claude Code encodes absolute paths by replacing "/" with "-".
/// If dirName starts with "-" (encoded absolute path), take the last segment.
/// Otherwise return dirName as-is.
pub fn derive_project_name(dir_name: &str) -> String {
    if !dir_name.starts_with('-') {
        return dir_name.to_string();
    }

    let segments: Vec<&str> = dir_name.split('-').filter(|s| !s.is_empty()).collect();
    segments.last().unwrap_or(&dir_name).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as std_fs;
    use std::io::Write;

    #[test]
    fn derive_project_name_encoded_path() {
        assert_eq!(derive_project_name("-Users-sachin-Desktop-learn-cowboy"), "cowboy");
    }

    #[test]
    fn derive_project_name_simple() {
        assert_eq!(derive_project_name("my-project"), "my-project");
    }

    #[tokio::test]
    async fn discover_jsonl_files_with_subagent() {
        // Create temp directory structure
        let tmp = tempfile::tempdir().unwrap();
        let project_dir = tmp.path().join("test-project");
        let subagent_dir = project_dir.join("session-123").join("subagents");
        std_fs::create_dir_all(&subagent_dir).unwrap();

        // Create regular JSONL file
        let regular_file = project_dir.join("session-456.jsonl");
        let mut f = std_fs::File::create(&regular_file).unwrap();
        writeln!(f, "{{}}").unwrap();

        // Create subagent file
        let subagent_file = subagent_dir.join("agent-sub-789.jsonl");
        let mut f = std_fs::File::create(&subagent_file).unwrap();
        writeln!(f, "{{}}").unwrap();

        let results = discover_jsonl_files(Some(tmp.path().to_str().unwrap())).await;
        assert_eq!(results.len(), 2);

        let regular = results.iter().find(|r| !r.is_subagent).unwrap();
        assert_eq!(regular.session_id, "session-456");
        assert_eq!(regular.parent_session_id, None);

        let subagent = results.iter().find(|r| r.is_subagent).unwrap();
        assert_eq!(subagent.session_id, "sub-789");
        assert_eq!(subagent.parent_session_id, Some("session-123".to_string()));
    }
}
