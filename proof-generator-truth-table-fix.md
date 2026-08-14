# Proof Generator: The Truth Table Fix

## The Problem We Had

We kept adding filters to catch trivial/degenerate theorems:
- Contradictory premises
- Conclusion in premises
- Tautological conclusions
- One-step derivability
- Redundant premises
- Conditional with negated antecedent
- etc.

Every filter had bugs because we were comparing **syntax** (formula trees) instead of **semantics** (what formulas mean). Edge cases like `~~P` vs `P`, or `T ∨ T` vs `T`, kept slipping through.

## The Solution: Truth Table Representation

**Core insight:** Two formulas are logically equivalent if and only if they have identical truth tables. The truth table IS the formula's semantic identity.

For 5 variables (P, Q, R, S, T), a truth table has 2⁵ = 32 rows. We can encode any truth table as a **32-bit integer**.

This turns all our buggy pattern-matching into simple integer comparisons.

---

## Part 1: Truth Table Computation

### Base Variable Truth Tables

Each variable has a fixed bit pattern based on standard truth table row ordering:

```python
# 32-bit truth tables for 5 variables
# Row order: PQRST from 11111 (row 0) to 00000 (row 31)

VARIABLE_TRUTH_TABLES = {
    'P': 0xFFFF0000,  # 11111111111111110000000000000000
    'Q': 0xFF00FF00,  # 11111111000000001111111100000000
    'R': 0xF0F0F0F0,  # 11110000111100001111000011110000
    'S': 0xCCCCCCCC,  # 11001100110011001100110011001100
    'T': 0xAAAAAAAA,  # 10101010101010101010101010101010
}

MASK_32 = 0xFFFFFFFF  # All 1s for 32 bits
TAUTOLOGY = 0xFFFFFFFF  # All rows true
CONTRADICTION = 0x00000000  # All rows false
```

### Computing Truth Tables Recursively

```python
def compute_truth_table(formula: Formula) -> int:
    """
    Convert any formula to its 32-bit truth table.
    
    This is the ONLY function that traverses syntax.
    Everything else just compares integers.
    """
    if isinstance(formula, Atom):
        return VARIABLE_TRUTH_TABLES[formula.name]
    
    elif isinstance(formula, Not):
        inner_tt = compute_truth_table(formula.inner)
        return (~inner_tt) & MASK_32
    
    elif isinstance(formula, And):
        left_tt = compute_truth_table(formula.left)
        right_tt = compute_truth_table(formula.right)
        return left_tt & right_tt
    
    elif isinstance(formula, Or):
        left_tt = compute_truth_table(formula.left)
        right_tt = compute_truth_table(formula.right)
        return left_tt | right_tt
    
    elif isinstance(formula, Implies):
        # P ⊃ Q  ≡  ~P ∨ Q
        ant_tt = compute_truth_table(formula.antecedent)
        cons_tt = compute_truth_table(formula.consequent)
        return ((~ant_tt) | cons_tt) & MASK_32
    
    elif isinstance(formula, Biconditional):
        # P ≡ Q  ≡  (P ⊃ Q) ∧ (Q ⊃ P)
        left_tt = compute_truth_table(formula.left)
        right_tt = compute_truth_table(formula.right)
        return (~(left_tt ^ right_tt)) & MASK_32  # XNOR
    
    elif isinstance(formula, Bottom):
        return CONTRADICTION
    
    else:
        raise ValueError(f"Unknown formula type: {type(formula)}")
```

### Caching for Performance

```python
from functools import lru_cache

# Option A: Use lru_cache on the function
@lru_cache(maxsize=10000)
def compute_truth_table_cached(formula: Formula) -> int:
    return compute_truth_table(formula)

# Option B: Store truth table on Formula object
class Formula:
    _truth_table: Optional[int] = None
    
    @property
    def truth_table(self) -> int:
        if self._truth_table is None:
            self._truth_table = compute_truth_table(self)
        return self._truth_table
```

---

## Part 2: Semantic Checks (Replace ALL Filters)

These replace the 200+ lines of buggy pattern-matching filters.

### Check 1: Are Two Formulas Equivalent?

```python
def are_equivalent(f1: Formula, f2: Formula) -> bool:
    """
    Check if two formulas are logically equivalent.
    Catches: P vs ~~P, T∨T vs T, P⊃Q vs ~P∨Q, etc.
    """
    return compute_truth_table(f1) == compute_truth_table(f2)
```

### Check 2: Is Formula a Tautology?

```python
def is_tautology(formula: Formula) -> bool:
    """
    Check if formula is true in all interpretations.
    Catches: P∨~P, P⊃P, Q⊃(P⊃Q), etc.
    """
    return compute_truth_table(formula) == TAUTOLOGY
```

