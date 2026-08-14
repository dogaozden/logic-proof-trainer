use tauri::{self, State};
use std::sync::Mutex;
use logic_core::models::{
    Formula, Proof, Theorem, UserStatistics, Justification,
    theorem::{Difficulty, DifficultyTier, get_classic_theorems as get_classics},
    rules::{InferenceRule, EquivalenceRule, ProofTechnique},
};
use logic_core::services::{
    ProofVerifier, TheoremGenerator, GeneratedTheorem, ObfuscateGenerator,
};
use crate::storage::{StorageService, PortfolioEntry};
use serde::{Deserialize, Serialize};

// ============ Theorem Commands ============

#[tauri::command]
pub fn get_classic_theorems() -> Vec<Theorem> {
    get_classics()
}

#[tauri::command]
pub fn generate_theorem(difficulty: Difficulty) -> Theorem {
    let generator = TheoremGenerator::with_difficulty(difficulty);
    generator.generate(difficulty)
}

/// Generate a theorem with a specific difficulty value (1-100)
#[tauri::command]
pub fn generate_theorem_with_value(difficulty_value: u8) -> Result<Theorem, String> {
    if difficulty_value < 1 || difficulty_value > 100 {
        return Err("Difficulty must be between 1 and 100".to_string());
    }
    let generator = TheoremGenerator::with_difficulty_value(difficulty_value);
    Ok(generator.generate_with_value(difficulty_value))
}

/// Generate a theorem using the 10-tier difficulty system (Baby through Mind).
/// Uses DifficultySpec-based generation with multi-pass obfuscation pipeline.
#[tauri::command]
pub fn generate_theorem_by_tier(tier: String) -> Result<Theorem, String> {
    let difficulty_tier = DifficultyTier::from_str(&tier)
        .ok_or_else(|| format!(
            "Unknown tier '{}'. Valid tiers: Baby, Easy, Medium, Hard, Expert, Nightmare, Marathon, Absurd, Cosmic, Mind",
            tier
        ))?;
    let mut rng = rand::thread_rng();
    Ok(ObfuscateGenerator::generate_with_tier(difficulty_tier, &mut rng))
}

/// Generate a theorem with its proof tree (solution)
/// The proof tree contains the complete solution structure
#[tauri::command]
pub fn generate_theorem_with_proof(difficulty: Difficulty) -> GeneratedTheorem {
    let generator = TheoremGenerator::with_difficulty(difficulty);
    generator.generate_with_proof(difficulty)
}

// ============ Proof Commands ============

