use serde::Serialize;
use tauri::Manager;
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

#[derive(Serialize)]
struct CursorInfo {
    cursor_x: f64,
    cursor_y: f64,
    win_x: f64,
    win_y: f64,
    scale: f64,
}

#[tauri::command]
fn get_cursor_info(app: tauri::AppHandle) -> Result<CursorInfo, String> {
    let cursor = app.cursor_position().map_err(|e| e.to_string())?;
    let window = app.get_webview_window("secondary").ok_or("secondary window not found")?;
    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    Ok(CursorInfo {
        cursor_x: cursor.x,
        cursor_y: cursor.y,
        win_x: win_pos.x as f64,
        win_y: win_pos.y as f64,
        scale,
    })
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn set_secondary_click_through(app: tauri::AppHandle, click_through: bool) {
    if let Some(window) = app.get_webview_window("secondary") {
        let _ = window.set_ignore_cursor_events(click_through);
    }
}

#[tauri::command]
fn load_character(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let char_dir = docs.join("Amari").join("characters");
    let char_path = char_dir.join("character.vrm");

    // Ensure the directory exists so the user knows where to drop files
    if let Err(e) = std::fs::create_dir_all(&char_dir) {
        eprintln!("Failed to create character directory: {}", e);
    }

    if char_path.exists() {
        let bytes = std::fs::read(&char_path).map_err(|e| e.to_string())?;
        let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
        Ok(Some(encoded))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            hide_main_window,
            set_secondary_click_through,
            get_cursor_info,
            load_character,
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            let main_clone = main_window.clone();
            let _ = main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = main_clone.hide();
                }
            });

            let secondary = app.get_webview_window("secondary").unwrap();

            let monitor = secondary.current_monitor().unwrap().unwrap();
            let work_area = monitor.work_area();
            let window_size = secondary.outer_size().unwrap();
            let x = work_area.position.x + (work_area.size.width.saturating_sub(window_size.width)) as i32;
            let y = work_area.position.y + (work_area.size.height.saturating_sub(window_size.height)) as i32;
            secondary.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition { x, y },
            ))?;

            // Build tray icon menu
            let menu = Menu::with_items(app, &[
                &MenuItem::with_id(app, "show", "Show Chat", true, None::<&str>)?,
                &MenuItem::with_id(app, "hide", "Hide Chat", true, None::<&str>)?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?,
            ])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Amari")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => show_main_window(app.clone()),
                        "hide" => hide_main_window(app.clone()),
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            show_main_window(tray.app_handle().clone());
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