### Check 3: Is Formula a Contradiction?

```python
def is_contradiction(formula: Formula) -> bool:
    """
    Check if formula is false in all interpretations.
    Catches: P∧~P, etc.
    """
    return compute_truth_table(formula) == CONTRADICTION
```

### Check 4: Are Premises Jointly Consistent?

```python
def premises_consistent(premises: List[Formula]) -> bool:
    """
    Check if there's at least one interpretation where all premises are true.
    If result is 0 (no such row), premises are contradictory.
    """
    combined = TAUTOLOGY  # Start with all 1s
    for p in premises:
        combined &= compute_truth_table(p)
    return combined != CONTRADICTION
```

### Check 5: Does a Set of Premises Entail a Conclusion?

```python
def entails(premises: List[Formula], conclusion: Formula) -> bool:
    """
    Check if premises ⊢ conclusion is valid.
    Valid iff there's no row where all premises true but conclusion false.
    
    Formula: (P₁ ∧ P₂ ∧ ...) ∧ ~C == 0
    """
    combined_premises = TAUTOLOGY
    for p in premises:
        combined_premises &= compute_truth_table(p)
    
    conclusion_tt = compute_truth_table(conclusion)
    
    # Any row where premises true AND conclusion false?
    counterexample = combined_premises & ((~conclusion_tt) & MASK_32)
    
    return counterexample == CONTRADICTION
```

### Check 6: Does a Single Premise Entail the Conclusion?

```python
def single_premise_entails(premises: List[Formula], conclusion: Formula) -> bool:
    """
    Check if ANY single premise alone entails the conclusion.
    This catches:
    - Begging the question (P ⊢ P)
    - Trivial Simp (P∧Q ⊢ P)
    - Trivial Add (P ⊢ P∨Q)
    - Semantic equivalence (P ⊢ ~~P)
    """
    conclusion_tt = compute_truth_table(conclusion)
    
    for p in premises:
        premise_tt = compute_truth_table(p)
        # Does this premise alone entail conclusion?
        counterexample = premise_tt & ((~conclusion_tt) & MASK_32)
        if counterexample == CONTRADICTION:
            return True  # This single premise entails conclusion
    
    return False
```

### Check 7: Is Conclusion's Negation Available?

```python
def conclusion_negation_available(premises: List[Formula], conclusion: Formula) -> bool:
    """
    Check if ~conclusion is semantically equivalent to any premise.
    This makes the theorem trivially provable via contradiction.
    """
    neg_conclusion_tt = (~compute_truth_table(conclusion)) & MASK_32
    
    for p in premises:
        if compute_truth_table(p) == neg_conclusion_tt:
            return True
    
    return False
```

### Check 8: Is Conditional Trivially Provable via Explosion?

```python
def conditional_trivial_via_explosion(premises: List[Formula], conclusion: Formula) -> bool:
    """
    For conclusion A ⊃ B (or nested A ⊃ (B ⊃ C) etc.):
    If ~A (or ~B, etc.) is available in premises, the proof is trivial:
    Assume A, get contradiction with ~A, explode to anything.
    
    We check if the negation of ANY antecedent in the chain is 
    semantically equivalent to any premise.
    """
    # Extract the chain of antecedents from nested conditionals
    antecedents = []
    current = conclusion
    while isinstance(current, Implies):
        antecedents.append(current.antecedent)
        current = current.consequent
    
    if not antecedents:
        return False  # Not a conditional conclusion
    
    # Check if negation of any antecedent is equivalent to a premise
    for ant in antecedents:
        neg_ant_tt = (~compute_truth_table(ant)) & MASK_32
        for p in premises:
            if compute_truth_table(p) == neg_ant_tt:
                return True
    
    return False
```

### Check 9: Are All Premises Necessary? (MUC Check)

```python
def all_premises_necessary(premises: List[Formula], conclusion: Formula) -> bool:
    """
    Check that removing ANY single premise breaks the entailment.
    This ensures no redundant premises (tight problem).
    """
    if not entails(premises, conclusion):
        return False  # Not even valid!
    
    for i in range(len(premises)):
        # Remove premise i
        reduced = premises[:i] + premises[i+1:]
        if entails(reduced, conclusion):
            return False  # Premise i was redundant
    
    return True
```

### Check 10: Are There Redundant (Equivalent) Premises?

```python
def has_redundant_premises(premises: List[Formula]) -> bool:
    """
    Check if any two premises are semantically equivalent.
    """
    truth_tables = [compute_truth_table(p) for p in premises]
    return len(truth_tables) != len(set(truth_tables))
```

---

## Part 3: The Complete Validation Function

