// Formula types - mirrors Rust Formula enum
export type Formula =
  | { type: 'Atom'; value: string }
  | { type: 'Not'; value: Formula }
  | { type: 'And'; value: [Formula, Formula] }
  | { type: 'Or'; value: [Formula, Formula] }
  | { type: 'Implies'; value: [Formula, Formula] }
  | { type: 'Biconditional'; value: [Formula, Formula] }
  | { type: 'Contradiction' };

// Difficulty levels - 10 PropBench tiers
export type Difficulty = 'baby' | 'easy' | 'medium' | 'hard' | 'expert' | 'nightmare' | 'marathon' | 'absurd' | 'cosmic' | 'mind';

// Ordered list of all tiers for iteration
export const ALL_DIFFICULTIES: Difficulty[] = [
  'baby', 'easy', 'medium', 'hard', 'expert',
  'nightmare', 'marathon', 'absurd', 'cosmic', 'mind',
];

// Theorem themes
export type Theme =
  | 'modusPonens'
  | 'modusTollens'
  | 'hypotheticalSyllogism'
  | 'disjunctiveSyllogism'
  | 'constructiveDilemma'
  | 'conjunction'
  | 'disjunction'
  | 'doubleNegation'
  | 'biconditional'
  | 'conditionalProof'
  | 'indirectProof'
  | 'equivalence'
  | 'mixed';

// Theorem structure
export interface Theorem {
  id: string;
  premises: Formula[];
  conclusion: Formula;
  difficulty: Difficulty;
  /** The actual 1-100 difficulty value used to generate this theorem */
  difficulty_value: number;
  theme?: Theme;
  name?: string;
  is_classic: boolean;
}

// Inference rules - names match rules.md exactly
export type InferenceRule =
  | 'modusPonens'          // MP: p ⊃ q, p ∴ q
  | 'modusTollens'         // MT: p ⊃ q, ~q ∴ ~p
  | 'disjunctiveSyllogism' // DS: p ∨ q, ~p ∴ q
  | 'simplification'       // Simp: p · q ∴ p (or q)
  | 'conjunction'          // Conj: p, q ∴ p · q
  | 'hypotheticalSyllogism'// HS: p ⊃ q, q ⊃ r ∴ p ⊃ r
  | 'addition'             // Add: p ∴ p ∨ q
  | 'constructiveDilemma'  // CD: p ∨ q, p ⊃ r, q ⊃ s ∴ r ∨ s
  | 'contradiction';       // NegE: p, ~p ∴ ⊥

// Equivalence rules - names match rules.md exactly
export type EquivalenceRule =
  | 'doubleNegation'       // DN: p :: ~~p
  | 'deMorgan'             // DeM: ~(p · q) :: (~p ∨ ~q), ~(p ∨ q) :: (~p · ~q)
  | 'commutation'          // Comm: (p ∨ q) :: (q ∨ p), (p · q) :: (q · p)
  | 'association'          // Assoc: [p ∨ (q ∨ r)] :: [(p ∨ q) ∨ r]
  | 'distribution'         // Dist: [p · (q ∨ r)] :: [(p · q) ∨ (p · r)]
  | 'contraposition'       // Contra: (p ⊃ q) :: (~q ⊃ ~p)
  | 'implication'          // Impl: (p ⊃ q) :: (~p ∨ q)
  | 'exportation'          // Exp: [(p · q) ⊃ r] :: [p ⊃ (q ⊃ r)]
  | 'tautology'            // Taut: p :: (p · p), p :: (p ∨ p)
  | 'equivalence';         // Equiv: (p ≡ q) :: [(p ⊃ q) · (q ⊃ p)]

// Proof techniques
export type ProofTechnique =
  | 'conditionalProof'
  | 'indirectProof';

