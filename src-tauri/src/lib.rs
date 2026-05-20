use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            let monitor = window.current_monitor().unwrap().unwrap();
            let work_area = monitor.work_area();
            let window_size = window.outer_size().unwrap();
            let x = work_area.position.x + (work_area.size.width.saturating_sub(window_size.width)) as i32;
            let y = work_area.position.y + (work_area.size.height.saturating_sub(window_size.height)) as i32;
            window.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition { x, y },
            ))?;

            window.set_ignore_cursor_events(true)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
