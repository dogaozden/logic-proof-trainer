//! The trainer's proof and theorem commands, independent of Tauri. `src-tauri` wraps them as
//! IPC commands; `src-wasm` exposes them to the browser build through `dispatch`.

use logic_core::models::{
    rules::{EquivalenceRule, InferenceRule, ProofTechnique},
    set_theory::{halmos_track, TrackChapter},
    theorem::{get_classic_theorems as get_classics, Difficulty, DifficultyTier},
    Formula, Justification, Proof, Theorem,
};
use logic_core::services::{
    generate_first_order, is_generated_first_order_id, regenerate_first_order, GeneratedTheorem, ObfuscateGenerator,
    ProofVerifier, TheoremGenerator,
};
use rand::Rng;
use serde::{Deserialize, Serialize};

// ============ Theorem Commands ============

pub fn get_classic_theorems() -> Vec<Theorem> {
    get_classics()
}

pub fn generate_theorem(difficulty: Difficulty) -> Theorem {
    let generator = TheoremGenerator::with_difficulty(difficulty);
    generator.generate(difficulty)
}

/// Generate a theorem with a specific difficulty value (1-100)
pub fn generate_theorem_with_value(difficulty_value: u8) -> Result<Theorem, String> {
    if !(1..=100).contains(&difficulty_value) {
        return Err("Difficulty must be between 1 and 100".to_string());
    }
    let generator = TheoremGenerator::with_difficulty_value(difficulty_value);
    Ok(generator.generate_with_value(difficulty_value))
}

/// Generate a theorem using the 10-tier difficulty system (Baby through Mind).
pub fn generate_theorem_by_tier(tier: &str) -> Result<Theorem, String> {
    let difficulty_tier = DifficultyTier::from_str(tier).ok_or_else(|| {
        format!(
            "Unknown tier '{}'. Valid tiers: Baby, Easy, Medium, Hard, Expert, Nightmare, Marathon, Absurd, Cosmic, Mind",
            tier
        )
    })?;
    let mut rng = rand::thread_rng();
    Ok(ObfuscateGenerator::generate_with_tier(difficulty_tier, &mut rng))
}

/// Generate a theorem with its proof tree (solution)
pub fn generate_theorem_with_proof(difficulty: Difficulty) -> GeneratedTheorem {
    let generator = TheoremGenerator::with_difficulty(difficulty);
    generator.generate_with_proof(difficulty)
}

/// A monadic predicate-logic theorem grown forward with its own verified proof. Its id
/// (`fo-gen-LEVEL-SEED`) regenerates it, which is how `get_hint` finds the proof's rules.
pub fn generate_first_order_theorem(difficulty: Difficulty) -> Result<Theorem, String> {
    let seed = rand::thread_rng().gen_range(0..1_000_000_000u64);
    generate_first_order(difficulty, seed)
        .map(|c| c.theorem)
        .map_err(|e| format!("no predicate theorem generated: {e:?}"))
}

/// The set-theory track: ZFC axioms and exercises in Halmos's order.
pub fn get_set_theory_track() -> Vec<TrackChapter> {
    halmos_track()
}

// ============ Proof Commands ============

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

fn parse(s: &str) -> Result<Formula, String> {
    Formula::parse(s).map_err(|e| format!("Invalid formula: {}", e))
}

/// Verify the newest line; on failure the input proof is left as it was.
fn verify_last(mut working_proof: Proof, fallback: &str) -> Result<Proof, String> {
    let last_idx = working_proof
        .lines
        .len()
        .checked_sub(1)
        .ok_or_else(|| "No lines in proof".to_string())?;
    let result = ProofVerifier::verify_line(&working_proof.lines[last_idx], &working_proof);
    working_proof.lines[last_idx].is_valid = result.is_valid;
    working_proof.lines[last_idx].validation_message = result.message.clone();
    if !result.is_valid {
        return Err(result.message.unwrap_or_else(|| fallback.to_string()));
    }
    working_proof.check_complete();
    Ok(working_proof)
}