// Justification for proof lines
export type Justification =
  | { type: 'Premise' }
  | { type: 'Assumption'; technique: ProofTechnique }
  | { type: 'Inference'; rule: InferenceRule; lines: number[] }
  | { type: 'Equivalence'; rule: EquivalenceRule; line: number }
  | {
    type: 'SubproofConclusion';
    technique: ProofTechnique;
    subproof_start: number;
    subproof_end: number;
  };

// Proof line
export interface ProofLine {
  id: string;
  line_number: number;
  formula: Formula;
  justification: Justification;
  depth: number;
  scope_id?: string;
  is_valid: boolean;
  validation_message?: string;
}

// Proof scope
export interface ProofScope {
  id: string;
  start_line: number;
  end_line?: number;
  assumption: Formula;
  technique: ProofTechnique;
  depth: number;
  parent_scope_id?: string;
}

// Scope manager
export interface ScopeManager {
  scopes: ProofScope[];
  next_scope_id: number;
}

// Complete proof
export interface Proof {
  id: string;
  theorem: Theorem;
  lines: ProofLine[];
  scope_manager: ScopeManager;
  is_complete: boolean;
}

// Rule application for commands
export type RuleApplication =
  | {
    type: 'Inference';
    rule: InferenceRule;
    lines: number[];
    additional_formula?: string;
  }
  | {
    type: 'Equivalence';
    rule: EquivalenceRule;
    line: number;
  };

// Statistics types
export interface DifficultyStats {
  attempted: number;
  completed: number;
  average_time_secs?: number;
  average_steps?: number;
}

export interface ThemeStats {
  attempted: number;
  completed: number;
}

export interface ProofAttempt {
  theorem_id: string;
  started_at: string;
  completed_at?: string;
  completed: boolean;
  steps: number;
  hints_used: number;
  rules_used: string[];
}

export interface UserStatistics {
  total_proofs_attempted: number;
  total_proofs_completed: number;
  current_streak: number;
  longest_streak: number;
  last_proof_date?: string;
  difficulty_stats: Record<string, DifficultyStats>;
  theme_stats: Record<string, ThemeStats>;
  rule_usage: Record<string, number>;
  recent_attempts: ProofAttempt[];
}

// Portfolio entry for saved proofs (completed or in-progress)
export interface PortfolioEntry {
  id: string;
  proof: Proof;
  saved_at: string;  // Renamed from completed_at; backend uses serde alias for backward compat
  time_spent_secs?: number;
  steps_count: number;
  hints_used: number;
  notes?: string;
}

// Scratchpad types
export interface TransformationResult {
  rule: EquivalenceRule;
  rule_name: string;
  rule_abbrev: string;
  result: string;
}

export interface ScratchpadLine {
  id: string;
  formula: string;
  sourceRule?: string;
  isValid: boolean;
  lineType: 'formula' | 'note';
}

// Helper functions for displaying formulas
// Uses bracket hierarchy: innermost () → [] → {} outermost
export function formulaToString(formula: Formula): string {
  const maxDepth = bracketDepth(formula);
  return formulaToStringWithDepth(formula, 0, maxDepth);
}

// Calculate maximum bracket nesting depth needed
function bracketDepth(formula: Formula): number {
  switch (formula.type) {
    case 'Atom':
    case 'Contradiction':
      return 0;
    case 'Not': {
      const needsParens = !['Atom', 'Not', 'Contradiction'].includes(formula.value.type);
      if (needsParens) {
        return 1 + bracketDepth(formula.value);
      }
      return bracketDepth(formula.value);
    }
    case 'And':
    case 'Or':
    case 'Implies':
    case 'Biconditional': {
      const [left, right] = formula.value;
      const leftNeeds = subformulaBracketDepth(left);
      const rightNeeds = subformulaBracketDepth(right);
      return Math.max(leftNeeds, rightNeeds);
    }
  }
}

function subformulaBracketDepth(formula: Formula): number {
  if (formula.type === 'Atom' || formula.type === 'Contradiction') {
    return 0;
  }
  if (formula.type === 'Not' && formula.value.type === 'Atom') {
    return 0;
  }
  return 1 + bracketDepth(formula);
}

