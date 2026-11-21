use tauri::{self, State};
use std::sync::Mutex;
use logic_core::models::{
    Formula, Proof, Theorem, UserStatistics,
    set_theory::TrackChapter,
    theorem::Difficulty,
    rules::ProofTechnique,
};
use logic_core::services::GeneratedTheorem;
use crate::storage::{StorageService, PortfolioEntry};
use trainer_core::{AutoCloseInfo, RuleApplication, TransformationResult};

// The proof and theorem commands live in trainer-core, shared with the web build.

// ============ Theorem Commands ============

#[tauri::command]
pub fn get_classic_theorems() -> Vec<Theorem> {
    trainer_core::get_classic_theorems()
}

#[tauri::command]
pub fn generate_theorem(difficulty: Difficulty) -> Theorem {
    trainer_core::generate_theorem(difficulty)
}

#[tauri::command]
pub fn generate_theorem_with_value(difficulty_value: u8) -> Result<Theorem, String> {
    trainer_core::generate_theorem_with_value(difficulty_value)
}

#[tauri::command]
pub fn generate_theorem_by_tier(tier: String) -> Result<Theorem, String> {
    trainer_core::generate_theorem_by_tier(&tier)
}

#[tauri::command]
pub fn generate_theorem_with_proof(difficulty: Difficulty) -> GeneratedTheorem {
    trainer_core::generate_theorem_with_proof(difficulty)
}

#[tauri::command]
pub fn get_set_theory_track() -> Vec<TrackChapter> {
    trainer_core::get_set_theory_track()
}

// ============ Proof Commands ============

#[tauri::command]
pub fn create_proof(theorem: Theorem) -> Proof {
    trainer_core::create_proof(theorem)
}

#[tauri::command]
pub fn apply_rule(proof: Proof, rule_application: RuleApplication, formula_str: String) -> Result<Proof, String> {
    trainer_core::apply_rule(proof, rule_application, &formula_str)
}

#[tauri::command]
pub fn open_subproof(proof: Proof, technique: ProofTechnique, assumption_str: String) -> Result<Proof, String> {
    trainer_core::open_subproof(proof, technique, &assumption_str)
}

#[tauri::command]
pub fn close_subproof(proof: Proof, technique: ProofTechnique, conclusion_str: String) -> Result<Proof, String> {
    trainer_core::close_subproof(proof, technique, &conclusion_str)
}

#[tauri::command]
pub fn delete_line(proof: Proof, line_number: usize) -> Result<Proof, String> {
    trainer_core::delete_line(proof, line_number)
}

#[tauri::command]
pub fn undo_line(proof: Proof) -> Proof {
    trainer_core::undo_line(proof)
}

#[tauri::command]
pub fn check_proof_complete(proof: Proof) -> Proof {
    trainer_core::check_proof_complete(proof)
}

#[tauri::command]
pub fn get_hint(proof: Proof) -> String {
    trainer_core::get_hint(&proof)
}

// ============ Storage Commands ============

#[tauri::command]
pub fn save_proof(storage: State<Mutex<StorageService>>, proof: Proof) -> Result<(), String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.save_proof(&proof).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_proofs(storage: State<Mutex<StorageService>>) -> Result<Vec<Proof>, String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.load_all_proofs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_statistics(storage: State<Mutex<StorageService>>) -> Result<UserStatistics, String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.load_statistics().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_custom_theorem(storage: State<Mutex<StorageService>>, theorem: Theorem) -> Result<(), String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.save_custom_theorem(&theorem).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_custom_theorems(storage: State<Mutex<StorageService>>) -> Result<Vec<Theorem>, String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.load_all_custom_theorems().map_err(|e| e.to_string())
}

// ============ Portfolio Commands ============

#[tauri::command]
pub fn save_to_portfolio(
    storage: State<Mutex<StorageService>>,
    proof: Proof,
    time_spent_secs: Option<u64>,
    hints_used: u32,
) -> Result<PortfolioEntry, String> {
    // Allow saving both complete and incomplete proofs
    let entry = PortfolioEntry::new(proof, time_spent_secs, hints_used);
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.save_to_portfolio(&entry).map_err(|e| e.to_string())?;
    Ok(entry)
}

#[tauri::command]
pub fn load_portfolio(storage: State<Mutex<StorageService>>) -> Result<Vec<PortfolioEntry>, String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.load_portfolio().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_portfolio_entry(storage: State<Mutex<StorageService>>, id: String) -> Result<PortfolioEntry, String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.load_portfolio_entry(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_portfolio_entry(storage: State<Mutex<StorageService>>, id: String) -> Result<(), String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.delete_portfolio_entry(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_portfolio_notes(storage: State<Mutex<StorageService>>, id: String, notes: String) -> Result<(), String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.update_portfolio_notes(&id, notes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_portfolio_entry(storage: State<Mutex<StorageService>>, id: String, name: String) -> Result<(), String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.rename_portfolio_entry(&id, name).map_err(|e| e.to_string())
}

// ============ Global Notes Commands ============

#[tauri::command]
pub fn load_global_notes(storage: State<Mutex<StorageService>>) -> Result<String, String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.load_global_notes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_global_notes(storage: State<Mutex<StorageService>>, notes: String) -> Result<(), String> {
    let storage = storage.lock().map_err(|e| e.to_string())?;
    storage.save_global_notes(&notes).map_err(|e| e.to_string())
}

// ============ Utility Commands ============

#[tauri::command]
pub fn parse_formula(input: String) -> Result<Formula, String> {
    trainer_core::parse_formula(&input)
}

// ============ Scratchpad Commands ============

#[tauri::command]
pub fn get_all_transformations(formula_str: String) -> Result<Vec<TransformationResult>, String> {
    trainer_core::get_all_transformations(&formula_str)
}

#[tauri::command]
pub fn get_subproof_auto_close(proof: Proof) -> Option<AutoCloseInfo> {
    trainer_core::get_subproof_auto_close(&proof)
}
