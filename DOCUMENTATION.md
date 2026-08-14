# Logic Proof Trainer - Technical Documentation

A cross-platform desktop application for practicing propositional logic proofs using the natural deduction system. Built with Tauri (Rust backend + React/TypeScript frontend).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Logical System](#logical-system)
3. [Project Structure](#project-structure)
4. [Backend (Rust)](#backend-rust)
5. [Frontend (React/TypeScript)](#frontend-reacttypescript)
6. [Tauri Commands](#tauri-commands)
7. [Data Flow](#data-flow)
8. [Theorem Generation Pipeline](#theorem-generation-pipeline)
9. [Building and Running](#building-and-running)
10. [Dependencies](#dependencies)
11. [Theme System](#theme-system)
12. [Portfolio System](#portfolio-system)
13. [Security](#security)
14. [PropBench: LLM Benchmark Tool](#propbench-llm-benchmark-tool)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tauri Application                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                                  │
│  ┌───────────┐ ┌─────────────┐ ┌─────────┐ ┌──────────┐         │
│  │TheoremList│ │ProofWorkspace│ │Portfolio│ │ Settings │        │
│  └───────────┘ └─────────────┘ └─────────┘ └──────────┘         │
│        │              │              │            │             │
│        └──────────────┼──────────────┴────────────┘             │
│                       │                                         │
│            Tauri IPC (invoke commands)                          │
│                       │                                         │
├───────────────────────┼─────────────────────────────────────────┤
│  Backend (Rust)       │                                         │
│  ┌────────────────────┴──────────────────────┐                  │
│  │             Commands (27 IPC)             │                  │
│  └────────────────────┬──────────────────────┘                  │
│       ┌───────────────┼───────────────┐                         │
│  ┌────┴────┐    ┌─────┴─────┐    ┌────┴────┐                    │
│  │ Models  │    │ Services  │    │ Storage │                    │
│  │-Formula │    │-Verifier  │    │-JSON    │                    │
│  │-Proof   │    │-Generator │    │-Portfolio│                   │
│  │-Theorem │    │-TreeGen   │    │-Stats   │                    │
│  │-Rules   │    │-TruthTable│    │         │                    │
│  │-Scope   │    │-ProofTree │    │         │                    │
│  │-Stats   │    │-Obfuscate │    │         │                    │
│  └─────────┘    └───────────┘    └─────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

**Tauri Configuration** (`tauri.conf.json`):
- Product Name: "Logic Proof Trainer"
- Identifier: `com.logicprooftrainer.app`
- Window: 1200x800 initial, 900x600 minimum, resizable
- `withGlobalTauri: true` for IPC access

---

## Logical System

The app implements a natural deduction proof system for propositional logic.

### Symbols

| Symbol | Meaning | ASCII Input Aliases |
|--------|---------|---------------------|
| `⊃` | Implies (conditional) | `->`, `=>`, `>`, `⊃` |
| `∨` | Or (disjunction) | `\|`, `v`, `V`, `∨` |
| `·` | And (conjunction) | `&`, `.`, `^`, `*`, `·` |
| `~` | Not (negation) | `~`, `!`, `¬`, `-` |
| `≡` | Biconditional | `<->`, `<=>`, `<>`, `≡` |
| `⊥` | Contradiction | `_\|_`, `⊥`, `#` |

Brackets `()`, `[]`, `{}` are all accepted interchangeably by the parser.

### Valid Argument Forms (Inference Rules 1-9)

| # | Name | Abbrev | Pattern | Notes |
|---|------|--------|---------|-------|
| 1 | Modus Ponens | MP | p ⊃ q, p ∴ q | Tries both orderings |
| 2 | Modus Tollens | MT | p ⊃ q, ~q ∴ ~p | Tries both orderings |
| 3 | Disjunctive Syllogism | DS | p ∨ q, ~p ∴ q | Also handles ~q ∴ p |
| 4 | Simplification | Simp | p · q ∴ p (or q) | Returns both conjuncts |
| 5 | Conjunction | Conj | p, q ∴ p · q | |
| 6 | Hypothetical Syllogism | HS | p ⊃ q, q ⊃ r ∴ p ⊃ r | Tries both orderings |
| 7 | Addition | Add | p ∴ p ∨ q | Returns both p∨q and q∨p; requires additional formula input |
| 8 | Constructive Dilemma | CD | p ∨ q, p ⊃ r, q ⊃ s ∴ r ∨ s | Tries all 6 permutations of 3 premises |
| 9 | Contradiction Introduction | NegE | p, ~p ∴ ⊥ | Tries both orderings |

Each rule exposes: `all_conclusions()` (all valid conclusions), `apply()` (first valid), `verify()` (check specific conclusion).

### Valid Equivalence Forms (Rules 10-19)

| # | Name | Abbrev | Pattern |
|---|------|--------|---------|
| 10 | Double Negation | DN | p :: ~~p |
| 11 | DeMorgan's Theorem | DeM | ~(p · q) :: (~p ∨ ~q), ~(p ∨ q) :: (~p · ~q) |
| 12 | Commutation | Comm | (p ∨ q) :: (q ∨ p), (p · q) :: (q · p) |
| 13 | Association | Assoc | [p ∨ (q ∨ r)] :: [(p ∨ q) ∨ r], and for · |
| 14 | Distribution | Dist | [p · (q ∨ r)] :: [(p · q) ∨ (p · r)], [p ∨ (q · r)] :: [(p ∨ q) · (p ∨ r)] |
| 15 | Contraposition | Contra | (p ⊃ q) :: (~q ⊃ ~p) |
| 16 | Implication | Impl | (p ⊃ q) :: (~p ∨ q) |
| 17 | Exportation | Exp | [(p · q) ⊃ r] :: [p ⊃ (q ⊃ r)] |
| 18 | Tautology | Taut | p :: (p · p), p :: (p ∨ p) |
| 19 | Equivalence | Equiv | (p ≡ q) :: [(p ⊃ q) · (q ⊃ p)] |

All equivalence rules are bidirectional. Transformations can be applied to top-level formulas or to subformulas. The verifier uses `replace_subformula()` (structural equality matching) to validate user-applied equivalence rules. The generator uses `replace_at_path()` (positional path matching) to apply transforms to individual subtree occurrences during obfuscation, preventing identical subtrees from being transformed in lockstep.

### Proof Techniques

| Name | Abbrev | Description |
|------|--------|-------------|
| Conditional Proof | CP | Assume p, derive q, conclude p ⊃ q |
| Indirect Proof | IP | Assume p, derive contradiction (⊥ or q · ~q), conclude ~p (or vice versa) |

**Note**: IP handles both directions:
- Assume `p`, derive contradiction → conclude `~p`
- Assume `~p`, derive contradiction → conclude `p`

A contradiction can be either `⊥` or a conjunction like `A · ~A` (checked by the public `is_contradiction()` function).

---

## Project Structure

```
logic-proof-trainer/
├── src-tauri/                       # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                  # Entry point → lib::run()
│       ├── lib.rs                   # Command registration (27 commands)
│       ├── commands.rs              # 27 IPC command handlers
│       ├── models/
│       │   ├── mod.rs               # Re-exports all models
│       │   ├── formula.rs           # Formula AST, parser, SharedFormula
│       │   ├── theorem.rs           # Theorem + Difficulty + Theme (13 themes)
│       │   ├── proof.rs             # Proof, ProofLine, Justification, auto-close
│       │   ├── scope.rs             # ScopeManager for subproofs
│       │   ├── statistics.rs        # User statistics (last 50 attempts)
│       │   └── rules/
│       │       ├── mod.rs           # Re-exports rules
│       │       ├── inference.rs     # 9 inference rules
│       │       ├── equivalence.rs   # 10 equivalence rules
│       │       └── technique.rs     # CP, IP techniques + is_contradiction()
│       └── services/
│           ├── verifier.rs          # Proof step validation + case-sensitivity hints
│           ├── generator.rs         # Dual-mode generation orchestrator
│           ├── tree_gen/            # Backward proof tree construction (module)
│           │   ├── mod.rs           # Module exports
│           │   ├── context.rs       # ConstructionContext, RequiredTechniques, TreeGenConfig
│           │   ├── backward.rs      # Backward construction algorithm
│           │   ├── builder.rs       # ProofTreeGenerator (dual-strategy + fallback)
│           │   └── templates.rs     # FallbackTemplates (10 hand-crafted patterns)
│           ├── proof_tree.rs        # ProofNode/ProofTree + DegenerateProofError (14 types)
│           ├── fragments.rs         # 12 composable proof fragments + FragmentSpec
│           ├── truth_table.rs       # 32-bit semantic validation + forcing functions
│           ├── proof_search.rs      # Backward proof search + difficulty analysis
│           ├── obfuscate_gen.rs     # 3-layer equivalence obfuscation
│           ├── dependency.rs        # Line dependency tracking (bidirectional graph)
│           └── storage.rs           # JSON file persistence + security validation
├── src/                             # React frontend
│   ├── main.tsx
│   ├── App.tsx                      # Main app + sidebar navigation + auto-view switching
│   ├── setupTests.ts                # Vitest setup + Tauri mock
│   ├── types/
│   │   ├── index.ts                 # TypeScript types + formulaToString + display helpers
│   │   └── index.test.ts            # Unit tests (13 tests)
│   ├── utils/
│   │   ├── proofCommandParser.ts    # Unified proof command parser (40+ aliases)
│   │   └── proofReorder.ts          # Drag-drop validation + line reordering logic
│   ├── hooks/
│   │   ├── useProof.ts              # Proof state (18 actions, Zustand)
│   │   ├── useProof.test.ts         # Unit tests (19 tests)
│   │   ├── useProofAutoApply.ts     # Auto-apply with race condition guard
│   │   ├── useProofGoals.ts         # Subproof goal tracking (session-only)
│   │   ├── useProofTimer.ts         # Ref-based timing + auto-save on completion
│   │   ├── useTheorems.ts           # Theorem state + CURATED_EXAMPLES
│   │   ├── usePortfolio.ts          # Portfolio state with optimistic updates
│   │   ├── useTheme.ts              # Theme + bracket settings (4 toggles, persisted)
│   │   └── useScratchpad.ts         # Scratchpad state (10 actions)
│   ├── components/
│   │   ├── ErrorBoundary.tsx        # Class component, catches errors, reload button
│   │   ├── FormulaDisplay.tsx       # Color-coded brackets, collapsible, SVG connector lines
│   │   ├── shared/
│   │   │   └── SymbolToolbar.tsx    # Shared symbol toolbar (compact mode, optional atoms)
│   │   ├── TheoremList/
│   │   │   ├── TheoremList.tsx      # Theorem browser + unified difficulty mode
│   │   │   └── CustomTheoremModal.tsx # Custom theorem creator + cursor-aware symbol insert
│   │   ├── ProofWorkspace/
│   │   │   ├── ProofWorkspace.tsx   # Main proof editor + unified input routing
│   │   │   ├── FitchBox.tsx         # Fitch-style display + @dnd-kit drag-drop
│   │   │   ├── ProofLine.tsx        # Individual proof line + SortableProofLine variant
│   │   │   ├── RulePalette.tsx      # Rule selection panel (3 sections)
│   │   │   └── FormulaInput.tsx     # Formula input + auto-symbol replacement
│   │   ├── Scratchpad/
│   │   │   ├── Scratchpad.tsx       # Two-mode sandbox (formula/note tabs)
│   │   │   └── index.ts
│   │   ├── Portfolio/
│   │   │   └── Portfolio.tsx        # Three-column view + global notepad (500ms debounce)
│   │   └── Settings/
│   │       └── Settings.tsx         # Theme + bracket color/lines/collapse toggles
│   └── styles/
│       └── main.css                 # CSS custom properties, 2 themes, responsive layout
├── package.json
├── tsconfig.json
├── vitest.config.ts                 # Vitest: jsdom environment, globals, setup file
├── vite.config.ts                   # Port 1420, HMR on 1421, ignores src-tauri/
├── architecture.md                  # 3-layer theorem generation architecture overview
├── CLONE_OPTIMIZATION.md            # Performance optimization notes
├── problems.md                      # Known issues
└── issues.md                        # Issue tracking
```

---

## Backend (Rust)

### Models

**Formula** (`models/formula.rs`):
```rust
pub enum Formula {
    Atom(String),                        // P, Q, R
    Not(Box<Formula>),                   // ~P
    And(Box<Formula>, Box<Formula>),     // P · Q
    Or(Box<Formula>, Box<Formula>),      // P ∨ Q
    Implies(Box<Formula>, Box<Formula>), // P ⊃ Q
    Biconditional(Box<Formula>, Box<Formula>), // P ≡ Q
    Contradiction,                       // ⊥
}

pub type SharedFormula = Arc<Formula>;   // Shared ownership via Arc
```

Key methods:
- `parse(input: &str) -> Result<Formula, ParseError>` — Parser with safety limits
- `display_string()` — Logic notation (`. ∨ ⊃ ≡`) with bracket hierarchy: `()` → `[]` → `{}`
- `ascii_string()` — ASCII representation (`& | -> <->`) with precedence-based brackets
- `ascii_string_bracketed()` — ASCII operators with alternating bracket hierarchy (used by PropBench for LLM-facing output; every binary subexpression explicitly bracketed, no precedence reliance)
- `atoms() -> HashSet<String>` — All atomic propositions
- `depth() -> usize` — Nesting level
- `main_connective() -> Option<&'static str>` — Top-level connective
- `subformulas() -> Vec<Formula>` — All subformulas including self (cloned, no positional info)
- `subformulas_with_paths() -> Vec<(Vec<PathStep>, &Formula)>` — All subformulas with their positional paths from root (used by the generator for targeted single-node replacement)
- `replace_at_path(path, replacement) -> Formula` — Replace the node at a specific AST path, leaving all other nodes untouched (used by the generator to avoid lockstep replacement of structurally-identical subtrees)
- `substitute(name, replacement) -> Formula` — Variable substitution
- `negate() -> Formula` — Create negation
- `truth_table() -> u32` — 32-bit truth table
- `shared() / from_shared()` — Arc conversion methods
- `replace_subformula(target, replacement) -> Formula` — Replace all occurrences of target subformula with replacement (structural equality matching, used by the verifier for equivalence rule validation)
- `is_negation()`, `negated_inner()`, `equals()` — Utility predicates

**PathStep** (`models/formula.rs`):
```rust
pub enum PathStep {
    Inner,  // into Not
    Left,   // left child of binary op
    Right,  // right child of binary op
}
```

Used by `subformulas_with_paths()` and `replace_at_path()` to identify specific nodes in the formula AST by position rather than by structural equality. This enables the obfuscation generator to transform a single occurrence of a repeated subtree without affecting all other identical occurrences. The verifier continues to use structural equality via `replace_subformula()`.

**Parser Safety Limits**:
- Maximum input length: 10,000 characters (Unicode code points)
- Maximum nesting depth: 100 levels (applies to all constructs: negations, binary operators, and parentheses)
- Atom names: ASCII alphanumeric characters, underscores, and apostrophes only

**Theorem** (`models/theorem.rs`):
```rust
pub struct Theorem {
    pub id: String,
    pub premises: Vec<Formula>,
    pub conclusion: Formula,
    pub difficulty: Difficulty,            // Easy, Medium, Hard, Expert (legacy 4-level)
    pub difficulty_value: u8,              // 1-100
    pub tier: Option<DifficultyTier>,      // 10-tier system (Baby..Mind), set by generate_theorem_by_tier
    pub theme: Option<Theme>,             // 13 theme variants (see below)
    pub name: Option<String>,
    pub is_classic: bool,
}
```

Default difficulty midpoints: Easy=13, Medium=35, Hard=58, Expert=85. The `tier` field is `None` for legacy-generated theorems and `Some(tier)` for theorems generated via the 10-tier system. `DifficultyTier::to_legacy_difficulty()` maps tiers to the legacy Difficulty: Baby/Easy -> Easy, Medium -> Medium, Hard -> Hard, Expert+ -> Expert.

**Theme enum** (13 variants): ModusPonens, ModusTollens, HypotheticalSyllogism, DisjunctiveSyllogism, ConstructiveDilemma, Conjunction, Disjunction, DoubleNegation, Biconditional, ConditionalProof, IndirectProof, Equivalence, Mixed. Each theme corresponds to the primary proof technique or rule demonstrated by the theorem.

**Classic Theorems** (`get_classic_theorems()` — 13 theorems):
1. Modus Ponens: P ⊃ Q, P ⊢ Q (Easy)
2. Modus Tollens: P ⊃ Q, ~Q ⊢ ~P (Easy)
3. Hypothetical Syllogism: P ⊃ Q, Q ⊃ R ⊢ P ⊃ R (Easy)
4. Disjunctive Syllogism: P ∨ Q, ~P ⊢ Q (Easy)
5. Constructive Dilemma: (P ⊃ Q) · (R ⊃ S), P ∨ R ⊢ Q ∨ S (Medium)
6. Law of Excluded Middle: ⊢ P ∨ ~P (Medium, requires IP)
7. Double Negation Elimination: ~~P ⊢ P (Easy)
8. Contraposition: P ⊃ Q ⊢ ~Q ⊃ ~P (Medium, requires CP)
9. De Morgan (And to Or): ~(P · Q) ⊢ ~P ∨ ~Q (Hard)
10. De Morgan (Or to And): ~(P ∨ Q) ⊢ ~P · ~Q (Hard)
11. Material Implication: P ⊃ Q ⊢ ~P ∨ Q (Medium)
12. Exportation: (P · Q) ⊃ R ⊢ P ⊃ (Q ⊃ R) (Hard, requires CP)
13. Peirce's Law: ⊢ ((P ⊃ Q) ⊃ P) ⊃ P (Expert, requires IP)

**DifficultySpec** (`models/theorem.rs` — used by PropBench CLI):
```rust
pub enum BaseComplexity { Simple, Complex }

pub struct DifficultySpec {
    pub variables: u8,                      // 2-255 (u8 max, uncapped)
    pub passes: u8,                         // 1-255 (u8 max, uncapped)
    pub transforms_per_pass: u8,            // 1-255 (u8 max, uncapped)
    pub base_complexity: BaseComplexity,
    pub substitution_depth: u8,             // 0-255 (u8 max, uncapped)
    pub max_formula_nodes: Option<u32>,     // None = default (20,000)
    pub bridge_atoms: Option<u8>,           // None = default for tier, Some(n) = n bridge atoms
}

pub enum DifficultyTier {
    Baby, Easy, Medium, Hard, Expert, Nightmare, Marathon, Absurd, Cosmic, Mind,
}
```

DifficultySpec provides fine-grained control over theorem generation parameters. Tier presets are stored in `prop-bench/tier-presets.json` and served via API for GUI usage (see table below). `DifficultySpec::from_tier()` provides Rust-side defaults for all 10 tiers. `DifficultySpec::from_difficulty_value()` bridges the legacy 1-100 scale. The `Theorem` struct now includes an optional `tier: Option<DifficultyTier>` field that is set when generated via `generate_theorem_by_tier`, providing the frontend with the exact tier used. The legacy `Difficulty` enum (4 levels) is preserved for backward compatibility via `DifficultyTier::to_legacy_difficulty()`.

**Bridge atoms**: During obfuscation, the substitution layer partitions remaining atoms into groups, with each group replacing one base form atom. Bridge atoms are special variables that appear in multiple partition groups (typically 2), creating cross-zone logical dependencies. This prevents LLMs from decomposing theorems into independent subproblems, forcing integrated reasoning across the entire formula.

**Proof** (`models/proof.rs`):
```rust
pub struct Proof {
    pub id: String,
    pub theorem: Theorem,
    pub lines: Vec<ProofLine>,
    pub scope_manager: ScopeManager,
    pub is_complete: bool,
}

pub enum Justification {
    Premise,
    Assumption { technique: ProofTechnique },
    Inference { rule: InferenceRule, lines: Vec<usize> },
    Equivalence { rule: EquivalenceRule, line: usize },
    SubproofConclusion { technique, subproof_start, subproof_end },
}
```

Key methods:
- `check_complete()` — Checks: no open scopes, conclusion at depth 0, all lines valid
- `accessible_lines()` — Line numbers accessible from current position
- `get_auto_close_conclusion() -> Option<(ProofTechnique, Formula)>` — Auto-detects if current subproof can be closed (IP: searches for ANY contradiction in scope; CP: uses last line)
- `referenced_lines()` on Justification — All line numbers referenced

**ScopeManager** (`models/scope.rs`):
- Manages nested subproof scopes
- `is_accessible(from_line, to_line)` — Scope-based accessibility checking
- `is_subproof_accessible(from_line, start, end)` — Entire subproof accessibility

**UserStatistics** (`models/statistics.rs`):
- Tracks attempts, completions, streaks, per-difficulty and per-theme stats
- Recent attempts limited to last 50 entries
- Streak logic: same day continues, consecutive day increments, gap > 1 day resets to 1

### Services

**Verifier** (`services/verifier.rs`):
- Validates each proof step against its cited justification
- Checks line accessibility within scopes
- Propagates invalidity to dependent lines via `verify_proof()` (mutates `is_valid` and `validation_message`)
- Equivalence rules checked at top-level first, then recursively through subformulas
- Case-sensitivity hint: if validation fails but lowercased versions match, provides a helpful error message

**Generator** (`services/generator.rs`):
- Dual-mode theorem generation orchestrator
- Easy difficulty: legacy template-based generation (8 theme templates)
- Medium+: obfuscation-based generation via `ObfuscateGenerator`
- `GeneratedTheorem` struct pairs a `Theorem` with its `ProofTree`
- Difficulty value mapping: 1-25 Easy, 26-45 Medium, 46-70 Hard, 71-100 Expert
- Random formula generation with weighted probabilities (Atom 30%, Negation 15%, Conjunction 15%, Disjunction 15%, Implication 20%, Biconditional 5%)

**TreeGen** (`services/tree_gen/` — 4-file module):

`context.rs`:
- `RequiredTechniques` — Tracks CP/CaseSplit/IP requirements and usage, enforces nesting (cp_inside_case_split, case_split_inside_cp)
- `TreeGenConfig` — Scaling parameters from difficulty value (1-100):
  - atom_count: 2-5, target_fragments: 2-12, max_nesting: 1-5
  - min_fragments: 1-8, min_proof_steps: 1-7
  - require_forces_cp: d≥30, require_forces_case_split: d≥50, require_forces_ip: false (future)
- `ConstructionContext` — Premises, assumptions, combined truth table, depth budget
- `GenerationError` — 6 variants: TrivialCP, DSAvailable, DepthExhausted, NoPremiseAvailable, RequirementsNotMet, CannotProve

`backward.rs`:
- `backward_construct(goal, context, rng)` — Main backward construction algorithm
- Shape-based rule selection: implications → CP (70%), conjunctions → Conj, disjunctions → Add/CD/DS, negations → NegIntro/MT, atoms → MP/DS/Simp
- Critical CP check: premises alone must NOT entail consequent (prevents trivial CP)
- Critical CaseSplit check: neither ~left nor ~right should be committable (prevents DS availability)
- Subproof contexts cloned for isolation, premises merged back on success

`builder.rs`:
- `ProofTreeGenerator` — Dual-strategy generation with fallback (MAX_RETRIES = 50)
  1. First half: backward construction attempts
  2. Second half: forward construction attempts
  3. Fallback: hand-crafted template theorems
- Goal shaping for CP: 4 patterns (conjunction→conjunction, nested implication, disjunction→atom, simple)
- Validates generated trees against difficulty requirements

`templates.rs`:
- `FallbackTemplates` — 10 hand-crafted theorem patterns
  - 4 case split variants (convergent chains, conjunction conclusions, simp-first, asymmetric)
  - 3 CP variants (paired conditionals, preservation, forced-not-HS)
  - 3 basic variants (MP chain, simple MP, DS+MP)

**ProofTree** (`services/proof_tree.rs`):
- `ProofNode`: Premise | Assumption | Derivation (with rule, children, optional assumption)
- `ProofTree`: root node + fragment_count + max_nesting
  - `validate()` / `validate_with_difficulty()` — Delegates to truth table validation
  - `pretty_print()` — Indented tree structure for debugging
- `DegenerateProofError` (14 variants): ContradictoryPremises, TautologicalConclusion, TautologicalPremise, SinglePremiseEntails, NegationOfConclusionAvailable, ConditionalTrivialViaExplosion, RedundantPremises, UnnecessaryPremise, InvalidTheorem, TooEasy, NoSubproofRequired, DoesNotForceCP, DoesNotForceCaseSplit, DoesNotForceIP

**Fragments** (`services/fragments.rs`):
- 12 composable proof fragments: 8 basic (MP, MT, HS, DS, Simp, Conj, Add, CD) + 4 nesting (CP, IP, NegIntro, CaseSplit)
- `FragmentSpec` — child count and discharge info per fragment (MP/MT/HS/DS/Conj: 2 children; Simp/Add/CP/IP/NegIntro: 1 child; CD/CaseSplit: 3 children)
- `fragments_for_goal(formula)` — Returns applicable fragments based on formula shape (always includes MP, DS, Simp, IP, CaseSplit as universally applicable)

**TruthTable** (`services/truth_table.rs`):
- **u32 engine** (≤5 variables): 32-bit truth table computation for variables P, Q, R, S, T
- Core: `compute_truth_table()`, `is_tautology()`, `is_contradiction()`, `are_equivalent()`
- Semantic: `entails()`, `premises_consistent()`, `single_premise_entails()`, `all_premises_necessary()`, `has_redundant_premises()`
- Forcing functions: `forces_cp()` (conclusion is A⊃B and premises don't entail B), `forces_case_split()` (disjunction without negation of disjuncts), `forces_ip()` (atomic/negation conclusions)
- Degenerate checks: `conclusion_negation_available()`, `conditional_trivial_via_explosion()`
- `validate_theorem()` / `validate_theorem_with_difficulty()` — Combined validation
- **DynTruthTable engine** (2-20 variables): `Vec<u64>` bitvector-based truth tables for formulas with more than 5 variables
  - `DynTruthTable::new_var(index, num_vars)` — Alternating bit pattern for variable at index
  - `DynTruthTable::tautology(num_vars)` / `::contradiction(num_vars)` — Constant tables
  - Bitwise ops: `not()`, `and()`, `or()`, `implies()`, `biconditional()`
  - `is_tautology()`, `is_contradiction()`, `eq()` — Semantic checks
  - `collect_sorted_atoms()` — BTreeSet-based alphabetical atom collection
  - `compute_truth_table_dynamic()` — Recursive evaluation with atom-to-index mapping
  - `is_tautology_dynamic()` — Auto-dispatches: uses fast u32 path for ≤5 standard atoms (P,Q,R,S,T), dynamic path otherwise

**ProofSearch** (`services/proof_search.rs`):
- `prove_backward(premises, goal, max_depth, visited)` — Backward proof search with cycle detection (truth table hashing)
- `prove_backward_basic_only()` — Same but without CP/IP (for testing if subproofs needed)
- `ProofResult` — { found, rules_used, steps, used_cp, used_ip, used_disj_elim }
- `DifficultyRequirements` — { min_steps, min_distinct_rules, requires_cp_or_ip, requires_disj_elim }
  - easy: 2 steps, 1 rule; medium: 3 steps, 2 rules; hard: 5 steps, 3 rules + CP/IP; expert: 7 steps, 4 rules + CP/IP + disjunction elim
- `minimum_proof_steps()`, `analyze_proof()`, `meets_difficulty()`, `requires_subproof()`
- Implements 11 backward rules: MP, MT, DS, HS, Simp, Conj, Add, DN (4 variations), CP, IP

**ObfuscateGen** (`services/obfuscate_gen.rs`):
- 3-layer theorem generation for Medium+ difficulty:
  1. **Layer 1 — Base Forms**: Generate simple valid argument (MP, MT, HS, DS, Simp, Conj, CD; plus ConstructiveDilemmaFull, NestedCP, Chain4 for difficulty ≥70)
  2. **Layer 3 — Atom Substitution** (difficulty ≥70): Replace atoms with complex formulas built from remaining pool atoms (partitioned evenly, guaranteed coverage of all partition atoms)
  3. **Layer 2 — Wrap + Transform**: Combine as (P₁∧P₂∧...)⊃C tautology, apply N random equivalence transformations
- **Positional replacement**: Equivalence transforms use `subformulas_with_paths()` + `replace_at_path()` to target individual AST nodes by position. This ensures that when a formula contains multiple structurally-identical subtrees (common at high difficulty), each occurrence can be independently transformed, producing diverse output instead of repetitive patterns.
- **Pool-based atom substitution with guaranteed coverage**: The substitution layer uses remaining atoms from the configured atom pool (not a hardcoded A-Z sequence), partitioned evenly among the base form's atoms. Each partition includes its original base atom (e.g., P's partition is {P, S, T}), ensuring the base atoms are preserved in the final formula alongside the new ones. Each replacement formula guarantees every partition atom appears at least once via a seed + random growth approach. Variable counts are kept low (max 7) since more atoms spread formulas thinner without adding proof difficulty.
- **Bridge atoms**: When `bridge_atoms > 0`, the substitution layer selects N atoms from the remaining pool as 'bridges'. After partitioning non-bridge atoms evenly, each bridge atom is added to 2 randomly-chosen distinct partition groups. This creates cross-zone logical interdependencies, preventing LLMs from decomposing the problem into independent subproblems. Bridge atom scaling by tier: 0 for Easy-Expert, 1 for Nightmare/Marathon/Absurd, 2 for Cosmic/Mind.
- **Complex-only base forms** (Hard+): When `base_complexity` is Complex, only CDFull, NestedCP, and Chain4 are used — standard forms (MP, Simp, etc.) are excluded to ensure harder proof structures.
- **Gnarly combos** (difficulty ≥85): Forces hard patterns like Contraposition+DeMorgan chains, Implication+Distribution combos
- Simplification pass collapses excessive negations (~~~~P → P)
- Tautology protection: only allows contraction (P∨P → P), not expansion
- **Multi-pass spec-based generation** (`generate_with_spec()` / `generate_with_tier()`):
  - `ObfuscateConfig::from_spec()` maps DifficultySpec fields to config
  - `build_atom_pool(n)` creates variable pools for >5 variables (P,Q,R,S,T + A,B,C,D,E,F,G,H...)
  - `run_spec_pipeline()` — shared core: generate base → substitute → wrap as tautology → (transform + verify) × N passes
  - `generate_with_tier(tier)` — accepts a `DifficultyTier`, creates spec via `DifficultySpec::from_tier()`, sets `tier` field on returned Theorem
  - `generate_with_spec(spec)` — accepts a raw `DifficultySpec` (used by PropBench), returns Theorem without tier field
  - `check_tautology()` auto-dispatches between u32 and dynamic truth table engines
  - Safety bounds: `MAX_FORMULA_DEPTH=100`, `MAX_FORMULA_NODES=10,000` prevent blowup
  - `base_complexity`: Simple uses standard base forms only; Complex includes ConstructiveDilemmaFull, NestedCP, Chain4

**Dependency** (`services/dependency.rs`):
- Bidirectional dependency graph (dependencies + dependents for O(1) lookups)
- `cascade_invalidation(line)` — Returns all transitively affected lines via BFS
- `has_cycle()` — DFS-based cycle detection
- `topological_order()` — Kahn's algorithm

**Storage** (`services/storage.rs`):
- JSON persistence to OS data directory
- `PortfolioEntry` — proof + saved_at (serde alias from completed_at) + timing + notes
- `ExportData` — combined export of proofs, theorems, statistics, portfolio
- Constants: `MAX_NOTES_LENGTH = 10,000`, `MAX_NAME_LENGTH = 200`
- Security: path traversal validation, delete verification, meaningful error messages

---

## Frontend (React/TypeScript)

### Formula Display (`types/index.ts`)

The `formulaToString` function renders formulas with appropriate bracketing for clarity.

**Bracket Hierarchy**: innermost `()` → middle `[]` → outermost `{}`

**Bracket Rules**:
- **Atoms and contradictions**: Never wrapped
- **Negations**: Chain without parentheses (`~~P`, `~~~Q`), only wrap binary operators inside (`~(P · Q)`)
- **Binary operators** (And, Or, Implies, Biconditional): Always wrapped when they appear as operands of other binary operators

**Display Info Constants**: `inferenceRuleInfo`, `equivalenceRuleInfo`, `proofTechniqueInfo` — Maps rule enums to { name, abbreviation, symbol/premises }.

**Helper Functions**: `justificationToString()`, `difficultyColor()` (green/orange/red/purple).

### Command Parser (`utils/proofCommandParser.ts`)

Unified parser supporting 6 command formats with 40+ rule aliases:

**Inference aliases** (15+): MP, modus, ponens, MT, tollens, DS, disj, HS, hyp, syl, Simp, Conj, Add, CD, NegE, contradiction...
**Equivalence aliases** (11+): DN, DeM, demorgan, morgan, dm, Comm, Assoc, Dist, Contra, contrap, trans, Impl, Exp, Taut, Equiv...
**Technique aliases** (8+): CP, conditional, IP, indirect, raa, ~I, NI, ~i, ni...

**Parsing priority**:
1. Just technique name → subproof close (auto-detect)
2. Line range + technique → subproof close with range
3. Formula + technique (no digits) → subproof open
4. `FORMULA LINES RULE` → rule application
5. `RULE LINES [FORMULA]` → rule application
6. Legacy `//` format → parsed appropriately

`isKnownRule(abbrev)` utility returns `'inference' | 'equivalence' | 'technique' | null`.

### Proof Reorder (`utils/proofReorder.ts`)

Drag-and-drop validation and line reordering logic for FitchBox:
- `canMoveLine(proof, fromLineNumber, toPosition) -> { valid, reason? }` — Validates move constraints
- `reorderLines(proof, fromLineNumber, toPosition) -> Proof | null` — Performs reorder with renumbering

**Constraints**: Cannot move premises, assumptions, or subproof conclusions. Line must remain after its dependencies. Dependent lines must remain after the moved line. Line cannot leave its subproof scope. After reorder, all line numbers and justification references are updated.

### State Management (Zustand)

**useProof** (main proof state):
- State: `proof`, `selectedLines`, `isLoading`, `error`, `hint`
- Actions (18): `createProof`, `loadProof`, `clearProof`, `saveProof`, `applyInferenceRule` → `Promise<boolean>`, `applyEquivalenceRule` → `Promise<boolean>`, `openSubproof` → `Promise<boolean>`, `closeSubproof` → `Promise<boolean>`, `undoLine`, `reorderProof`, `renameProof`, `selectLine`, `toggleLineSelection` (maintains sorted order), `clearSelection`, `clearLineSelection` (alias), `getHint`, `setError`, `clearError`

**useProofAutoApply** (auto-apply logic):
- Race condition guard (`pendingAutoApplyRef`) prevents concurrent operations
- Inference: auto-applies if selected line count matches rule's required premise count; excludes Addition (requires formula input)
- Equivalence: fetches all transformations via backend, auto-applies if exactly 1 match; if multiple, suggests first in input field
- Case-insensitive rule matching

**useProofGoals** (subproof goals):
- Tracks user-defined goals per scope in `scopeGoals: Record<string, string>`
- Detects new scopes via `prevScopeCountRef` change tracking
- Goals are session-only (not persisted to backend), optional (can be skipped)
- Returns: `scopeGoals`, `pendingGoalScopeId`, `goalInput`, `setGoalInput`, `handleGoalSubmit`, `handleGoalSkip`

**useProofTimer** (timing + portfolio):
- Ref-based state: `startTimeRef`, `hintsUsedRef`, `savedToPortfolioRef`
- Starts timer when proof exists and is incomplete
- Auto-saves on completion with duplicate prevention (`savedToPortfolioRef !== proof.id`)
- Returns: `incrementHintsUsed`, `getTimeSpent` (seconds), `getHintsUsed`

**useTheorems**:
- State: `customTheorems`, `selectedTheorem`, `isLoading`, `error`
- `CURATED_EXAMPLES`: Record<Difficulty, { theorem, description }> — Easy: Modus Ponens (d=15), Medium: Contraposition (d=35), Hard: De Morgan (d=55), Expert: Peirce's Law (d=85)
- Actions: `loadCustomTheorems`, `generateTheorem(difficulty)`, `generateTheoremWithValue(1-100)`, `selectTheorem`, `saveCustomTheorem` (optimistic append)

**usePortfolio**:
- State: `entries`, `selectedEntry`, `isLoading`, `error`
- Actions: `loadPortfolio`, `saveToPortfolio` (prepends newest first), `deleteEntry` (auto-clears selection), `updateNotes` (optimistic update with rollback), `renameEntry` (optimistic update with rollback), `selectEntry`, `clearError`

**useTheme** (persisted to localStorage via Zustand persist):
- State: `theme` ('dark' | 'high-contrast'), `coloredBrackets` (default true), `showBracketLines` (default false), `collapsibleBrackets` (default true)
- Actions: `setTheme`, `toggleHighContrast`, `toggleColoredBrackets`, `toggleShowBracketLines`, `toggleCollapsibleBrackets`
- Sets `data-theme` attribute on `document.documentElement`; rehydrates on page load

**useScratchpad**:
- State: `lines` (ScratchpadLine[]), `selectedLineId`, `availableTransformations`, `copiedFormula`, `isLoading`, `error`
- Line types: 'formula' (validated, transformable) or 'note' (unvalidated, no transformations)
- Actions (10): `addFormula` (validates via backend, auto-selects), `addNote`, `applyTransformation` (auto-selects result), `selectLine` (fetches transformations for formula lines only), `removeLine`, `clearAll`, `copyToClipboard` (navigator.clipboard), `copyToProof` (sets copiedFormula), `clearCopiedFormula`, `clearError`
- Line IDs: module-level counter `scratch-${++lineIdCounter}`

### Components

**Component Dependency Graph:**
```
App (ErrorBoundary wraps all)
├── TheoremList (sidebar)
│   ├── FormulaDisplay
│   └── CustomTheoremModal → SymbolToolbar, FormulaDisplay
├── Scratchpad (sidebar) → SymbolToolbar (compact)
├── ProofWorkspace (main)
│   ├── FormulaDisplay (theorem)
│   ├── FitchBox → ProofLine/SortableProofLine → FormulaDisplay, ScopeBrackets
│   ├── FormulaInput → SymbolToolbar
│   └── RulePalette
├── Portfolio (main alt) → FitchBox (read-only), FormulaDisplay
└── Settings (modal overlay)
```

**App.tsx**: Main shell with collapsible sidebar (320px default, 60px collapsed). Three sidebar views: theorems, scratchpad, portfolio. Auto-switches to scratchpad when a new proof starts (detects proof change from null to non-null via `prevProofRef`). Settings modal as floating overlay.

**ErrorBoundary**: Class component wrapping entire app. Catches JavaScript errors, displays fallback with `<details>` for error info, "Try Again" reloads page via `window.location.reload()`.

**FormulaDisplay**: Renders formulas with color-coded brackets and advanced features:
- `()` parentheses: never colored
- `[]` square brackets: always bracket color 1
- `{}` curly brackets: depth-based colors 2-8 (cycles through 7 colors)
- Collapsible brackets: click opening bracket to collapse contents to `▸`; state resets on formula change
- SVG connector lines: only for `{}` curly brackets, alternating above/below by depth (even=below, odd=above), stroke width/opacity decrease with depth
- Uses ResizeObserver for responsive line positioning; clears stale refs each render

**SymbolToolbar**: Stateless, shared across FormulaInput, CustomTheoremModal, Scratchpad. Symbols: ~, ·, ∨, ⊃, ≡, ⊥, (, ). Optional atom buttons: P, Q, R, S, T. Compact mode reduces size.

**TheoremList**: Displays 4 difficulty cards with curated examples. Unified difficulty mode handles both preset (Difficulty enum) and custom (1-100 value) in single state. "Generate New" creates theorem and auto-starts proof. "Custom" opens modal.

**CustomTheoremModal**: Dynamic premise list with add/remove. Real-time validation via `parse_formula`. Auto-symbol replacement (>, v, &, <>, ! → logic symbols). `focusedInput` state tracks which input has focus for cursor-aware symbol insertion. Auto-saves and auto-starts proof after creation. Maps difficulty: easy=20, medium=40, hard=60, expert=85.

**ProofWorkspace**: Main editor with unified input parsing via `parseCommand`. Handles both parser commands and legacy UI-based rule selection. Auto-close logic via `get_subproof_auto_close` backend command. Mode switching (apply/open/close) when technique selected. Inline proof renaming. Save Progress button for incomplete proofs. Uses `selectedLinesRef` to prevent stale closures in async handlers.

**FitchBox**: Fitch-style display with @dnd-kit drag-and-drop (PointerSensor 8px activation, KeyboardSensor). Lines that cannot be moved: premises, assumptions, subproof conclusions. Validates dependencies before allowing moves. New line animation tracking via `prevLineCountRef` + `newLineIds` Set (300ms). Scope visualization with brackets on right side. Inline goal input for new subproofs.

**ProofLine / SortableProofLine**: Renders line number, formula (via FormulaDisplay), justification, scope brackets. SortableProofLine wraps with drag handle (⋮⋮) only for draggable lines. Shows validation errors in red with tooltip. Goal badge above line if present.

**RulePalette**: Three sections: Valid Argument Forms (1-9, including NegE/Contradiction), Equivalence Forms (10-19), Conditional & Indirect Proof. Toggle selection (click deselects). Cross-category deselection. Shows "(click to close)" for open subproof techniques. `subproof-open` CSS class for visual indication.

**FormulaInput**: Controlled input with auto-symbol replacement (two-character first: `<>` → `≡`, then single: `>` → `⊃`, `v`/`V` → `∨`, `&` → `·`, `!` → `~`). Enter submits. Symbol toolbar inserts at cursor position via `inputRef` + `setTimeout` for cursor repositioning.

**Scratchpad**: Two-tab interface (Formula/Note). Formula mode: text input, validates via backend, shows transformations for selected line. Note mode: textarea (Enter submits, Shift+Enter for newlines). Copy to Proof copies formula to `copiedFormula` state for ProofWorkspace integration. Cannot copy notes.

**Portfolio**: Three-column layout (entry list | detail | global notepad). Two tabs: Completed (Review + Retry from scratch) and Incomplete (Resume). Incomplete entries have orange left border. Global notepad with 500ms debounced auto-save via `saveTimeoutRef`. Inline name editing with Enter/Escape support. Direct delete without confirmation. Time formatted as "Xm Ys".

**Settings**: Theme selection (Light Mode, High Contrast). Note: the `'dark'` theme key displays as "Light Mode" in the UI. Bracket settings (all conditional on coloredBrackets being enabled): colored brackets toggle, bracket lines toggle, collapsible brackets toggle. Bracket color legend showing all 8 colors. Example formula preview.

---

## Tauri Commands

### Theorem Commands
| Command | Parameters | Returns |
|---------|-----------|---------|
| `get_classic_theorems` | - | `Vec<Theorem>` (13 theorems) |
| `generate_theorem` | `difficulty: Difficulty` | `Theorem` |
| `generate_theorem_with_value` | `difficulty_value: u8 (1-100)` | `Result<Theorem>` |
| `generate_theorem_by_tier` | `tier: String` (e.g. "Baby", "Expert", "Mind") | `Result<Theorem>` — uses DifficultySpec multi-pass pipeline, sets `tier` field on returned Theorem |
| `generate_theorem_with_proof` | `difficulty: Difficulty` | `GeneratedTheorem` (theorem + proof tree) | **Note: defined in commands.rs but not registered in lib.rs invoke_handler — currently inaccessible from frontend** |

### Proof Commands
| Command | Parameters | Returns |
|---------|-----------|---------|
| `create_proof` | `theorem` | `Proof` |
| `apply_rule` | `proof, rule_application: RuleApplication, formula_str` | `Result<Proof>` |
| `open_subproof` | `proof, technique, assumption_str` | `Result<Proof>` |
| `close_subproof` | `proof, technique, conclusion_str` | `Result<Proof>` |
| `delete_line` | `proof, line_number` | `Result<Proof>` |
| `undo_line` | `proof` | `Proof` |
| `check_proof_complete` | `proof` | `Proof` |
| `get_hint` | `proof` | `String` |
| `get_subproof_auto_close` | `proof` | `Option<AutoCloseInfo>` |
| `parse_formula` | `input` | `Result<Formula>` |
| `get_all_transformations` | `formula_str` | `Result<Vec<TransformationResult>>` |

**Supporting Types:**
```rust
pub enum RuleApplication {
    Inference { rule: InferenceRule, lines: Vec<usize>, additional_formula: Option<String> },
    Equivalence { rule: EquivalenceRule, line: usize },
}

pub struct TransformationResult { rule, rule_name, rule_abbrev, result: String }
pub struct AutoCloseInfo { technique: String, conclusion: String }
```

### Storage Commands
| Command | Parameters | Returns |
|---------|-----------|---------|
| `save_proof` | `proof` | `Result<()>` |
| `load_proofs` | - | `Result<Vec<Proof>>` |
| `get_statistics` | - | `Result<UserStatistics>` |
| `save_custom_theorem` | `theorem` | `Result<()>` |
| `load_custom_theorems` | - | `Result<Vec<Theorem>>` |

### Portfolio Commands
| Command | Parameters | Returns | Notes |
|---------|-----------|---------|-------|
| `save_to_portfolio` | `proof, time_spent_secs?, hints_used` | `Result<PortfolioEntry>` | Accepts complete or incomplete proofs |
| `load_portfolio` | - | `Result<Vec<PortfolioEntry>>` | Sorted by `saved_at` descending |
| `get_portfolio_entry` | `id` | `Result<PortfolioEntry>` | |
| `delete_portfolio_entry` | `id` | `Result<()>` | Returns error if entry not found |
| `update_portfolio_notes` | `id, notes` | `Result<()>` | |
| `rename_portfolio_entry` | `id, name` | `Result<()>` | |

### Global Notes Commands
| Command | Parameters | Returns |
|---------|-----------|---------|
| `load_global_notes` | - | `Result<String>` |
| `save_global_notes` | `notes` | `Result<()>` |

Note: All portfolio and storage commands validate that `id` is a valid UUID format (alphanumeric with hyphens only) to prevent path traversal attacks.

---

## Data Flow

### Applying an Inference Rule
```
1. User selects lines [1, 3] in ProofWorkspace
2. User types "Q 1,3 MP" OR clicks MP in RulePalette (auto-applies if correct # of lines selected)
3. Frontend calls: invoke('apply_rule', { proof, rule_application, formula_str })
4. Backend validates rule application (verifier checks scope, line access, rule logic)
5. If valid: new ProofLine added, check completion
6. Frontend receives updated Proof, clears selection
```

### Applying an Equivalence Rule (Auto-Apply)
```
1. User selects line [2] containing "~~P"
2. User clicks DN in RulePalette
3. Frontend fetches all transformations, finds exactly one DN option: "P"
4. Auto-applies: invoke('apply_rule', { proof, equivalence: {rule: DN, line: 2}, formula_str: "P" })
5. If multiple options existed, first is shown in input field for user confirmation
```

### Opening a Subproof (CP)
```
1. User types "P CP" (or legacy "P //CP") or clicks CP in RulePalette
2. Frontend calls: invoke('open_subproof', { proof, technique, assumption_str })
3. Backend creates ProofScope, adds assumption line at depth+1
4. UI shows indented subproof with assumption
5. useProofGoals detects new scope, prompts for optional goal
```

### Auto-Closing a Subproof
```
1. User clicks CP/IP in RulePalette while subproof is open
2. Frontend calls: invoke('get_subproof_auto_close', { proof })
3. Backend returns AutoCloseInfo with technique and derived conclusion
4. Frontend calls: invoke('close_subproof', { proof, technique, conclusion })
5. Subproof closed, conclusion added at parent depth
```

### Completing a Proof
```
1. User derives conclusion at depth 0
2. Backend marks proof.is_complete = true
3. useProofTimer detects completion, auto-saves to portfolio (with duplicate prevention)
4. UI shows success message with glow animation
```

---

## Theorem Generation Pipeline

### Difficulty System

The following tier presets are defined in `prop-bench/tier-presets.json` and used by the PropBench GUI and API:

| Tier | Atoms | Passes | Transforms | Base Complexity | Substitution Depth | Bridge Atoms | Notes |
|------|-------|--------|------------|----------------|-------------------|--------------|-------|
| Easy | 3 | 1 | 5 | Simple | 0 | 0 | Template-based in Tauri app |
| Medium | 4 | 1 | 10 | Complex | 0 | 0 | Obfuscation-based |
| Hard | 5 | 1 | 15 | Complex | 2 | 0 | CP required |
| Expert | 5 | 2 | 15 | Complex | 3 | 0 | CP + CaseSplit |
| Nightmare | 5 | 3 | 15 | Complex | 4 | 1 | Gnarly combos |
| Marathon | 6 | 5 | 20 | Complex | 4 | 1 | Gnarly combos |
| Absurd | 7 | 10 | 20 | Complex | 4 | 1 | Spec-based |
| Cosmic | 7 | 20 | 24 | Complex | 4 | 2 | Spec-based |
| Mind | 7 | 50 | 50 | Complex | 10 | 2 | Spec-based, max difficulty |

Note: `DifficultySpec::from_tier()` in Rust provides slightly different fallback values for direct CLI usage without tier-presets.json.

### Generation Modes

**Easy (template-based):** 8 theme templates (MP, MT, HS, DS, Conj, CP, IP, Mixed) with random atoms.

**Medium+ (obfuscation-based — 3 layers):**
1. **Base Form**: Simple valid argument (7 standard + 3 complex for d≥70)
2. **Atom Substitution** (d>=70): Replace atoms with complex subformulas from pool partitions (guaranteed coverage, depth controlled by substitution_depth)
   - **Partition system**: Remaining pool atoms (after base form) are partitioned evenly among base atoms. Each partition includes its original base atom plus assigned pool atoms.
   - **Bridge atoms**: When `bridge_atoms > 0`, N atoms from the remaining pool are selected as bridges and placed into 2 randomly-chosen distinct partition groups each. This creates shared variables across zones, forcing integrated reasoning instead of decomposition.
   - **Guaranteed coverage**: Each replacement formula ensures all partition atoms appear at least once via seed + growth strategy.
3. **Wrap + Transform**: Combine as tautology, apply N equivalence transformations (gnarly combos at d≥85 force hard patterns like Contraposition+DeMorgan chains). **Weighted rule selection**: Distribution and Equivalence rules have 0.2 probability (vs 1.0 for others) to prevent exponential formula growth from duplicating entire subtrees

**Tree Generation (dual-strategy with fallback):**
1. First 25 attempts: backward construction (goal-directed)
2. Next 25 attempts: forward construction (fragment-based)
3. Fallback: 10 hand-crafted template theorems

### Semantic Validation

All generated theorems pass 14 degenerate proof checks:
- No contradictory premises or tautological conclusions
- No single-premise entailment or redundant premises
- Conclusion negation not directly available
- Not trivially solvable via explosion
- Minimum step count enforced
- Required techniques (CP, CaseSplit, IP) are genuinely forced

---

## Building and Running

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Development
```bash
npm install
npm run tauri dev    # Runs Vite dev server (port 1420) + Rust backend
```

### Production Build
```bash
npm run tauri build  # TypeScript compile + Vite build + Rust build + bundle
```

### Tests
```bash
# Backend tests
cd src-tauri && cargo test

# 236 total backend tests:
# - truth_table.rs: 48 tests (semantic checks, forcing conditions, dynamic bitvector engine)
# - obfuscate_gen.rs: 27 tests (config scaling, tautology preservation, substitution layers, bridge atoms, spec-based generation)
# - storage.rs: 21 tests (security/path traversal, CRUD, export/import, length limits)
# - formula.rs: 20 tests (parsing, display, bracket hierarchy, path operations)
# - verifier.rs: 18 tests (line validation, scope access, rule verification, case-sensitivity)
# - proof_tree.rs: 17 tests (tree structure, validation, pretty printing)
# - proof_search.rs: 16 tests (backward search, difficulty requirements, subproof detection)
# - generator.rs: 15 tests (config, difficulty mapping, theorem generation)
# - inference.rs: 8 tests (all 9 rules, permutation matching)
# - equivalence.rs: 8 tests (all 10 rules, bidirectional transforms)
# - technique.rs: 8 tests (CP, IP, contradiction detection)
# - tree_gen/builder.rs: 6 tests (generation per difficulty, premises, multiple)
# - scope.rs: 4 tests (nested scopes, accessibility)
# - proof.rs: 4 tests (subproofs, auto-close, scope management)
# - fragments.rs: 4 tests (fragment classification)
# - dependency.rs: 4 tests (cascade invalidation, cycle detection, topological order)
# - commands.rs: 4 tests (classic theorems, generation, proof completion)
# - theorem.rs: 2 tests (difficulty tiers, classic theorems)
# - statistics.rs: 2 tests (stats tracking, streaks)

# Frontend tests
npm run test        # Watch mode (Vitest)
npm run test:run    # Single run
npm run test:ui     # Vitest UI

# Frontend test breakdown:
# - types/index.test.ts: 13 tests (formulaToString, justificationToString, difficultyColor)
# - hooks/useProof.test.ts: 19 tests (state, createProof, selection, load/clear/reorder/rename)
```

---

## Dependencies

### Frontend (package.json)
**Runtime**: react ^18.2.0, react-dom ^18.2.0, zustand ^4.4.0, @tauri-apps/api ^2.0.0, @tauri-apps/plugin-shell ^2.0.0, @dnd-kit/core ^6.3.1, @dnd-kit/sortable ^10.0.0, @dnd-kit/utilities ^3.2.2

**Dev**: typescript ^5.0.0, vite ^5.0.0, vitest ^1.2.0, @vitest/ui ^1.2.0, @vitejs/plugin-react ^4.2.0, @tauri-apps/cli ^2.0.0, @testing-library/react ^14.1.0, @testing-library/jest-dom ^6.1.5, @testing-library/user-event ^14.5.1, jsdom ^24.0.0

### Backend (Cargo.toml)
**Runtime**: tauri 2, tauri-plugin-shell 2, serde 1 (derive), serde_json 1, uuid 1 (v4, serde), rand 0.8, chrono 0.4 (serde), dirs 5

**Dev**: tempfile 3

---

## Theme System

Two themes: **Dark** (default) and **High Contrast** (applied via `data-theme="high-contrast"` on root element).

**CSS Custom Properties**: `--bg-primary/secondary/tertiary`, `--text-primary/secondary`, `--accent`, `--success/warning/error`, `--border`, `--shadow`

**Typography**: `--font-mono` (SF Mono, Fira Code, Consolas), `--font-sans` (system stack)

**Bracket colors** (8 depth levels, `--bracket-1` through `--bracket-8`):
- Dark: blue, red-orange, teal, purple, magenta, lime, sky blue, amber
- High Contrast: cyan, crimson, bright lime, magenta, orange, bright lime, sky blue, coral

**Feature Toggles** (persisted in localStorage):
- `coloredBrackets` (default: true) — Enable bracket coloring
- `showBracketLines` (default: false) — SVG connector lines for `{}` brackets
- `collapsibleBrackets` (default: true) — Click brackets to collapse

**Layout**: Flexbox app container, sidebar (320px/60px collapsed), CSS Grid workspace (1fr + minmax(240px, 320px)). Responsive: @media (max-width: 900px) switches to single column with fixed bottom rule palette.

**Animations**: fadeIn (0.2s), slideInFromLeft (0.3s for new proof lines), glowPulse (1.5s × 3 for completion). Respects `prefers-reduced-motion`.

---

## Portfolio System

Both completed and incomplete proofs can be saved to the portfolio:
- **Completed proofs**: Auto-saved when the conclusion is derived at depth 0
- **Incomplete proofs**: Manually saved via the "Save Progress" button in the workspace header

Each entry includes:
- Theorem details
- Complete proof lines (current state)
- Save timestamp (`saved_at` - renamed from `completed_at` for backward compatibility via serde alias)
- Step count, time spent, hints used

The Portfolio view has three columns:
- **Entry List**: Browse completed and incomplete proofs with tabs to filter (counts shown)
- **Entry Detail**: View selected proof details, theorem, stats, and read-only FitchBox solution
- **Global Notepad**: A persistent notepad for general notes (auto-saves with 500ms debounce)

The Portfolio view has two tabs:
- **Completed**: Shows finished proofs with:
  - **Review**: Load the proof as-is to view or tweak it
  - **Retry from scratch**: Start a fresh proof from the theorem
- **Incomplete**: Shows in-progress proofs with a "Resume" button to continue where you left off

Incomplete entries are visually distinguished with an orange left border indicator.

The Global Notepad is stored separately from individual proofs at `global_notes.txt` in the data directory.

Storage locations:
- macOS: `~/Library/Application Support/logic-proof-trainer/`
- Windows: `%APPDATA%/logic-proof-trainer/`
- Linux: `~/.local/share/logic-proof-trainer/`

---

## Security

The application implements several security measures:

### Path Traversal Prevention

All storage operations validate IDs to prevent path traversal attacks:
- IDs must be non-empty
- IDs cannot contain `..`, `/`, or `\` characters
- IDs must consist only of ASCII alphanumeric characters and hyphens (UUID format)
- Invalid IDs result in an error with the message "Invalid ID format"

### Formula Parser Protections

- **Input length limit**: Maximum 10,000 characters (counted by Unicode code points)
- **Global nesting depth limit**: Maximum 100 levels of nesting across all constructs (negations, binary operators, and parentheses — tracked via `enter_depth()`/`exit_depth()`)
- **ASCII-only atoms**: Atom names restricted to ASCII alphanumeric, underscore, and apostrophe characters

### Input Validation

- **Difficulty values**: `generate_theorem_with_value` validates that the difficulty is between 1-100
- **Line range validation**: The proof workspace validates that `lineStart <= lineEnd` in subproof close commands
- **Delete verification**: Storage delete operations verify that the file was actually removed, returning an error if the file still exists after deletion
- **String length limits**: Global notes are limited to 10,000 characters, theorem/entry names are limited to 200 characters to prevent memory exhaustion

### Error Handling

- Delete operations return an error if the target entry doesn't exist, preventing silent failures
- All storage operations provide meaningful error messages for debugging
- Verifier provides case-sensitivity hints when equivalence rule validation fails due to atom casing

---

## PropBench: LLM Benchmark Tool

PropBench is a companion project in the `prop-bench/` directory that uses the Logic Proof Trainer's Rust backend to benchmark LLMs on proof generation tasks. It measures models on proof efficiency (fewest lines) rather than just correctness.

### Architecture

PropBench consists of:
- **TypeScript harness** (`harness.ts`) — Orchestrates benchmark runs, calls LLM APIs, parses outputs
- **Rust CLI** (`src/main.rs`) — Wraps the Logic Proof Trainer backend for validation
- **Web GUI** (`gui/`) — React frontend + Express backend with Dashboard, Theorem Explorer, Benchmark Runner, and Leaderboard pages
- **Model adapters** (`models/`) — Gemini direct adapter + OpenRouter adapter for all other models
- **Tier presets** (`tier-presets.json`) — Editable difficulty tier configurations loaded by GUI and CLI

### Key Components

**Prompt Builder** (`prompt.ts`):
- Generates complete LLM prompts with all 19 rules, CP/IP techniques, and output format specs
- v2.5: Added CRITICAL section clarifying that FORMULA field must be only the derived result, not premises
- Prevents common LLM errors where models include premise formulas in derived results

**Parser** (`parser.ts`):
- Parses raw LLM text into structured proof lines
- Handles 80+ rule name aliases, 7 line number formats, subproof depth detection
- v2.5: Fixed formula parsing using known-rule-name matching instead of ambiguous regex
- Result: Improved accuracy from 50% to 100% on first 10 theorems

**Model Adapters**:
- Gemini (`models/gemini.ts`): Uses `@google/genai` SDK for direct Google AI API access. Thinking token budget is configurable via `--max-thinking-tokens` (default 10000). Uses `totalTokenCount` for accurate billing (includes thinking tokens). Returns `thinking_tokens` separately for visibility.
- OpenRouter (`models/openrouter.ts`): Uses `openai` SDK targeting `https://openrouter.ai/api/v1`. Supports any model available on OpenRouter (Claude, GPT, Llama, DeepSeek, Mistral, etc.) with a single `OPENROUTER_API_KEY`. Thinking token budget is configurable via `--max-thinking-tokens` (default 10000) for reasoning models. Always passes `verbosity: "max"` for maximum effort on all models.
- Both adapters include retry logic with exponential backoff for rate limits
- Direct Gemini models: `gemini-2.0-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite-preview-09-2025`, `gemini-3-flash-preview`, `gemini-3-pro-preview`
- OpenRouter models: any valid OpenRouter model ID (e.g., `anthropic/claude-opus-4-6`, `anthropic/claude-sonnet-4.5`, `openai/gpt-4o`, `deepseek/deepseek-r1`)

**Token Budget & Spiral Detection** (v5.1):
- **Tier-based output token budgets**: Instead of a flat `--max-tokens` for all theorems, the harness caps output tokens per difficulty tier (Baby/Easy=1024, Medium/Hard=2048, Expert=4096, Nightmare/Marathon=6144, Absurd/Cosmic/Mind=8192). Analysis of 900+ cutoff responses showed 0/900 produced valid proofs and more tokens correlated with worse outcomes.
- **Spiral detection**: After each API response, the harness checks for repeated proof lines (5+ occurrences) and logs `SPIRAL DETECTED` warnings. Detects "death spiral" mode where models repeat identical invalid steps.
- **Data loss fix**: OpenRouter adapter now warns when API returns null content on cutoff responses (previously silently returned empty string).

**Cost Protection** (v4.50):
- **Thinking token tracking**: Gemini thinking models (2.5 Pro, 2.5 Flash, 3 Pro, 3 Flash) and OpenRouter reasoning models generate invisible "thinking tokens" billed as output but previously untracked. The adapter now uses `totalTokenCount` and records `thinking_tokens` separately in the DB.
- **Thinking budget cap**: Configurable via `--max-thinking-tokens <n>` CLI flag (default 10000). Gemini uses `thinkingConfig: { thinkingBudget: N }`, OpenRouter uses `reasoning: { max_tokens: N }`. This caps thinking tokens per call, preventing runaway 365K+ token calls.
- **Maximum verbosity**: OpenRouter adapter always passes `verbosity: "max"` to request highest quality responses from all models.
- **Cost tracking**: Each API call logs estimated cost using per-model pricing tables. Run summaries include total cost.
- **`--max-cost` flag**: Aborts a run when estimated spending exceeds a budget (e.g. `--max-cost 5` for $5 limit). Available in both CLI and GUI.
- **DB migration**: Added `thinking_tokens` column to the `results` table.

**Environment Configuration**:
- v2.5: Added `.env` file support via `dotenv` package
- Both harness and GUI load `.env` from prop-bench root with `override: true`
- API keys: `GEMINI_API_KEY` (direct Gemini models), `OPENROUTER_API_KEY` (all other models via OpenRouter)

### Web GUI (v2.5 Improvements)

**Backend Fixes** (`gui/server/`):
- `cli.ts`: Uses local `node_modules/.bin/ts-node` instead of npx to avoid resolution issues
- `cli.ts`: Explicitly reads `.env` and injects vars into child process environment
- `cli.ts`: Pre-spawn validation (checks theorems file, propbench binary, harness entry point exist)
- `cli.ts`: Passes `--max-thinking-tokens` argument when specified in run configuration
- `benchmark.ts`: Rewrote SSE handler with structured progress events (completed, total, validCount, invalidCount, errorCount, skippedCount)
- `benchmark.ts`: Fixed error event format to send `{type:"error", error:"..."}` not `{type:"error", data:"..."}`
- `results.ts`: Fixed to use RESULTS_DIR instead of BENCHMARKS_DIR
- `index.ts`: Loads dotenv with override from prop-bench root

**Frontend Fixes** (`gui/src/`):
- `BenchmarkRunner.tsx`: Fixed stale closure bug in SSE onerror handler using `useRef` instead of stale state
- `BenchmarkRunner.tsx`: Added "Max thinking tokens" input field for configuring thinking token budget (default 10000)
- `ProofViewer.tsx`: Added collapsible "Show Raw Model Response" section showing full model output
- `ProofViewer.tsx`: Added latency display in milliseconds
- `TheoremDetail.tsx`: Passes rawResponse and latencyMs to ProofViewer
- `theorems.css`: Added styles for raw response viewer
- `Leaderboard.tsx`: Leaderboard page aggregating benchmark results across models with sortable columns for accuracy, average lines, cost, and latency per difficulty tier
- `vite.config.ts`: Added SSE proxy buffering fix (cache-control, x-accel-buffering headers)

**Tier Presets Configuration**:
- `tier-presets.json`: Stores difficulty tier presets (Easy through Mind), loaded by GUI and CLI
- API endpoints:
  - `GET /api/tier-presets` — Returns current tier presets configuration
  - `PUT /api/tier-presets` — Saves updated tier presets
- GUI allows editing and saving tier presets with custom values for variables, passes, transforms_per_pass, base_complexity, and substitution_depth
- All custom spec inputs are uncapped (u8 max = 255) for variables, passes, transforms_per_pass, and substitution_depth
- When generating theorems via GUI, presets are resolved from `tier-presets.json` rather than hardcoded Rust values
- Rust binary's `DifficultySpec::from_tier()` remains as fallback for direct CLI usage
- Custom OpenRouter models entered in the GUI are automatically saved as presets (persisted in localStorage) for future runs

### Results

After parser and prompt fixes in v2.5:
- Benchmark accuracy improved from 50% valid to 100% valid on first 10 theorems
- Models now correctly format proof lines with only derived formulas in FORMULA field
- Formulas containing dots, spaces, and special characters parse correctly

### Relationship to Logic Proof Trainer

PropBench depends on the Logic Proof Trainer backend via a Cargo path dependency:

```toml
[dependencies]
logic-proof-trainer = { path = "../logic-proof-trainer/src-tauri" }
```

This means:
- Theorem generation uses the exact same difficulty engine as the app
- Proof verification uses identical rule checking logic
- All 19 rules (9 inference, 10 equivalence) + CP/IP are validated identically
- Any improvements to the verifier automatically benefit both projects

### Running PropBench

```bash
# 1. Create .env file in prop-bench root
cat > prop-bench/.env << 'EOF'
GEMINI_API_KEY=your-gemini-key-here
OPENROUTER_API_KEY=your-openrouter-key-here
EOF

# 2. Build Rust CLI
cd prop-bench
cargo build --release

# 3. Run benchmark (direct Gemini)
npx ts-node harness.ts --theorems benchmarks/v1/theorems.json --models gemini-2.5-flash

# 3b. Run benchmark (OpenRouter model)
npx ts-node harness.ts --theorems benchmarks/v1/theorems.json --models anthropic/claude-sonnet-4.5

# 4. Or use GUI
cd gui
npm install
npm run dev  # Opens http://localhost:3000
```

**SQLite Storage:** PropBench now uses SQLite (`propbench.db`) as its primary storage layer for benchmark results, replacing filesystem scanning in the GUI server. The harness dual-writes to both JSON files and SQLite during the transition. Existing JSON results can be migrated via `npm run migrate`. The database uses WAL mode for concurrent access and includes four tables: `theorem_sets`, `theorems`, `results`, and `reports_cache`.

**Dashboard Statistics:** The PropBench GUI Dashboard displays comprehensive benchmark analytics including:
- Elo Rankings — Models ranked by competitive performance
- Difficulty Breakdown — Success rates across difficulty tiers
- Head-to-Head Wins — Pairwise comparison matrix
- **Avg Proof Length by Difficulty** — Average line count per model per difficulty tier (only valid proofs), with green highlighting on shortest averages. Helps identify which models produce more concise proofs at different complexity levels.
- Latency Comparison — API response time analysis
- Failure Analysis — Parse errors and validation failures

See `prop-bench/DOCUMENTATION.md`, `prop-bench/ARCHITECTURE.md`, and `prop-bench/COMMANDS.md` for complete PropBench documentation.