function formulaToStringWithDepth(formula: Formula, currentDepth: number, maxDepth: number): string {
  switch (formula.type) {
    case 'Atom':
      return formula.value;
    case 'Contradiction':
      return '⊥';
    case 'Not': {
      const needsParens = !['Atom', 'Not', 'Contradiction'].includes(formula.value.type);
      if (needsParens) {
        const inner = formulaToStringWithDepth(formula.value, currentDepth + 1, maxDepth);
        const [open, close] = bracketsForLevel(currentDepth, maxDepth);
        return `~${open}${inner}${close}`;
      }
      const inner = formulaToStringWithDepth(formula.value, currentDepth, maxDepth);
      return `~${inner}`;
    }
    case 'And': {
      const [left, right] = formula.value;
      return `${wrapIfNeeded(left)} . ${wrapIfNeeded(right)}`;
    }
    case 'Or': {
      const [left, right] = formula.value;
      return `${wrapIfNeeded(left)} ∨ ${wrapIfNeeded(right)}`;
    }
    case 'Implies': {
      const [left, right] = formula.value;
      return `${wrapIfNeeded(left)} ⊃ ${wrapIfNeeded(right)}`;
    }
    case 'Biconditional': {
      const [left, right] = formula.value;
      return `${wrapIfNeeded(left)} ≡ ${wrapIfNeeded(right)}`;
    }
  }
}

// Get bracket pair based on level from inside out: () innermost, [] middle, {} outermost
function bracketsForLevel(currentDepth: number, maxDepth: number): [string, string] {
  const levelFromInside = maxDepth - currentDepth - 1;
  switch (Math.min(levelFromInside, 2)) {
    case 0: return ['(', ')'];
    case 1: return ['[', ']'];
    default: return ['{', '}'];
  }
}

// Wrap in brackets when needed
// Rule: Binary compound formulas get wrapped; negations never do (they handle their own)
function wrapIfNeeded(formula: Formula): string {
  const formatted = formulaToString(formula);

  // Atoms and contradictions never need wrapping
  if (formula.type === 'Atom' || formula.type === 'Contradiction') {
    return formatted;
  }

  // Negations handle their own internal brackets; never wrap from outside
  if (formula.type === 'Not') {
    return formatted;
  }

  // Binary operators (And, Or, Implies, Biconditional): always wrap
  const depth = bracketDepth(formula);
  const [open, close] = bracketsForLevel(0, depth + 1);
  return `${open}${formatted}${close}`;
}

// Rule display info - names and abbreviations match rules.md exactly
export const inferenceRuleInfo: Record<InferenceRule, { name: string; abbrev: string; premises: number; symbol: string }> = {
  modusPonens: { name: 'Modus Ponens', abbrev: 'MP', premises: 2, symbol: 'p ⊃ q, p ∴ q' },
  modusTollens: { name: 'Modus Tollens', abbrev: 'MT', premises: 2, symbol: 'p ⊃ q, ~q ∴ ~p' },
  disjunctiveSyllogism: { name: 'Disjunctive Syllogism', abbrev: 'DS', premises: 2, symbol: 'p ∨ q, ~p ∴ q' },
  simplification: { name: 'Simplification', abbrev: 'Simp', premises: 1, symbol: 'p · q ∴ p' },
  conjunction: { name: 'Conjunction', abbrev: 'Conj', premises: 2, symbol: 'p, q ∴ p · q' },
  hypotheticalSyllogism: { name: 'Hypothetical Syllogism', abbrev: 'HS', premises: 2, symbol: 'p ⊃ q, q ⊃ r ∴ p ⊃ r' },
  addition: { name: 'Addition', abbrev: 'Add', premises: 1, symbol: 'p ∴ p ∨ q' },
  constructiveDilemma: { name: 'Constructive Dilemma', abbrev: 'CD', premises: 3, symbol: 'p ∨ q, p ⊃ r, q ⊃ s ∴ r ∨ s' },
  contradiction: { name: 'Contradiction', abbrev: 'NegE', premises: 2, symbol: 'p, ~p ∴ ⊥' },
};