pub fn apply_rule(proof: Proof, rule_application: RuleApplication, formula_str: &str) -> Result<Proof, String> {
    let mut working_proof = proof;
    let formula = parse(formula_str)?;
    let justification = match rule_application {
        RuleApplication::Inference { rule, lines, additional_formula: _ } => Justification::Inference { rule, lines },
        RuleApplication::Equivalence { rule, line } => Justification::Equivalence { rule, line },
    };
    working_proof.add_line(formula, justification);
    verify_last(working_proof, "Invalid application")
}

pub fn open_subproof(proof: Proof, technique: ProofTechnique, assumption_str: &str) -> Result<Proof, String> {
    let mut working_proof = proof;
    let assumption = parse(assumption_str)?;
    working_proof.open_subproof(assumption, technique);
    let last_idx = working_proof.lines.len() - 1;
    let result = ProofVerifier::verify_line(&working_proof.lines[last_idx], &working_proof);
    if !result.is_valid {
        return Err(result.message.unwrap_or_else(|| "Invalid assumption".to_string()));
    }
    Ok(working_proof)
}

pub fn close_subproof(proof: Proof, technique: ProofTechnique, conclusion_str: &str) -> Result<Proof, String> {
    let mut working_proof = proof;
    let conclusion = parse(conclusion_str)?;
    if technique == ProofTechnique::ExistentialElimination {
        let scope = working_proof
            .scope_manager
            .current_scope()
            .ok_or_else(|| "No open subproof to close".to_string())?;
        if scope.technique != ProofTechnique::ExistentialElimination {
            return Err(format!("The open subproof is {}, not ∃E", scope.technique.abbreviation()));
        }
        if working_proof.existential_line_for(&scope.assumption, scope.start_line).is_none() {
            return Err("No accessible line ∃x φ has this subproof's assumption as an instance".to_string());
        }
    }
    match working_proof.close_subproof(conclusion, technique) {
        Some(_) => verify_last(working_proof, "Invalid subproof conclusion"),
        None => {
            let all_scopes = working_proof.scope_manager.all_scopes();
            let open_scopes = all_scopes.iter().filter(|s| s.is_open()).count();
            let scope_details: Vec<String> = all_scopes
                .iter()
                .map(|s| format!("{{id:{}, start:{}, end:{:?}, open:{}}}", s.id, s.start_line, s.end_line, s.is_open()))
                .collect();
            Err(format!(
                "No open subproof to close. Scopes({}/{}): [{}]",
                open_scopes,
                all_scopes.len(),
                scope_details.join(", ")
            ))
        }
    }
}

pub fn delete_line(proof: Proof, line_number: usize) -> Result<Proof, String> {
    if line_number != proof.lines.len() {
        return Err("Can only delete the last line".to_string());
    }
    if line_number <= proof.theorem.premises.len() {
        return Err("Cannot delete premises".to_string());
    }
    let mut working_proof = proof;
    working_proof.remove_last_line();
    Ok(working_proof)
}

pub fn undo_line(proof: Proof) -> Proof {
    let mut working_proof = proof;
    working_proof.remove_last_line();
    working_proof
}

pub fn check_proof_complete(proof: Proof) -> Proof {
    let mut working_proof = proof;
    working_proof.check_complete();
    working_proof
}

