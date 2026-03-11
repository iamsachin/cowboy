use tauri::Manager;

mod analytics;
mod conversations;
mod db;
mod error;
mod extractors;
mod plans;
mod pricing;
mod server;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get the macOS app data directory: ~/Library/Application Support/cowboy/
            let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
            let db_path = app_data_dir.join("cowboy.db");

            // Initialize database synchronously in setup hook (setup is sync)
            let db = tauri::async_runtime::block_on(db::init_database(db_path))
                .expect("failed to initialize database");

            // Spawn the axum HTTP server on :3001 with database connection
            tauri::async_runtime::spawn(server::start(db));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
