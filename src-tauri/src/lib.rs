use tauri::{
    image::Image,
    menu::{MenuBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};

use std::sync::atomic::{AtomicBool, Ordering};

static TRAY_PANEL_PINNED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_tray_pinned(pinned: bool) {
    TRAY_PANEL_PINNED.store(pinned, Ordering::Relaxed);
}

mod analytics;
mod conversations;
mod db;
mod error;
mod extractors;
mod ingestion;
mod plans;
mod pricing;
mod server;
mod settings;
mod watcher;
mod websocket;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Get the macOS app data directory: ~/Library/Application Support/cowboy/
            let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
            let db_path = app_data_dir.join("cowboy.db");

            // Initialize database synchronously in setup hook (setup is sync)
            let db = tauri::async_runtime::block_on(db::init_database(db_path))
                .expect("failed to initialize database");

            // -- Native menu bar --
            let app_menu = SubmenuBuilder::new(app, "Cowboy")
                .about(None::<tauri::menu::AboutMetadata>)
                .separator()
                .quit()
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu])
                .build()?;
            app.set_menu(menu)?;

            // -- System tray (no native menu — panel acts as the dropdown) --
            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;
            TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, position, .. } = &event {
                        if *button == tauri::tray::MouseButton::Left
                            && *button_state == tauri::tray::MouseButtonState::Up
                        {
                            let app = tray.app_handle();
                            if let Some(panel) = app.get_webview_window("tray-panel") {
                                if panel.is_visible().unwrap_or(false) {
                                    let _ = panel.hide();
                                } else {
                                    // Position panel centered below the tray icon
                                    // position is in physical pixels; panel_width is logical (420)
                                    let scale = panel.current_monitor()
                                        .ok().flatten()
                                        .map(|m| m.scale_factor())
                                        .unwrap_or(2.0);
                                    let physical_panel_width = 420.0 * scale;
                                    let x = position.x - (physical_panel_width / 2.0);
                                    let y = position.y + 4.0;
                                    let _ = panel.set_position(tauri::Position::Physical(
                                        PhysicalPosition::new(x as i32, y as i32),
                                    ));
                                    let _ = panel.show();
                                    let _ = panel.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            // Spawn the axum HTTP server on configurable port (default :8123) with database connection
            tauri::async_runtime::spawn(server::start(db));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![quit_app, set_tray_pinned])
        // Window events: close-to-tray + tray panel auto-hide on blur
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                }
                WindowEvent::Focused(false) => {
                    if window.label() == "tray-panel"
                        && !TRAY_PANEL_PINNED.load(Ordering::Relaxed)
                    {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