#[tauri::command]
pub fn create_proof(theorem: Theorem) -> Proof {
    Proof::new(theorem)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RuleApplication {
    Inference {
        rule: InferenceRule,
        lines: Vec<usize>,
        #[serde(default)]
        additional_formula: Option<String>,
    },
    Equivalence {
        rule: EquivalenceRule,
        line: usize,
    },
}

#[tauri::command]
pub fn apply_rule(
    proof: Proof,
    rule_application: RuleApplication,
    formula_str: String,
) -> Result<Proof, String> {
    // Clone the proof to avoid mutating the input on error
    let mut working_proof = proof.clone();

    // Parse the formula
    let formula = Formula::parse(&formula_str)
        .map_err(|e| format!("Invalid formula: {}", e))?;

    let justification = match rule_application {
        RuleApplication::Inference { rule, lines, additional_formula: _ } => {
            Justification::Inference { rule, lines }
        }
        RuleApplication::Equivalence { rule, line } => {
            Justification::Equivalence { rule, line }
        }
    };

    // Add the line
    working_proof.add_line(formula, justification);

    // Verify the new line
    if working_proof.lines.is_empty() {
        return Err("No lines in proof".to_string());
    }
    let last_idx = working_proof.lines.len() - 1;
    let line = &working_proof.lines[last_idx];
    let result = ProofVerifier::verify_line(line, &working_proof);

    // Update validity
    working_proof.lines[last_idx].is_valid = result.is_valid;
    working_proof.lines[last_idx].validation_message = result.message.clone();

    if !result.is_valid {
        return Err(result.message.unwrap_or_else(|| "Invalid application".to_string()));
    }

    // Check if proof is complete
    working_proof.check_complete();

    Ok(working_proof)
}

#[tauri::command]
pub fn open_subproof(
    proof: Proof,
    technique: ProofTechnique,
    assumption_str: String,
) -> Result<Proof, String> {
    // Clone the proof to avoid mutating the input on error
    let mut working_proof = proof.clone();

    let assumption = Formula::parse(&assumption_str)
        .map_err(|e| format!("Invalid formula: {}", e))?;

    working_proof.open_subproof(assumption, technique);
    Ok(working_proof)
}

#[tauri::command]
pub fn close_subproof(
    proof: Proof,
    technique: ProofTechnique,
    conclusion_str: String,
) -> Result<Proof, String> {
    // Clone the proof to avoid mutating the input on error
    let mut working_proof = proof.clone();

    let conclusion = Formula::parse(&conclusion_str)
        .map_err(|e| format!("Invalid formula: {}", e))?;

    match working_proof.close_subproof(conclusion, technique) {
        Some(_line) => {
            // Verify the conclusion line
            if working_proof.lines.is_empty() {
                return Err("No lines in proof".to_string());
            }
            let last_idx = working_proof.lines.len() - 1;
            let line = &working_proof.lines[last_idx];
            let result = ProofVerifier::verify_line(line, &working_proof);

            working_proof.lines[last_idx].is_valid = result.is_valid;
            working_proof.lines[last_idx].validation_message = result.message.clone();

            if !result.is_valid {
                return Err(result.message.unwrap_or_else(|| "Invalid subproof conclusion".to_string()));
            }

            working_proof.check_complete();
            Ok(working_proof)
        }
        None => {
            let all_scopes = working_proof.scope_manager.all_scopes();
            let scope_count = all_scopes.len();
            let open_scopes = all_scopes.iter().filter(|s| s.is_open()).count();
            let scope_details: Vec<String> = all_scopes.iter().map(|s| {
                format!("{{id:{}, start:{}, end:{:?}, open:{}}}",
                    s.id, s.start_line, s.end_line, s.is_open())
            }).collect();
            Err(format!(
                "No open subproof to close. Scopes({}/{}): [{}]",
                open_scopes, scope_count, scope_details.join(", ")
            ))
        }
    }
}

#[tauri::command]
pub fn delete_line(proof: Proof, line_number: usize) -> Result<Proof, String> {
    // line_number is 1-indexed (matches UI display), proof.lines.len() is count.
    // For line N to be the last line, N must equal the total count.
    // Example: 5 lines means lines 1-5, so only line 5 (== len) can be deleted.
    if line_number != proof.lines.len() {
        return Err("Can only delete the last line".to_string());
    }

    // Don't delete premises
    if line_number <= proof.theorem.premises.len() {
        return Err("Cannot delete premises".to_string());
    }

    let mut working_proof = proof.clone();
    working_proof.remove_last_line();
    Ok(working_proof)
}

#[tauri::command]
pub fn undo_line(proof: Proof) -> Proof {
    let mut working_proof = proof.clone();
    working_proof.remove_last_line();
    working_proof
}

#[tauri::command]
pub fn check_proof_complete(proof: Proof) -> Proof {
    let mut working_proof = proof.clone();
    working_proof.check_complete();
    working_proof
}

#[tauri::command]
pub fn get_hint(proof: Proof) -> String {
    // Simple hint system based on proof state
    let conclusion = &proof.theorem.conclusion;
    let current_formulas: Vec<&Formula> = proof.lines.iter()
        .filter(|l| l.is_valid && l.depth == 0)
        .map(|l| &l.formula)
        .collect();

    // Check if we already have the conclusion
    if current_formulas.contains(&conclusion) {
        return "The proof is complete! The conclusion has been derived.".to_string();
    }

    // Check for Modus Ponens opportunities
    for line in &proof.lines {
        if let Formula::Implies(ant, cons) = &line.formula {
            if current_formulas.contains(&ant.as_ref()) && !current_formulas.contains(&cons.as_ref()) {
                return format!(
                    "Try using Modus Ponens: you have {} and {}, so you can derive {}",
                    line.formula.display_string(),
                    ant.display_string(),
                    cons.display_string()
                );
            }
        }
    }

    // Suggest conditional proof if conclusion is an implication
    if let Formula::Implies(ant, _cons) = conclusion {
        if proof.scope_manager.current_depth() == 0 {
            return format!(
                "The conclusion is an implication. Try opening a Conditional Proof by assuming {}",
                ant.display_string()
            );
        }
    }

    // Suggest indirect proof if stuck
    if proof.scope_manager.current_depth() == 0 && proof.lines.len() > proof.theorem.premises.len() + 2 {
        return format!(
            "Consider using Indirect Proof: assume ~({}) and try to derive a contradiction",
            conclusion.display_string()
        );
    }

    // Default hint
    "Look at the structure of your conclusion and work backwards. What would you need to derive it?".to_string()
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
    Formula::parse(&input).map_err(|e| e.to_string())
}

// ============ Scratchpad Commands ============

#[derive(Debug, Clone, Serialize)]
pub struct TransformationResult {
    pub rule: EquivalenceRule,
    pub rule_name: String,
    pub rule_abbrev: String,
    pub result: String,
}

#[tauri::command]
pub fn get_all_transformations(formula_str: String) -> Result<Vec<TransformationResult>, String> {
    let formula = Formula::parse(&formula_str)
        .map_err(|e| format!("Invalid formula: {}", e))?;

    let mut results = Vec::new();
    for rule in EquivalenceRule::all() {
        for equiv_form in rule.equivalent_forms(&formula) {
            results.push(TransformationResult {
                rule,
                rule_name: rule.name().to_string(),
                rule_abbrev: rule.abbreviation().to_string(),
                result: equiv_form.display_string(),
            });
        }
    }
    Ok(results)
}

/// Get auto-close information for the current subproof
#[derive(Debug, Clone, Serialize)]
pub struct AutoCloseInfo {
    pub technique: String,
    pub conclusion: String,
}

#[tauri::command]
pub fn get_subproof_auto_close(proof: Proof) -> Option<AutoCloseInfo> {
    if let Some((technique, conclusion)) = proof.get_auto_close_conclusion() {
        Some(AutoCloseInfo {
            technique: technique.abbreviation().to_string(),
            conclusion: conclusion.display_string(),
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_classic_theorems() {
        let theorems = get_classic_theorems();
        assert_eq!(theorems.len(), 13);
    }

    #[test]
    fn test_generate_theorem() {
        let theorem = generate_theorem(Difficulty::Easy);
        assert!(theorem.theme.is_some());
    }

    #[test]
    fn test_create_and_complete_proof() {
        let theorems = get_classic_theorems();
        let mp_theorem = theorems[0].clone(); // Modus Ponens

        let proof = create_proof(mp_theorem);
        assert_eq!(proof.lines.len(), 2); // Two premises

        // Apply Modus Ponens
        let result = apply_rule(
            proof,
            RuleApplication::Inference {
                rule: InferenceRule::ModusPonens,
                lines: vec![1, 2],
                additional_formula: None,
            },
            "Q".to_string(),
        );

        let proof = result.unwrap();
        assert!(proof.is_complete);
    }

    #[test]
    fn test_parse_formula() {
        let result = parse_formula("P -> Q".to_string());
        assert!(result.is_ok());

        let result = parse_formula("invalid (((".to_string());
        assert!(result.is_err());
    }
}