```python
class DegenerateTheoremError(Exception):
    """Raised when a generated theorem is trivial/degenerate."""
    pass


def validate_theorem(premises: List[Formula], conclusion: Formula) -> None:
    """
    Validate that a theorem is non-trivial.
    All checks use semantic (truth table) comparison.
    
    Raises DegenerateTheoremError with reason if validation fails.
    """
    
    # 1. Premises must be jointly consistent
    if not premises_consistent(premises):
        raise DegenerateTheoremError("Contradictory premises (explosion possible)")
    
    # 2. Conclusion must not be a tautology
    if is_tautology(conclusion):
        raise DegenerateTheoremError("Conclusion is a tautology (provable without premises)")
    
    # 3. No single premise should entail the conclusion
    if single_premise_entails(premises, conclusion):
        raise DegenerateTheoremError("Conclusion derivable from single premise")
    
    # 4. Negation of conclusion should not be available
    if conclusion_negation_available(premises, conclusion):
        raise DegenerateTheoremError("Negation of conclusion is a premise")
    
    # 5. Conditional conclusions shouldn't have negated antecedents available
    if conditional_trivial_via_explosion(premises, conclusion):
        raise DegenerateTheoremError("Conditional trivially provable via explosion")
    
    # 6. No redundant (equivalent) premises
    if has_redundant_premises(premises):
        raise DegenerateTheoremError("Redundant premises (duplicates or equivalents)")
    
    # 7. All premises must be necessary
    if not all_premises_necessary(premises, conclusion):
        raise DegenerateTheoremError("Not all premises are necessary")
    
    # 8. The theorem must actually be valid!
    if not entails(premises, conclusion):
        raise DegenerateTheoremError("Theorem is not valid!")
```

---

## Part 4: Constraint-Based Generation (Not Post-Hoc Filtering)

Instead of generate → filter → retry, integrate checks INTO the generator.

### Modified Generator Architecture

```python
class ConstrainedProofGenerator:
    def __init__(self, atoms: List[str], target_fragments: int, max_nesting: int):
        self.atoms = atoms
        self.target_fragments = target_fragments
        self.max_nesting = max_nesting
        
        # Track what we've committed to
        self.premises: List[Formula] = []
        self.premise_truth_tables: Set[int] = set()
        self.combined_premises_tt: int = TAUTOLOGY  # Conjunction of all premises
        
        self.conclusion: Optional[Formula] = None
        self.conclusion_tt: Optional[int] = None
    
    def set_conclusion(self, conclusion: Formula) -> bool:
        """
        Set the conclusion. Returns False if conclusion is a tautology.
        """
        tt = compute_truth_table(conclusion)
        
        if tt == TAUTOLOGY:
            return False  # Reject tautological conclusions
        
        self.conclusion = conclusion
        self.conclusion_tt = tt
        return True
    
    def can_add_premise(self, premise: Formula) -> tuple[bool, str]:
        """
        Check if adding this premise would create a degenerate theorem.
        Returns (can_add, reason_if_not).
        """
        tt = compute_truth_table(premise)
        
        # Check: Would this create a contradiction?
        new_combined = self.combined_premises_tt & tt
        if new_combined == CONTRADICTION:
            return False, "Would create contradictory premises"
        
        # Check: Is this equivalent to an existing premise?
        if tt in self.premise_truth_tables:
            return False, "Equivalent premise already exists"
        
        # Check: Does this single premise entail conclusion?
        if self.conclusion_tt is not None:
            counterexample = tt & ((~self.conclusion_tt) & MASK_32)
            if counterexample == CONTRADICTION:
                return False, "Single premise would entail conclusion"
        
        # Check: Is this the negation of conclusion?
        if self.conclusion_tt is not None:
            neg_conclusion = (~self.conclusion_tt) & MASK_32
            if tt == neg_conclusion:
                return False, "Premise is negation of conclusion"
        
        # Check: Is this the negation of a conditional antecedent?
        if self.conclusion is not None and isinstance(self.conclusion, Implies):
            antecedents = self._extract_antecedent_chain(self.conclusion)
            for ant in antecedents:
                neg_ant_tt = (~compute_truth_table(ant)) & MASK_32
                if tt == neg_ant_tt:
                    return False, "Premise negates conditional antecedent (trivial explosion)"
        
        return True, ""
    
    def add_premise(self, premise: Formula) -> bool:
        """
        Add a premise if it passes all checks.
        Returns True if added, False if rejected.
        """
        can_add, reason = self.can_add_premise(premise)
        if not can_add:
            return False
        
        tt = compute_truth_table(premise)
        self.premises.append(premise)
        self.premise_truth_tables.add(tt)
        self.combined_premises_tt &= tt
        return True
    
    def _extract_antecedent_chain(self, formula: Formula) -> List[Formula]:
        """Extract [A, B, C] from A ⊃ (B ⊃ (C ⊃ D))"""
        chain = []
        current = formula
        while isinstance(current, Implies):
            chain.append(current.antecedent)
            current = current.consequent
        return chain
    
    def finalize(self) -> tuple[List[Formula], Formula]:
        """
        Finalize and validate the theorem.
        Raises DegenerateTheoremError if final validation fails.
        """
        # Final check: theorem must be valid
        if not entails(self.premises, self.conclusion):
            raise DegenerateTheoremError("Generated theorem is not valid")
        
        # Final check: all premises must be necessary
        if not all_premises_necessary(self.premises, self.conclusion):
            raise DegenerateTheoremError("Not all premises are necessary")
        
        return self.premises, self.conclusion
```

