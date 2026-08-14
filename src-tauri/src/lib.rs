pub mod commands;
pub mod storage;

use commands::*;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize StorageService once and manage as state
            let storage = storage::StorageService::new()
                .expect("Failed to initialize storage");
            app.manage(Mutex::new(storage));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_classic_theorems,
            generate_theorem,
            generate_theorem_with_value,
            generate_theorem_by_tier,
            create_proof,
            apply_rule,
            open_subproof,
            close_subproof,
            undo_line,
            get_hint,
            save_proof,
            load_proofs,
            get_statistics,
            save_custom_theorem,
            load_custom_theorems,
            parse_formula,
            delete_line,
            check_proof_complete,
            // Portfolio commands
            save_to_portfolio,
            load_portfolio,
            get_portfolio_entry,
            delete_portfolio_entry,
            update_portfolio_notes,
            rename_portfolio_entry,
            // Global notes commands
            load_global_notes,
            save_global_notes,
            // Utility commands
            get_subproof_auto_close,
            // Scratchpad commands
            get_all_transformations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