export const equivalenceRuleInfo: Record<EquivalenceRule, { name: string; abbrev: string; symbol: string }> = {
  doubleNegation: { name: 'Double Negation', abbrev: 'DN', symbol: 'p :: ~~p' },
  deMorgan: { name: "DeMorgan's Theorem", abbrev: 'DeM', symbol: '~(p · q) :: (~p ∨ ~q)' },
  commutation: { name: 'Commutation', abbrev: 'Comm', symbol: '(p ∨ q) :: (q ∨ p)' },
  association: { name: 'Association', abbrev: 'Assoc', symbol: '[p ∨ (q ∨ r)] :: [(p ∨ q) ∨ r]' },
  distribution: { name: 'Distribution', abbrev: 'Dist', symbol: '[p · (q ∨ r)] :: [(p · q) ∨ (p · r)]' },
  contraposition: { name: 'Contraposition', abbrev: 'Contra', symbol: '(p ⊃ q) :: (~q ⊃ ~p)' },
  implication: { name: 'Implication', abbrev: 'Impl', symbol: '(p ⊃ q) :: (~p ∨ q)' },
  exportation: { name: 'Exportation', abbrev: 'Exp', symbol: '[(p · q) ⊃ r] :: [p ⊃ (q ⊃ r)]' },
  tautology: { name: 'Tautology', abbrev: 'Taut', symbol: 'p :: (p · p)' },
  equivalence: { name: 'Equivalence', abbrev: 'Equiv', symbol: '(p ≡ q) :: [(p ⊃ q) · (q ⊃ p)]' },
};

export const proofTechniqueInfo: Record<ProofTechnique, { name: string; abbrev: string }> = {
  conditionalProof: { name: 'Conditional Proof', abbrev: 'CP' },
  indirectProof: { name: 'Indirect Proof', abbrev: 'IP' },
};

export function justificationToString(j: Justification): string {
  switch (j.type) {
    case 'Premise':
      return 'Premise';
    case 'Assumption':
      return `Assumption (${proofTechniqueInfo[j.technique].abbrev})`;
    case 'Inference':
      return `${inferenceRuleInfo[j.rule].abbrev} ${j.lines.join(', ')}`;
    case 'Equivalence':
      return `${equivalenceRuleInfo[j.rule].abbrev} ${j.line}`;
    case 'SubproofConclusion':
      return `${proofTechniqueInfo[j.technique].abbrev} ${j.subproof_start}-${j.subproof_end}`;
  }
}

export function difficultyColor(d: Difficulty): string {
  switch (d) {
    case 'baby':
      return '#81d4fa';
    case 'easy':
      return '#4caf50';
    case 'medium':
      return '#ff9800';
    case 'hard':
      return '#f44336';
    case 'expert':
      return '#9c27b0';
    case 'nightmare':
      return '#b71c1c';
    case 'marathon':
      return '#4a148c';
    case 'absurd':
      return '#e91e63';
    case 'cosmic':
      return '#ffd600';
    case 'mind':
      return '#b0bec5';
  }
}

/** Human-readable display label for a difficulty tier */
export function difficultyLabel(d: Difficulty): string {
  switch (d) {
    case 'baby': return 'Baby';
    case 'easy': return 'Easy';
    case 'medium': return 'Medium';
    case 'hard': return 'Hard';
    case 'expert': return 'Expert';
    case 'nightmare': return 'Nightmare';
    case 'marathon': return 'Marathon';
    case 'absurd': return 'Absurd';
    case 'cosmic': return 'Cosmic';
    case 'mind': return 'Mind';
  }
}
