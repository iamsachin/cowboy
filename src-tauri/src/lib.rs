use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, Menu, SubmenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
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

            // -- System tray --
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;
            TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, .. } = &event {
                        if *button == tauri::tray::MouseButton::Left
                            && *button_state == tauri::tray::MouseButtonState::Up
                        {
                            let app = tray.app_handle();
                            if let Some(panel) = app.get_webview_window("tray-panel") {
                                if panel.is_visible().unwrap_or(false) {
                                    let _ = panel.hide();
                                } else {
                                    // Position near top-right of screen (macOS menubar area)
                                    if let Ok(Some(monitor)) = panel.current_monitor() {
                                        let screen = monitor.size();
                                        let scale = monitor.scale_factor();
                                        let x = (screen.width as f64 / scale) as i32 - 380 - 16;
                                        let y = 32;
                                        let _ = panel.set_position(tauri::Position::Physical(
                                            PhysicalPosition::new(
                                                (x as f64 * scale) as i32,
                                                (y as f64 * scale) as i32,
                                            ),
                                        ));
                                    }
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
        .invoke_handler(tauri::generate_handler![quit_app])
        // Close-to-tray: red X hides window instead of quitting
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
