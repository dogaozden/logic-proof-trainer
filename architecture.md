**Theorem Generation Architecture (3-Layer System)**

---

## Overview

Generate valid, non-trivial theorems with controllable difficulty. Output is always a tautology (no premises, single formula to prove).

---

## Layer 1: Base Theorem

Generate simple valid argument forms.

**Simple bases (all difficulties):**
- MP: `P, P⊃Q ⊢ Q`
- MT: `P⊃Q, ~Q ⊢ ~P`
- HS: `P⊃Q, Q⊃R ⊢ P⊃R`
- DS: `P∨Q, ~P ⊢ Q`

**Complex bases (difficulty ≥ 70):**
- CD: `P∨Q, P⊃R, Q⊃R ⊢ R`
- Nested CP: `P⊃(Q⊃R), P, Q ⊢ R`
- Chain: `P⊃Q, Q⊃R, R⊃S, P ⊢ S`

---

## Layer 2: Wrap + Obfuscate

**Step 1: Wrap as tautology**
```
Premises: P, P⊃Q
Conclusion: Q
Wrapped: (P ∧ (P⊃Q)) ⊃ Q
```

**Step 2: Apply N equivalence transformations**

Available transforms (all preserve truth tables):
- Exportation: `(A∧B)⊃C ↔ A⊃(B⊃C)`
- Contraposition: `A⊃B ↔ ~B⊃~A`
- Material Implication: `A⊃B ↔ ~A∨B`
- De Morgan: `~(A∧B) ↔ ~A∨~B`, `~(A∨B) ↔ ~A∧~B`
- Distribution: `A∧(B∨C) ↔ (A∧B)∨(A∧C)`
- Double Negation: `A ↔ ~~A`
- Commutation: `A∧B ↔ B∧A`, `A∨B ↔ B∨A`
- Association: `A∧(B∧C) ↔ (A∧B)∧C`

**Difficulty ≥ 85: Force gnarly combos first**
- Contraposition + De Morgan chain
- Material Implication + Distribution
- Exportation + Double Negation

---

## Layer 3: Atom Substitution (difficulty ≥ 70)

Replace atoms with complex formulas BEFORE wrapping/obfuscating.

```
Base: P⊃Q, Q⊃R ⊢ P⊃R

Substitutions:
  P → (A ∨ ~B)
  Q → (C . D)
  R → (E ⊃ F)

Result: (A∨~B)⊃(C.D), (C.D)⊃(E⊃F) ⊢ (A∨~B)⊃(E⊃F)

THEN wrap and obfuscate.
```

**Substitution depth by difficulty:**
| Difficulty | Depth | Example |
|------------|-------|---------|
| 70-85 | 2 | `P → (A ∨ B)` |
| 86-95 | 3 | `P → (A ∨ B) . C` |
| 96-100 | 4 | `P → ((A ∨ B) . (C ⊃ D))` |

Uses FRESH atoms (A, B, C, D, E, F) distinct from base atoms (P, Q, R).

---

## Difficulty Scaling

| Tier | Value | Transforms | Atoms | Bases | Substitution |
|------|-------|------------|-------|-------|--------------|
| Easy | 1-25 | 1-3 | 2 | Simple | None |
| Medium | 26-45 | 3-6 | 2-3 | Simple | None |
| Hard | 46-70 | 6-11 | 3-4 | Mixed | None |
| Expert | 71-85 | 11-16 | 4-5 | Complex | Depth 2 |
| Nightmare | 86-95 | 16-20 | 5 | Complex + combos | Depth 3 |
| Marathon | 96-100 | 20-24 | 5 | Complex + combos | Depth 4 |

---

## Validity Guarantee

```
Base theorem valid (argument form)
  → Wrapping preserves validity
    → Equivalence transforms preserve truth table
      → Substitution preserves validity
        → Output is ALWAYS a valid tautology
```

Semantic validity checked via truth tables at each step.

---

## Output Format

```rust
Theorem {
    premises: vec![],           // Empty! It's a tautology
    conclusion: obfuscated,     // The whole formula
    difficulty: Marathon,
    difficulty_value: 98,
    ...
}
```

User proves: `⊢ [giant obfuscated formula]`

