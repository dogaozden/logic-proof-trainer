def forces_case_split(premises, conclusion) -> bool:
    # Find disjunctive premises
    for p in premises:
        if isinstance(p, Or):
            A, B = p.left, p.right
            neg_A_available = any(are_equivalent(q, Not(A)) for q in premises)
            neg_B_available = any(are_equivalent(q, Not(B)) for q in premises)
            
            # If neither negation available, DS is blocked → must case split
            if not neg_A_available and not neg_B_available:
                return True
    
    return False
```

**Template:** `A ∨ B, A ⊃ C, B ⊃ C ⊢ C`

---

## The Architecture Shift

From the report:

> "Do not iterate forward from premises. Instead, construct the **Proof Tree first**."

1. **Select a root rule** (e.g., ∨-Elim)
2. **Generate branch requirements** 
3. **Recursively fill branches**
4. **Harvest undischarged leaves as premises**

This is what we tried originally, but the generator kept picking implication rules. We need to **force** it to pick variety.

---

## Prompt for Claude Code
```
MAJOR INSIGHT FROM RESEARCH: We need "Blocked Introduction" — actively prevent easy paths.

Current bug: Generator only produces implication chains because it never FORCES other techniques.

**Implement these structural forcing checks:**

1. **forces_cp(premises, conclusion) -> bool**
   - True if conclusion is A ⊃ B AND premises alone DON'T entail B
   - Use: `not entails(premises, B)` where B is the consequent
   - If premises already entail B, CP is trivial (just derive B, wrap in CP)

2. **forces_case_split(premises, conclusion) -> bool**
   - True if premises contain A ∨ B AND neither ~A nor ~B is in premises
   - If ~A available → can use DS instead of case split (easy)
   - If neither negation available → MUST case split

3. **forces_ip(premises, conclusion) -> bool**
   - True if conclusion is atomic AND not directly derivable
   - Or if conclusion matches classical tautology patterns (P ∨ ~P, Peirce's Law)

**For difficulty levels:**

| Level | Requirement |
|-------|-------------|
| Easy | Any valid proof |
| Medium | Must satisfy forces_cp() OR forces_case_split() |
| Hard | Must satisfy forces_cp() AND forces_case_split() |
| Expert | Must satisfy all three forcing checks |

**Generation strategy:**

When building proof tree for Hard/Expert:
1. REQUIRE at least one ∨-Elim node (forces case split)
2. For any A ⊃ B conclusion, verify premises don't entail B alone
3. Don't add ~A or ~B to premises if you have A ∨ B (would enable DS shortcut)

**Template for guaranteed hard problem:**

Premises: A ∨ B, A ⊃ C, B ⊃ C
Conclusion: C

This FORCES ∨-Elim because:
- Can't derive C from any single premise
- Can't use DS (no ~A or ~B available)
- MUST case split on A ∨ B

Implement the forcing checks and wire them into validation.