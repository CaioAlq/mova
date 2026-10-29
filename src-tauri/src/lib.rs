mod commands;
mod model;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_boards,
            commands::get_board,
            commands::create_board,
            commands::rename_board,
            commands::delete_board,
            commands::save_board,
            commands::add_column,
            commands::rename_column,
            commands::delete_column,
            commands::add_card,
            commands::update_card,
            commands::archive_card,
            commands::delete_card,
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app Tauri");
}