pub fn get_hint(proof: &Proof) -> String {
    let conclusion = &proof.theorem.conclusion;
    let current_formulas: Vec<&Formula> = proof
        .lines
        .iter()
        .filter(|l| l.is_valid && l.depth == 0)
        .map(|l| &l.formula)
        .collect();

    if current_formulas.iter().any(|f| f.alpha_eq(conclusion)) {
        return "The proof is complete! The conclusion has been derived.".to_string();
    }

    if is_generated_first_order_id(&proof.theorem.id) {
        if let Ok(generated) = regenerate_first_order(&proof.theorem.id) {
            return generated.hint();
        }
    }

    // Set-theory exercises carry a hand-written hint that names the rules they need. The
    // propositional hints below read the proof's lines, which says nothing useful about ∀ and ∈.
    if let Some(exercise) = get_set_theory_track().iter().flat_map(|c| c.exercises.iter()).find(|e| e.id == proof.theorem.id) {
        return exercise.hint.clone();
    }

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

    if proof.scope_manager.current_depth() == 0 {
        if let Some(ex) = current_formulas.iter().find(|f| matches!(f, Formula::Exists(_, _))) {
            if let Formula::Exists(x, _) = ex {
                return format!(
                    "You have {}. Open an ∃E subproof: assume it with a new name in place of {} (e.g. \"F(c) ∃E\"), derive the goal, then close with ∃E.",
                    ex.display_string(),
                    x
                );
            }
        }
    }

    match conclusion {
        Formula::ForAll(x, _) => {
            return format!(
                "The conclusion is universal. Derive it for a name that occurs in no premise or open assumption, then use ∀I to generalize that name to {}.",
                x
            )
        }
        Formula::Subset(_, _) => {
            return "The conclusion is an inclusion. Unfold it with Def to ∀x(x ∈ … ⊃ x ∈ …), prove that, then fold back with Def.".to_string()
        }
        Formula::Identity(_, _) if proof.theorem.premises.iter().any(|p| matches!(p, Formula::ForAll(_, _))) => {
            return "To prove two sets equal, show they have the same elements (∀z(z ∈ a ≡ z ∈ b)) and use the Axiom of Extension.".to_string()
        }
        _ => {}
    }

    if let Formula::Implies(ant, _cons) = conclusion {
        if proof.scope_manager.current_depth() == 0 {
            return format!(
                "The conclusion is an implication. Try opening a Conditional Proof by assuming {}",
                ant.display_string()
            );
        }
    }

    if proof.scope_manager.current_depth() == 0 && proof.lines.len() > proof.theorem.premises.len() + 2 {
        return format!(
            "Consider using Indirect Proof: assume ~({}) and try to derive a contradiction",
            conclusion.display_string()
        );
    }

    "Look at the structure of your conclusion and work backwards. What would you need to derive it?".to_string()
}

// ============ Utility Commands ============

