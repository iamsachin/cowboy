mod server;

pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // Spawn the axum HTTP server on :3001
            // Database initialization will be wired in Plan 02
            tauri::async_runtime::spawn(server::start());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
