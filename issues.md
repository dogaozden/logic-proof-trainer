# Logic Proof Trainer - Issues & Improvement Proposals

Generated: 2026-02-02

This document tracks identified issues, technical debt, and improvement proposals for the Logic Proof Trainer codebase.

---

## Table of Contents

1. [Critical Priority](#critical-priority)
2. [High Priority](#high-priority)
3. [Medium Priority](#medium-priority)
4. [Low Priority](#low-priority)
5. [Quick Wins](#quick-wins)

---

## Critical Priority

Issues that should be fixed immediately due to bugs, potential data loss, or missing critical functionality.

### 1. ~~No Frontend Tests~~ ✅ FIXED (2026-02-02)

**Location:** `/src/`

**Problem:** Zero test files found in the frontend codebase. No `.test.ts`, `.spec.ts`, or testing infrastructure.

**Impact:** No confidence in frontend behavior, regressions go undetected.

**Proposal:** Set up Vitest, write component tests for ProofWorkspace, FormulaDisplay, Portfolio. Add `npm test` script to package.json.

**Resolution:**
- Created `vitest.config.ts` with jsdom environment
- Created `src/setupTests.ts` with Tauri mock
- Created `src/types/index.test.ts` (19 tests for `formulaToString`, `justificationToString`, `difficultyColor`)
- Created `src/hooks/useProof.test.ts` (17 tests for proof state management)
- Added test dependencies to `package.json`: vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- Added scripts: `npm test`, `npm run test:ui`, `npm run test:run`
- **36 tests passing**

---

### 2. ~~ProofWorkspace Component Too Large~~ ✅ FIXED (2026-02-02)

**Location:** `src/components/ProofWorkspace/ProofWorkspace.tsx` (1,129 → 698 lines)

**Problem:**
- Massive component with 15+ useState declarations
- Unified command parser (237 lines) embedded in component
- Multiple responsibilities: input parsing, rule application, subproof management, goal tracking, renaming, portfolio saving, timer tracking, hints
- Deep nesting with complex conditional logic

**Impact:** Hard to maintain, test, and reason about. High bug risk.

**Resolution:** Extracted into focused modules:
- `src/utils/proofCommandParser.ts` (329 lines) - Unified input parser + rule abbreviation maps
- `src/hooks/useProofAutoApply.ts` (116 lines) - Auto-apply logic for inference/equivalence rules
- `src/hooks/useProofGoals.ts` (53 lines) - Subproof goal tracking state
- `src/hooks/useProofTimer.ts` (70 lines) - Timing, hints tracking, and portfolio auto-save

ProofWorkspace.tsx reduced from 1,145 to 698 lines (~40% reduction).

---

### 3. ~~Race Condition in Auto-Apply Logic~~ ✅ FIXED (2026-02-02)

**Location:** `src/hooks/useProofAutoApply.ts` (extracted from ProofWorkspace.tsx)

**Problem:**
```typescript
useEffect(() => {
  if (selectedInferenceRule && selectedLines.length > 0) {
    tryAutoApplyInference(selectedInferenceRule, selectedLines);
  }
}, [selectedLines, selectedInferenceRule, tryAutoApplyInference]);
```
- `tryAutoApplyInference` is async but not awaited
- Rapid line selections may run multiple concurrent auto-apply attempts
- No cancellation mechanism for stale requests

**Impact:** Unexpected behavior, potential state corruption.

**Resolution:** Added `pendingAutoApplyRef` guard to prevent concurrent operations:
```typescript
const pendingAutoApplyRef = useRef<boolean>(false);

useEffect(() => {
  if (selectedInferenceRule && selectedLines.length > 0 && !pendingAutoApplyRef.current) {
    pendingAutoApplyRef.current = true;
    tryAutoApplyInference(selectedInferenceRule, selectedLines).finally(() => {
      pendingAutoApplyRef.current = false;
    });
  }
}, [selectedLines, selectedInferenceRule, tryAutoApplyInference]);
```
Same fix applied to equivalence rule auto-apply useEffect.

---

### 4. ~~Memory Leak in FitchBox Timer~~ ✅ FIXED (2026-02-02)

**Location:** `src/components/ProofWorkspace/FitchBox.tsx:122-147`

**Problem:**
```typescript
useEffect(() => {
  if (currentCount > prevCount) {
    const timer = setTimeout(() => {
      setNewLineIds(new Set());
    }, 300);
    return () => clearTimeout(timer);
  }
  // ...
}, [proof.lines]);
```
If `proof.lines` changes rapidly, previous timers are NOT cleared before setting new ones.

**Impact:** Memory leak, unexpected state updates.

**Resolution:** Added `timerRef` to track and clear timers:
```typescript
const timerRef = useRef<number | undefined>(undefined);

useEffect(() => {
  // Always clear existing timer first
  if (timerRef.current !== undefined) {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }
  // ... rest of logic with timerRef.current = window.setTimeout(...)
  return () => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
    }
  };
}, [proof.lines]);
```

---

### 5. ~~Missing Null Check in reorderLines~~ ✅ FIXED (2026-02-02)

**Location:** `src/utils/proofReorder.ts:143`

**Problem:**
```typescript
const fromIndex = lines.findIndex(l => l.line_number === fromLineNumber);
const movingLine = lines[fromIndex];  // Potential undefined!
```
If `fromLineNumber` doesn't exist, `fromIndex` is -1, and `lines[-1]` is undefined.

**Impact:** Runtime crash when reordering with invalid line number.

**Resolution:** Added early return check:
```typescript
const fromIndex = lines.findIndex(l => l.line_number === fromLineNumber);
if (fromIndex === -1) {
  return null;
}
const movingLine = lines[fromIndex];
```

---

## High Priority

Issues that significantly impact code quality, performance, or maintainability.

### 6. ~~StorageService Recreated Per Call~~ ✅ FIXED (2026-02-02)

**Location:** `src-tauri/src/commands.rs`

**Problem:**
```rust
pub fn save_proof(proof: Proof) -> Result<(), String> {
    let storage = StorageService::new().map_err(|e| e.to_string())?;  // Created every call!
    storage.save_proof(&proof).map_err(|e| e.to_string())
}
```
StorageService is recreated on every storage operation, including directory creation checks.

**Resolution:** Implemented StorageService as a singleton using Tauri's state management:
- Modified `lib.rs` to initialize StorageService once in `.setup()` handler
- Used `app.manage(Mutex::new(storage))` to store it as managed state
- Updated all 13 storage-related commands to accept `State<Mutex<StorageService>>` parameter

---

### 7. ~~Excessive Formula Cloning~~ ✅ ADDRESSED (2026-02-02)

**Location:** Throughout backend (468 occurrences)

**Problem:**
- Heavy use of `.clone()` on Formula structures
- Particularly bad in `tree_gen.rs` (235 clones), `equivalence.rs` (49 clones)
- Deeply nested Formula structures amplify the cost

**Resolution:**
- Added `SharedFormula` type alias (`Arc<Formula>`) to `formula.rs`
- Added helper methods: `Formula::shared()`, `Formula::from_shared()`
- Analysis revealed most clones are structurally necessary due to Formula's recursive enum design
- Created `CLONE_OPTIMIZATION.md` documenting analysis and future opportunities
- **Verdict:** Current cloning is NOT a performance bottleneck for this interactive app

---

### 8. ~~tree_gen.rs Too Large~~ ✅ FIXED (2026-02-02)

**Location:** `src-tauri/src/services/tree_gen.rs` (2,341 lines)

**Problem:** Single file handling proof tree generation is massive and difficult to maintain.

**Resolution:** Split into module structure:
```
services/tree_gen/
├── mod.rs       (16 lines)   - Public exports
├── context.rs   (298 lines)  - RequiredTechniques, TreeGenConfig, ConstructionContext
├── backward.rs  (763 lines)  - Backward construction algorithm
├── templates.rs (278 lines)  - Fallback template theorems
└── builder.rs   (991 lines)  - ProofTreeGenerator and forward generation
```
All 156 tests passing, complete backward compatibility maintained.

---

### 9. ~~Symbol Toolbar Code Duplication~~ ✅ FIXED (2026-02-02)

**Location:**
- `src/components/ProofWorkspace/FormulaInput.tsx`
- `src/components/TheoremList/CustomTheoremModal.tsx`
- `src/components/Scratchpad/Scratchpad.tsx`

**Problem:** ~150 lines of nearly identical symbol toolbar code duplicated across 3 files.

**Resolution:** Created `src/components/shared/SymbolToolbar.tsx`:
- Shared component with props: `onSymbolClick`, `compact`, `includeAtoms`
- Displays logic symbols: ~, ·, ∨, ⊃, ≡, ⊥, (, )
- Displays atom buttons: P, Q, R, S, T
- Updated all 3 files to use the shared component
- Eliminated ~55 lines of duplicated code

---

### 10. ~~Proof Mutation Loses State on Error~~ ✅ FIXED (2026-02-02)

**Location:** `src-tauri/src/commands.rs`

**Problem:** Commands mutated proof before validation, causing potential state issues on errors.

**Resolution:** Modified all proof-mutating commands to clone first:
- `apply_rule()` - now clones proof before mutation
- `open_subproof()` - now clones proof before mutation
- `close_subproof()` - now clones proof before mutation
- `delete_line()` - now clones proof before mutation
- `undo_line()` - now clones proof before mutation
- `check_proof_complete()` - now clones proof before mutation

Pattern: `let mut working_proof = proof.clone();` at start, mutate working copy only.

---

### 11. ~~Missing Error Boundaries~~ ✅ FIXED (2026-02-02)

**Location:** `src/App.tsx`

**Problem:** No React error boundary to catch rendering errors. Uncaught errors crash the entire app.

**Resolution:**
- Created `src/components/ErrorBoundary.tsx` with:
  - `getDerivedStateFromError` to catch errors
  - `componentDidCatch` for error logging
  - User-friendly fallback UI with error message and "Try Again" button
- Updated `App.tsx` to wrap entire app with ErrorBoundary
- Styled using existing CSS variables for theme consistency

---

### 12. Missing Service Layer Tests

**Location:**
- `src-tauri/src/services/verifier.rs` - NO TESTS
- `src-tauri/src/services/generator.rs` - NO TESTS
- `src-tauri/src/services/storage.rs` - NO TESTS
- `src-tauri/src/services/proof_tree.rs` - NO TESTS
- `src-tauri/src/services/truth_table.rs` - NO TESTS

**Problem:** Critical services have zero test coverage. For a logic verification system, this is especially concerning.

**Impact:** No confidence in correctness, regressions undetected.

**Proposal:** Add comprehensive unit tests for each service, prioritizing verifier.rs (proof correctness) and storage.rs (data integrity).

**Estimated Effort:** Large

---

## Medium Priority

Issues that should be addressed but don't block core functionality.

### 13. FormulaDisplay Component Too Complex

**Location:** `src/components/FormulaDisplay.tsx` (551 lines)

**Problem:**
- Multiple concerns: bracket parsing, coloring, SVG line rendering, collapse/expand
- Complex state management for bracket positions and collapse state
- Heavy rendering logic with character-by-character processing

**Impact:** Hard to maintain and test.

**Proposal:** Split into:
- `FormulaDisplay.tsx` - simplified main component
- `BracketParser.ts` - utility for parsing bracket pairs
- `BracketVisuals.tsx` - SVG line rendering
- `useCollapsibleBrackets.ts` - custom hook for collapse state
- `useBracketPositions.ts` - custom hook for position measurements

**Estimated Effort:** Medium

---

### 14. FitchBox Scope Info Performance

**Location:** `src/components/ProofWorkspace/FitchBox.tsx:100`

**Problem:**
```typescript
const scopeInfo = getScopeInfo(proof);  // Recalculated on every render!
```
Complex computation runs on every render even if `proof` hasn't changed.

**Impact:** Performance degradation with large proofs.

**Proposal:** Memoize with useMemo:
```typescript
const scopeInfo = useMemo(() => getScopeInfo(proof), [proof]);
```

**Estimated Effort:** Small

---

### 15. replace_subformula Code Duplication

**Location:**
- `src-tauri/src/services/verifier.rs:296-323`
- `src-tauri/src/models/rules/equivalence.rs:331-358`

**Problem:** Three nearly identical implementations of `replace_subformula` function.

**Impact:** Maintenance burden, bug fix duplication.

**Proposal:** Extract to shared utility module:
```rust
// src-tauri/src/utils/formula_utils.rs
pub fn replace_subformula(formula: &Formula, target: &Formula, replacement: &Formula) -> Formula {
    // Shared implementation
}
```

**Estimated Effort:** Small

---

### 16. Excessive unwrap/expect Calls

**Location:** Throughout backend (159 occurrences)

**Problem:** Many `.unwrap()` and `.expect()` calls in production code can cause panics.

Key locations:
- `commands.rs:177` - `self.lines.last().expect("line was just pushed")`
- `lib.rs:42` - `.expect("error while running tauri application")`
- `storage.rs:351` - `Self::new().expect("Failed to initialize storage service")`

**Impact:** Application crashes on unexpected states.

**Proposal:** Replace with proper `?` error propagation, add context to errors:
```rust
self.lines.last().ok_or_else(|| "No lines in proof".to_string())?
```

**Estimated Effort:** Medium

---

### 17. Missing Accessibility Attributes

**Location:** Multiple components

**Problems:**
- `ProofLine.tsx:96-102` - No ARIA labels for clickable proof lines
- `RulePalette.tsx:95-109` - No `aria-pressed` or `aria-selected` attributes
- `TheoremList.tsx:164-182` - No keyboard navigation support
- `CustomTheoremModal.tsx` - No focus trap, focus not set on open

**Impact:** Poor accessibility for screen reader users and keyboard-only users.

**Proposal:** Add ARIA attributes, keyboard handlers, and focus management:
```typescript
<div
  className="proof-line"
  role={readOnly ? undefined : "button"}
  aria-selected={isSelected}
  tabIndex={readOnly ? undefined : 0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') onClick();
  }}
>
```

**Estimated Effort:** Medium

---

### 18. String Error Types in Commands

**Location:** All Rust commands in `src-tauri/src/commands.rs`

**Problem:** All commands return `Result<T, String>` instead of structured error types.

**Impact:**
- No error codes for frontend to handle specific cases
- Potential information leak in error messages
- Inconsistent error formats

**Proposal:** Create structured error enum:
```rust
#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "details")]
pub enum AppError {
    ParseError { message: String, position: usize },
    ValidationError { message: String },
    StorageError { message: String },
    NotFound { resource: String, id: String },
}
```

**Estimated Effort:** Medium

---

### 19. Missing Command Registration

**Location:** `src-tauri/src/lib.rs`

**Problem:** `generate_theorem_with_proof` is defined in `commands.rs:39` but not registered in the Tauri command list in `lib.rs`.

**Impact:** Command not available to frontend.

**Proposal:** Add to command registration:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::generate_theorem_with_proof,
])
```

**Estimated Effort:** Small

---

### 20. Missing App Icons

**Location:** `src-tauri/tauri.conf.json:32`

**Problem:** `icon: []` - no application icons configured.

**Impact:** Generic/missing icon in dock, application switcher, and file associations.

**Proposal:** Generate icon set (icns for macOS, ico for Windows, png for Linux) and configure in tauri.conf.json.

**Estimated Effort:** Small

---

## Low Priority

Technical debt and improvements that can be addressed over time.

### 21. No CI/CD Pipeline

**Location:** Project root

**Problem:** No GitHub Actions or CI configuration for automated builds and tests.

**Impact:** Manual release process, no automated quality gates.

**Proposal:** Add GitHub Actions workflow:
- Run Rust tests on PR
- Run TypeScript type checking
- Build release artifacts
- Automated version tagging

**Estimated Effort:** Medium

---

### 22. No ESLint/Prettier Configuration

**Location:** Project root

**Problem:** No code formatting or linting configuration.

**Impact:** Inconsistent code style, potential bugs from missing lint rules.

**Proposal:** Add ESLint with TypeScript support and Prettier for formatting.

**Estimated Effort:** Small

---

### 23. Version Stuck at 0.1.0

**Location:** `src-tauri/Cargo.toml`, `package.json`

**Problem:** Version number hasn't been updated despite multiple releases (v1.90 per git log).

**Impact:** Version mismatch between code and releases.

**Proposal:** Implement semantic versioning workflow, update to current version.

**Estimated Effort:** Small

---

### 24. CSP Disabled

**Location:** `src-tauri/tauri.conf.json`

**Problem:** Content Security Policy is set to null, disabling security protections.

**Impact:** Potential XSS vulnerabilities in production.

**Proposal:** Enable appropriate CSP for production builds.

**Estimated Effort:** Small

---

### 25. Magic Numbers Throughout Codebase

**Location:** Multiple files

**Examples:**
- `FitchBox.tsx:408` - `const lineSpacing = 8;`
- `FormulaDisplay.tsx:407` - `const lineSpacing = 8;`
- `Portfolio.tsx:314` - `rows={4}` for textarea

**Impact:** Hard to maintain, inconsistent values.

**Proposal:** Extract to constants file:
```typescript
// src/constants/layout.ts
export const BRACKET_LINE_SPACING = 8;
export const DEFAULT_TEXTAREA_ROWS = 4;
```

**Estimated Effort:** Small

---

### 26. Console Logs in Production Code

**Location:**
- `src/components/Portfolio/Portfolio.tsx:98`
- `src/components/TheoremList/CustomTheoremModal.tsx:259`

**Problem:** `console.error()` calls in production code.

**Impact:** Pollutes browser console, potential information leak.

**Proposal:** Replace with proper error logging service or remove in production builds.

**Estimated Effort:** Small

---

### 27. Formula Validation Logic Duplication

**Location:**
- `src/hooks/useScratchpad.ts:36-68`
- `src/components/TheoremList/CustomTheoremModal.tsx:124-156`

**Problem:** Both validate formulas by invoking `parse_formula` with identical logic.

**Impact:** Maintenance burden, inconsistency risk.

**Proposal:** Extract shared hook:
```typescript
// src/hooks/useFormulaValidation.ts
export const useFormulaValidation = () => {
  const validateFormula = async (formulaStr: string): Promise<{
    valid: boolean;
    formula?: Formula;
    error?: string;
  }> => {
    // Shared implementation
  };
  return { validateFormula };
};
```

**Estimated Effort:** Small

---

### 28. Truth Table Caching

**Location:** `src-tauri/src/services/truth_table.rs`

**Problem:** Truth tables are computed repeatedly for the same formulas without caching.

**Impact:** Performance overhead for repeated calculations.

**Proposal:** Implement memoization or add `truth_table: Option<u32>` field to Formula with lazy evaluation.

**Estimated Effort:** Medium

---

## Quick Wins

Easy fixes that can be implemented quickly:

| # | Issue | Location | Change | Status |
|---|-------|----------|--------|--------|
| 1 | Memoize scopeInfo | `FitchBox.tsx:100` | Wrap in `useMemo` | Open |
| 2 | ~~Add null check~~ | `proofReorder.ts:143` | Check `fromIndex !== -1` | ✅ Fixed |
| 3 | ~~Fix timer memory leak~~ | `FitchBox.tsx:122-147` | Use ref for timer | ✅ Fixed |
| 4 | Register missing command | `lib.rs` | Add `generate_theorem_with_proof` | Open |
| 5 | Fix theme useEffect deps | `App.tsx:22-26` | Add `theme` to dependency array | Open |
| 6 | ~~Extract symbol constants~~ | 3 files | Created `shared/SymbolToolbar.tsx` | ✅ Fixed |

---

## Progress Tracking

| Priority | Total | Completed | In Progress |
|----------|-------|-----------|-------------|
| Critical | 5 | **5** | 0 |
| High | 7 | **6** | 0 |
| Medium | 8 | 0 | 0 |
| Low | 8 | 0 | 0 |
| **Total** | **28** | **11** | **0** |

**Last Updated:** 2026-02-02

### Completed Items
- ✅ Issue #1: Frontend testing infrastructure (Vitest + 36 tests)
- ✅ Issue #2: ProofWorkspace refactored (1,145 → 698 lines)
- ✅ Issue #3: Race condition in auto-apply fixed
- ✅ Issue #4: FitchBox timer memory leak fixed
- ✅ Issue #5: Null check in reorderLines added
- ✅ Issue #6: StorageService singleton implemented
- ✅ Issue #7: Formula cloning analyzed, SharedFormula type added
- ✅ Issue #8: tree_gen.rs split into module (2,341 → 5 files)
- ✅ Issue #9: SymbolToolbar shared component created
- ✅ Issue #10: Proof mutation on error fixed
- ✅ Issue #11: ErrorBoundary component added

---

## Recommended Action Order

~~**Week 1:** Critical issues #1-5~~ ✅ COMPLETED
~~**Week 2:** High priority #6-12~~ ✅ 6/7 COMPLETED (Issue #12: Backend tests remaining)
**Week 3-4:** Medium priority #13-20
**Ongoing:** Low priority #21-28
