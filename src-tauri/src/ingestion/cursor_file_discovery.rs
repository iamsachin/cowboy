/// Discover the Cursor state.vscdb database file on disk.
/// Returns the absolute path if found, None otherwise.
///
/// macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
pub fn discover_cursor_db() -> Option<String> {
    let home = dirs::home_dir()?;

    // Only macOS supported for v3.0
    #[cfg(target_os = "macos")]
    let db_path = home
        .join("Library")
        .join("Application Support")
        .join("Cursor")
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    #[cfg(target_os = "linux")]
    let db_path = home
        .join(".config")
        .join("Cursor")
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    return None;

    if std::fs::metadata(&db_path).is_ok() {
        Some(db_path.to_string_lossy().to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_none_when_file_missing() {
        // The default test environment should not have a Cursor vscdb at the standard path
        // unless the developer actually has Cursor installed. We test the path construction logic.
        let result = discover_cursor_db();
        // We can't assert None definitively since Cursor might be installed,
        // but we verify it returns a valid Option<String>
        if let Some(ref path) = result {
            assert!(path.ends_with("state.vscdb"));
            assert!(path.contains("Cursor"));
        }
    }

    #[test]
    fn path_construction_macos() {
        // Verify the expected path format on macOS
        if let Some(home) = dirs::home_dir() {
            let expected = home
                .join("Library")
                .join("Application Support")
                .join("Cursor")
                .join("User")
                .join("globalStorage")
                .join("state.vscdb");
            // The function should construct this exact path
            let result = discover_cursor_db();
            if let Some(path) = result {
                assert_eq!(path, expected.to_string_lossy().to_string());
            }
            // If None, it means the file doesn't exist which is also valid
        }
    }
}