pub fn parse_formula(input: &str) -> Result<Formula, String> {
    Formula::parse(input).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct TransformationResult {
    pub rule: EquivalenceRule,
    pub rule_name: String,
    pub rule_abbrev: String,
    pub result: String,
}

/// Every rewrite of the formula by each equivalence rule. The propositional rules rewrite the
/// whole formula (as before); QN and Def rewrite any subformula, since quantifier and
/// set-theory steps are almost always inside a larger formula.
pub fn get_all_transformations(formula_str: &str) -> Result<Vec<TransformationResult>, String> {
    let formula = parse(formula_str)?;
    let mut results = Vec::new();
    let mut push = |rule: EquivalenceRule, f: &Formula| {
        let result = f.display_string();
        if !results.iter().any(|r: &TransformationResult| r.rule == rule && r.result == result) {
            results.push(TransformationResult {
                rule,
                rule_name: rule.name().to_string(),
                rule_abbrev: rule.abbreviation().to_string(),
                result,
            });
        }
    };
    for rule in EquivalenceRule::all() {
        for equiv_form in rule.equivalent_forms(&formula) {
            push(rule, &equiv_form);
        }
    }
    if formula.is_first_order() {
        for rule in EquivalenceRule::first_order() {
            for sub in formula.subformulas() {
                for eq in rule.equivalent_forms(&sub) {
                    push(rule, &EquivalenceRule::replace_subformula(&formula, &sub, &eq));
                }
            }
        }
    }
    Ok(results)
}

#[derive(Debug, Clone, Serialize)]
pub struct AutoCloseInfo {
    pub technique: String,
    pub conclusion: String,
}

pub fn get_subproof_auto_close(proof: &Proof) -> Option<AutoCloseInfo> {
    proof.get_auto_close_conclusion().map(|(technique, conclusion)| AutoCloseInfo {
        technique: technique.abbreviation().to_string(),
        conclusion: conclusion.display_string(),
    })
}

// ============ Dispatch (web build) ============

fn arg<T: for<'de> Deserialize<'de>>(args: &serde_json::Value, key: &str) -> Result<T, String> {
    let v = args.get(key).ok_or_else(|| format!("missing argument {}", key))?;
    serde_json::from_value(v.clone()).map_err(|e| format!("argument {}: {}", key, e))
}

fn ok<T: Serialize>(v: T) -> Result<serde_json::Value, String> {
    serde_json::to_value(v).map_err(|e| e.to_string())
}

/// Run a command by its Tauri name with its camelCase JSON arguments, as the frontend's
/// `invoke` sends them.
pub fn dispatch(command: &str, args: &serde_json::Value) -> Result<serde_json::Value, String> {
    match command {
        "get_classic_theorems" => ok(get_classic_theorems()),
        "generate_theorem" => ok(generate_theorem(arg(args, "difficulty")?)),
        "generate_theorem_with_value" => ok(generate_theorem_with_value(arg(args, "difficultyValue")?)?),
        "generate_theorem_by_tier" => ok(generate_theorem_by_tier(&arg::<String>(args, "tier")?)?),
        "get_set_theory_track" => ok(get_set_theory_track()),
        "generate_first_order_theorem" => ok(generate_first_order_theorem(arg(args, "difficulty")?)?),
        "create_proof" => ok(create_proof(arg(args, "theorem")?)),
        "apply_rule" => ok(apply_rule(
            arg(args, "proof")?,
            arg(args, "ruleApplication")?,
            &arg::<String>(args, "formulaStr")?,
        )?),
        "open_subproof" => ok(open_subproof(
            arg(args, "proof")?,
            arg(args, "technique")?,
            &arg::<String>(args, "assumptionStr")?,
        )?),
        "close_subproof" => ok(close_subproof(
            arg(args, "proof")?,
            arg(args, "technique")?,
            &arg::<String>(args, "conclusionStr")?,
        )?),
        "delete_line" => ok(delete_line(arg(args, "proof")?, arg(args, "lineNumber")?)?),
        "undo_line" => ok(undo_line(arg(args, "proof")?)),
        "check_proof_complete" => ok(check_proof_complete(arg(args, "proof")?)),
        "get_hint" => ok(get_hint(&arg(args, "proof")?)),
        "parse_formula" => ok(parse_formula(&arg::<String>(args, "input")?)?),
        "get_all_transformations" => ok(get_all_transformations(&arg::<String>(args, "formulaStr")?)?),
        "get_subproof_auto_close" => ok(get_subproof_auto_close(&arg(args, "proof")?)),
        other => Err(format!("unknown command {}", other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classic_modus_ponens_completes() {
        let mp_theorem = get_classic_theorems()[0].clone();
        let proof = create_proof(mp_theorem);
        let proof = apply_rule(
            proof,
            RuleApplication::Inference { rule: InferenceRule::ModusPonens, lines: vec![1, 2], additional_formula: None },
            "Q",
        )
        .unwrap();
        assert!(proof.is_complete);
    }

    #[test]
    fn dispatch_runs_an_exists_elimination_through_json() {
        let track = get_set_theory_track();
        let ex = track[0].exercises.iter().find(|e| e.id == "halmos-0-4").unwrap().theorem.clone();
        let mut proof = dispatch("create_proof", &serde_json::json!({ "theorem": ex })).unwrap();
        for (cmd, args) in [
            ("open_subproof", serde_json::json!({ "technique": "existentialElimination", "assumptionStr": "F(a)" })),
            ("apply_rule", serde_json::json!({ "ruleApplication": { "type": "Inference", "rule": "universalElimination", "lines": [2] }, "formulaStr": "F(a) ⊃ G(a)" })),
            ("apply_rule", serde_json::json!({ "ruleApplication": { "type": "Inference", "rule": "modusPonens", "lines": [4, 3] }, "formulaStr": "G(a)" })),
            ("apply_rule", serde_json::json!({ "ruleApplication": { "type": "Inference", "rule": "existentialIntroduction", "lines": [5] }, "formulaStr": "∃x G(x)" })),
        ] {
            let mut a = args.clone();
            a["proof"] = proof.clone();
            proof = dispatch(cmd, &a).unwrap_or_else(|e| panic!("{cmd}: {e}"));
        }
        let auto = dispatch("get_subproof_auto_close", &serde_json::json!({ "proof": proof })).unwrap();
        assert_eq!(auto["technique"], "∃E");
        let closed = dispatch(
            "close_subproof",
            &serde_json::json!({ "proof": proof, "technique": "existentialElimination", "conclusionStr": auto["conclusion"] }),
        )
        .unwrap();
        assert_eq!(closed["is_complete"], true);
    }

    #[test]
    fn set_theory_exercise_gets_its_own_hint() {
        let track = get_set_theory_track();
        let ex = track[0].exercises.iter().find(|e| e.id == "halmos-0-1").unwrap().theorem.clone();
        let proof = create_proof(ex);
        assert_eq!(get_hint(&proof), "∀E with a for x, then MP.");
    }

    #[test]
    fn solved_set_theory_exercise_says_so() {
        let track = get_set_theory_track();
        let ex = track[0].exercises.iter().find(|e| e.id == "halmos-0-1").unwrap().theorem.clone();
        let mut proof = dispatch("create_proof", &serde_json::json!({ "theorem": ex })).unwrap();
        for (rule, lines, formula) in [("universalElimination", vec![1], "F(a) ⊃ G(a)"), ("modusPonens", vec![3, 2], "G(a)")] {
            let args = serde_json::json!({
                "proof": proof,
                "ruleApplication": { "type": "Inference", "rule": rule, "lines": lines },
                "formulaStr": formula,
            });
            proof = dispatch("apply_rule", &args).unwrap();
        }
        let typed: Proof = serde_json::from_value(proof).unwrap();
        assert!(get_hint(&typed).starts_with("The proof is complete"));
    }

    #[test]
    fn generated_first_order_theorem_has_a_proof_hint_and_solves_through_dispatch() {
        let theorem = dispatch("generate_first_order_theorem", &serde_json::json!({ "difficulty": "medium" })).unwrap();
        let typed: Theorem = serde_json::from_value(theorem.clone()).unwrap();
        assert!(typed.id.starts_with("fo-gen-medium-"));
        assert!(typed.conclusion.is_first_order());
        let proof = create_proof(typed.clone());
        assert!(get_hint(&proof).starts_with("There is a"), "{}", get_hint(&proof));
        // Replay the generator's own proof through the trainer commands.
        let solution = regenerate_first_order(&typed.id).unwrap().proof;
        let mut p = dispatch("create_proof", &serde_json::json!({ "theorem": theorem })).unwrap();
        for line in solution.lines.iter().skip(typed.premises.len()) {
            let f = line.formula.display_string();
            let (cmd, args) = match &line.justification {
                Justification::Assumption { technique } => ("open_subproof", serde_json::json!({ "technique": technique, "assumptionStr": f })),
                Justification::Inference { rule, lines } => (
                    "apply_rule",
                    serde_json::json!({ "ruleApplication": { "type": "Inference", "rule": rule, "lines": lines }, "formulaStr": f }),
                ),
                Justification::SubproofConclusion { technique, .. } => ("close_subproof", serde_json::json!({ "technique": technique, "conclusionStr": f })),
                Justification::ExistentialElimination { .. } => {
                    ("close_subproof", serde_json::json!({ "technique": "existentialElimination", "conclusionStr": f }))
                }
                other => panic!("unexpected {other:?}"),
            };
            let mut a = args;
            a["proof"] = p;
            p = dispatch(cmd, &a).unwrap_or_else(|e| panic!("{cmd} {f}: {e}"));
        }
        assert_eq!(p["is_complete"], true);
    }

    #[test]
    fn escape_is_rejected_with_a_reason() {
        let theorem = Theorem::new(vec![Formula::parse("∃x F(x)").unwrap()], Formula::parse("F(a)").unwrap(), Difficulty::Easy, None, None);
        let proof = open_subproof(create_proof(theorem), ProofTechnique::ExistentialElimination, "F(a)").unwrap();
        let err = close_subproof(proof, ProofTechnique::ExistentialElimination, "F(a)").unwrap_err();
        assert!(err.contains("escapes"), "{err}");
    }
}