### Updated Generation Loop

```python
def generate_theorem(difficulty: str, max_attempts: int = 100) -> tuple[List[Formula], Formula]:
    """
    Generate a non-trivial theorem.
    
    Uses constraint-based generation: checks are applied DURING construction,
    not as post-hoc filters. This reduces wasted attempts.
    """
    configs = {
        "easy":   {"fragments": random.randint(2, 4),   "nesting": random.randint(0, 1)},
        "medium": {"fragments": random.randint(4, 6),   "nesting": 2},
        "hard":   {"fragments": random.randint(6, 10),  "nesting": 4},
        "expert": {"fragments": random.randint(10, 15), "nesting": random.randint(6, 8)},
    }
    
    cfg = configs.get(difficulty, configs["medium"])
    atoms = ["P", "Q", "R", "S", "T"]
    
    for attempt in range(max_attempts):
        try:
            generator = ConstrainedProofGenerator(
                atoms=atoms,
                target_fragments=cfg["fragments"],
                max_nesting=cfg["nesting"]
            )
            
            # Build proof tree with constraints
            proof_tree = build_constrained_proof_tree(generator)
            
            # Extract and validate
            premises, conclusion = generator.finalize()
            
            return premises, conclusion
            
        except DegenerateTheoremError:
            continue
    
    raise RuntimeError(f"Failed to generate valid theorem after {max_attempts} attempts")
```

---

## Part 5: Testing Checklist

After implementation, verify these cases are caught:

| Test Case | Expected Result |
|-----------|-----------------|
| `P, ~P ⊢ Q` | Rejected: contradictory premises |
| `P ⊢ P` | Rejected: single premise entails conclusion |
| `P ⊢ ~~P` | Rejected: single premise entails conclusion (semantic equivalence) |
| `P ∧ Q ⊢ P` | Rejected: single premise entails conclusion |
| `P ⊢ P ∨ Q` | Rejected: single premise entails conclusion |
| `⊢ P ∨ ~P` | Rejected: tautological conclusion |
| `⊢ P ⊃ P` | Rejected: tautological conclusion |
| `T ∨ T, ~T ⊢ Q` | Rejected: contradictory premises (T∨T ≡ T) |
| `T ⊃ (Q ⊃ R) ⊢ T ⊃ (Q ⊃ R)` | Rejected: single premise entails conclusion |
| `~P ⊢ P ⊃ Q` | Rejected: conditional trivial via explosion |
| `~P, P ⊃ Q ⊢ P ⊃ Q` | Rejected: conclusion entailed by single premise |
| `P, P, Q ⊢ P ∧ Q` | Rejected: redundant premises |
| `P, Q, R ⊢ P ∧ Q` | Rejected: R is unnecessary |

---

## Part 6: Summary

**What changed:**

| Before | After |
|--------|-------|
| 8 separate filters | 1 unified validation function |
| Syntax-based comparison (buggy) | Semantic comparison via truth tables (complete) |
| Post-hoc filtering with high rejection | Constraint-based generation with low rejection |
| 200+ lines of pattern matching | ~100 lines of integer comparisons |
| Edge cases everywhere | Mathematically complete |

**The key insight:**

> Stop comparing syntax trees. Compare truth tables.
> Two formulas with the same truth table ARE the same proposition.
> All logical properties reduce to integer operations on truth tables.

**Performance:**

For 5 variables, truth tables are 32-bit integers. All checks are O(1) bitwise operations. Your M4 Mac can validate millions of theorems per second.

---

## References

- Ahmed, Gulwani, Karkare. "Automatically Generating Problems and Solutions for Natural Deduction." IJCAI 2013.
- Universal Proof Graph (UPG) — semantic abstraction via bitvector truth tables.

Good luck, Claude Code! 🚀
