use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use std::path::Path;

use crate::error::AppError;
use crate::server::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/memory", get(list_memory))
}

#[derive(Serialize, Debug)]
pub struct MemoryFile {
    name: String,
    content: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMemory {
    project: String,
    path: String,
    files: Vec<MemoryFile>,
}

/// GET /api/memory — every project's memory/*.md under the configured Claude projects dir.
async fn list_memory(State(state): State<AppState>) -> Result<Json<Vec<ProjectMemory>>, AppError> {
    let root: String = state
        .db
        .call(|conn| {
            Ok(conn
                .query_row("SELECT claude_code_path FROM settings WHERE id = 1", [], |r| r.get(0))
                .unwrap_or_else(|_| format!("{}/.claude/projects", std::env::var("HOME").unwrap_or_default())))
        })
        .await?;
    let projects = tokio::task::spawn_blocking(move || scan(Path::new(&root)))
        .await
        .unwrap_or_default();
    Ok(Json(projects))
}

/// Only reads `<root>/<project>/memory/*.md`; names come from read_dir, never from the request.
fn scan(root: &Path) -> Vec<ProjectMemory> {
    let Ok(entries) = std::fs::read_dir(root) else { return vec![] };
    let mut out: Vec<ProjectMemory> = entries
        .flatten()
        .filter_map(|e| {
            let dir = e.path().join("memory");
            let mut files: Vec<MemoryFile> = std::fs::read_dir(&dir)
                .ok()?
                .flatten()
                .filter(|f| f.path().extension().is_some_and(|x| x == "md") && f.path().is_file())
                .filter_map(|f| {
                    Some(MemoryFile {
                        name: f.file_name().to_string_lossy().into_owned(),
                        content: std::fs::read_to_string(f.path()).ok()?,
                    })
                })
                .collect();
            if files.is_empty() {
                return None;
            }
            // MEMORY.md (the index) first, then alphabetical
            files.sort_by(|a, b| (a.name != "MEMORY.md", &a.name).cmp(&(b.name != "MEMORY.md", &b.name)));
            Some(ProjectMemory {
                project: e.file_name().to_string_lossy().into_owned(),
                path: dir.to_string_lossy().into_owned(),
                files,
            })
        })
        .collect();
    out.sort_by(|a, b| a.project.cmp(&b.project));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_memory_dirs_index_first() {
        let tmp = tempfile::tempdir().unwrap();
        let mem = tmp.path().join("-Users-me-proj/memory");
        std::fs::create_dir_all(&mem).unwrap();
        std::fs::write(mem.join("a_note.md"), "note").unwrap();
        std::fs::write(mem.join("MEMORY.md"), "- [A](a_note.md)").unwrap();
        std::fs::write(mem.join("skip.txt"), "x").unwrap();
        std::fs::create_dir_all(tmp.path().join("no-memory-project")).unwrap();

        let out = scan(tmp.path());
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].project, "-Users-me-proj");
        let names: Vec<_> = out[0].files.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, ["MEMORY.md", "a_note.md"]);
    }

    #[test]
    fn missing_root_is_empty() {
        assert!(scan(Path::new("/definitely/not/here")).is_empty());
    }
}
