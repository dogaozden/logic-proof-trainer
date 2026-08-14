import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProof } from '../../hooks/useProof';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useScratchpad } from '../../hooks/useScratchpad';
import { useProofAutoApply } from '../../hooks/useProofAutoApply';
import { useProofGoals } from '../../hooks/useProofGoals';
import { useProofTimer } from '../../hooks/useProofTimer';
import { FitchBox } from './FitchBox';
import { FormulaInput } from './FormulaInput';
import { RulePalette } from './RulePalette';
import type { InferenceRule, EquivalenceRule, ProofTechnique } from '../../types';
import { inferenceRuleInfo, equivalenceRuleInfo, proofTechniqueInfo } from '../../types';
import { FormulaDisplay } from '../FormulaDisplay';
import { parseCommand, abbrevToInference, abbrevToEquivalence } from '../../utils/proofCommandParser';

// Type for auto-close info from backend
interface AutoCloseInfo {
  technique: string;
  conclusion: string;
}

export const ProofWorkspace: React.FC = () => {
  const {
    proof,
    selectedLines,
    error,
    hint,
    toggleLineSelection,
    clearLineSelection,
    applyInferenceRule,
    applyEquivalenceRule,
    openSubproof,
    closeSubproof,
    undoLine,
    getHint,
    clearProof,
    clearError,
    setError,
    reorderProof,
    renameProof,
  } = useProof();

  const { saveToPortfolio } = usePortfolio();
  const { copiedFormula, clearCopiedFormula } = useScratchpad();

  const [formulaInput, setFormulaInput] = useState('');
  const [selectedInferenceRule, setSelectedInferenceRule] = useState<InferenceRule | null>(null);
  const [selectedEquivalenceRule, setSelectedEquivalenceRule] = useState<EquivalenceRule | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<ProofTechnique | null>(null);
  const [mode, setMode] = useState<'apply' | 'open' | 'close'>('apply');

  // Proof renaming
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Ref to track selectedLines for use in async handlers (avoids stale closure issues)
  const selectedLinesRef = useRef<number[]>(selectedLines);
  useEffect(() => {
    selectedLinesRef.current = selectedLines;
  }, [selectedLines]);

  // Use extracted hooks
  const {
    scopeGoals,
    pendingGoalScopeId,
    goalInput,
    setGoalInput,
    handleGoalSubmit,
    handleGoalSkip,
  } = useProofGoals({ proof });

  const {
    incrementHintsUsed,
    getTimeSpent,
    getHintsUsed,
  } = useProofTimer({ proof, saveToPortfolio });

  const {
    tryAutoApplyInference,
    tryAutoApplyEquivalence,
  } = useProofAutoApply({
    proof,
    selectedLines,
    selectedInferenceRule,
    selectedEquivalenceRule,
    applyInferenceRule,
    applyEquivalenceRule,
    clearLineSelection,
    setSelectedInferenceRule,
    setSelectedEquivalenceRule,
    setFormulaInput,
  });

  // Track hints used
  const handleGetHint = async () => {
    incrementHintsUsed();
    await getHint();
  };

  // Save incomplete proof progress to portfolio
  const handleSaveProgress = async () => {
    if (!proof || proof.is_complete) return;
    const timeSpent = getTimeSpent();
    const hintsUsed = getHintsUsed();
    const entry = await saveToPortfolio(proof, timeSpent, hintsUsed);
    if (entry) {
      // Show brief success feedback (error state doubles as message)
      setError(null);
      // Could optionally add a success toast here
    }
  };

  // Populate formula input when a formula is copied from scratchpad
  useEffect(() => {
    if (copiedFormula) {
      setFormulaInput(copiedFormula);
      clearCopiedFormula();
    }
  }, [copiedFormula, clearCopiedFormula]);

  if (!proof) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <h2>No Proof Active</h2>
          <p>Select a theorem from the sidebar and click "Start Proof" to begin.</p>
        </div>
      </div>
    );
  }

  const handleLineClick = (lineNumber: number) => {
    toggleLineSelection(lineNumber);
  };

  const handleApply = async () => {
    if (!formulaInput.trim()) return;

    // Use the unified parser
    const parsed = parseCommand(formulaInput);

    if (parsed) {
      switch (parsed.type) {
        case 'subproofClose': {
          const { formula, technique } = parsed;
          if (formula) {
            // User provided a formula - use it directly
            const success = await closeSubproof(technique, formula);
            if (success) setFormulaInput('');
          } else {
            // No formula - try auto-close
            try {
              const autoClose = await invoke<AutoCloseInfo | null>('get_subproof_auto_close', { proof });
              if (autoClose) {
                const success = await closeSubproof(technique, autoClose.conclusion);
                if (success) setFormulaInput('');
              } else {
                if (technique === 'indirectProof') {
                  setError('Cannot close: derive a contradiction (⊥) first');
                } else {
                  setError('Cannot auto-close subproof - provide the conclusion formula');
                }
              }
            } catch (err) {
              setError(`Error closing subproof: ${err}`);
            }
          }
          return;
        }

        case 'subproofOpen': {
          const success = await openSubproof(parsed.technique, parsed.formula);
          if (success) setFormulaInput('');
          return;
        }

        case 'ruleApplication': {
          const { formula, lines, rule, ruleType } = parsed;
          const ruleLower = rule.toLowerCase();

          if (ruleType === 'inference') {
            const inferenceRule = abbrevToInference[ruleLower];
            const success = await applyInferenceRule(inferenceRule, lines, formula);
            if (success) setFormulaInput('');
          } else {
            // Equivalence rule
            if (lines.length !== 1) {
              setError('Equivalence rules require exactly 1 line');
              return;
            }
            const equivalenceRule = abbrevToEquivalence[ruleLower];
            const success = await applyEquivalenceRule(equivalenceRule, lines[0], formula);
            if (success) setFormulaInput('');
          }
          return;
        }
      }
    }

    // Fall back to the old behavior using selected rule and lines from UI
    if (selectedInferenceRule) {
      const info = inferenceRuleInfo[selectedInferenceRule];
      if (selectedLines.length !== info.premises) {
        setError(`${info.name} requires ${info.premises} premise(s), but ${selectedLines.length} line(s) selected`);
        return;
      }
      const success = await applyInferenceRule(selectedInferenceRule, selectedLines, formulaInput);
      if (success) {
        setFormulaInput('');
        setSelectedInferenceRule(null);
        setSelectedEquivalenceRule(null);
      }
    } else if (selectedEquivalenceRule && selectedLines.length === 1) {
      const success = await applyEquivalenceRule(selectedEquivalenceRule, selectedLines[0], formulaInput);
      if (success) {
        setFormulaInput('');
        setSelectedInferenceRule(null);
        setSelectedEquivalenceRule(null);
      }
    } else if (selectedEquivalenceRule) {
      setError('Equivalence rules require exactly 1 line selected');
    } else {
      setError('Use format: Q 1,2 MP  or  P > Q 2-5 CP  or select a rule from the palette');
    }
  };

  const handleOpenSubproof = async () => {
    if (!formulaInput.trim()) {
      setError('Enter a formula to assume');
      return;
    }

    // Try the unified parser first
    const parsed = parseCommand(formulaInput);
    if (parsed?.type === 'subproofOpen') {
      const success = await openSubproof(parsed.technique, parsed.formula);
      if (success) {
        setFormulaInput('');
        setSelectedTechnique(null);
        setMode('apply');
      }
      return;
    }

    // If user typed a close command while in open mode, route to close logic
    if (parsed?.type === 'subproofClose') {
      const { formula, technique } = parsed;
      if (formula) {
        const success = await closeSubproof(technique, formula);
        if (success) {
          setFormulaInput('');
          setSelectedTechnique(null);
          setMode('apply');
        }
      } else {
        // Auto-close
        try {
          const autoClose = await invoke<AutoCloseInfo | null>('get_subproof_auto_close', { proof });
          if (autoClose) {
            const success = await closeSubproof(technique, autoClose.conclusion);
            if (success) {
              setFormulaInput('');
              setSelectedTechnique(null);
              setMode('apply');
            }
          } else {
            if (technique === 'indirectProof') {
              setError('Cannot close: derive a contradiction (⊥) first');
            } else {
              setError('Cannot auto-close subproof - provide the conclusion formula');
            }
          }
        } catch (err) {
          setError(`Error closing subproof: ${err}`);
        }
      }
      return;
    }

    // Fall back to selected technique (user just typed a formula without technique)
    if (!selectedTechnique) {
      setError('Select a proof technique (CP or IP) first, or use format: P CP');
      return;
    }
    const success = await openSubproof(selectedTechnique, formulaInput);
    if (success) {
      setFormulaInput('');
      setSelectedTechnique(null);
      setMode('apply');
    }
  };

  const handleCloseSubproof = async () => {
    if (!formulaInput.trim()) {
      // No input - try auto-close with current technique
      const currentScope = proof?.scope_manager.scopes.find(s => s.end_line === undefined);
      const technique = selectedTechnique || (currentScope?.technique as ProofTechnique | undefined);

      if (!technique) {
        setError('No open subproof to close');
        return;
      }

      try {
        const autoClose = await invoke<AutoCloseInfo | null>('get_subproof_auto_close', { proof });
        if (autoClose) {
          const success = await closeSubproof(technique, autoClose.conclusion);
          if (success) {
            setFormulaInput('');
            setSelectedTechnique(null);
            setMode('apply');
          }
        } else {
          if (technique === 'indirectProof') {
            setError('Cannot close: derive a contradiction (⊥) first');
          } else {
            setError('Cannot auto-close subproof - provide the conclusion formula');
          }
        }
      } catch (err) {
        setError(`Error closing subproof: ${err}`);
      }
      return;
    }

    // Try parsing as subproof close using unified parser
    const parsed = parseCommand(formulaInput);
    if (parsed?.type === 'subproofClose') {
      const { formula, technique } = parsed;
      if (formula) {
        const success = await closeSubproof(technique, formula);
        if (success) {
          setFormulaInput('');
          setSelectedTechnique(null);
          setMode('apply');
        }
      } else {
        // Auto-close
        try {
          const autoClose = await invoke<AutoCloseInfo | null>('get_subproof_auto_close', { proof });
          if (autoClose) {
            const success = await closeSubproof(technique, autoClose.conclusion);
            if (success) {
              setFormulaInput('');
              setSelectedTechnique(null);
              setMode('apply');
            }
          } else {
            if (technique === 'indirectProof') {
              setError('Cannot close: derive a contradiction (⊥) first');
            } else {
              setError('Cannot auto-close subproof');
            }
          }
        } catch (err) {
          setError(`Error closing subproof: ${err}`);
        }
      }
      return;
    }

    // Fall back: treat entire input as conclusion formula, use current scope's technique
    const currentScope = proof?.scope_manager.scopes.find(s => s.end_line === undefined);
    const currentTechnique = selectedTechnique || (currentScope?.technique as ProofTechnique | undefined);

    if (!currentTechnique) {
      setError('No open subproof to close');
      return;
    }

    const success = await closeSubproof(currentTechnique, formulaInput);
    if (success) {
      setFormulaInput('');
      setSelectedTechnique(null);
      setMode('apply');
    }
  };

  const handleSubmit = () => {
    if (mode === 'open') {
      handleOpenSubproof();
    } else if (mode === 'close') {
      handleCloseSubproof();
    } else {
      handleApply();
    }
  };

  // Handle rule selection - also try to auto-apply if lines are already selected
  const handleSelectInferenceRule = async (rule: InferenceRule | null) => {
    setSelectedInferenceRule(rule);
    setSelectedEquivalenceRule(null);
    setSelectedTechnique(null);
    if (rule) {
      setMode('apply');
      // Use ref to get latest selectedLines value (avoids stale closure)
      const lines = selectedLinesRef.current;
      if (lines.length > 0) {
        await tryAutoApplyInference(rule, lines);
      }
    }
  };

  const handleSelectEquivalenceRule = async (rule: EquivalenceRule | null) => {
    setSelectedEquivalenceRule(rule);
    setSelectedInferenceRule(null);
    setSelectedTechnique(null);
    if (rule) {
      setMode('apply');
      // Use ref to get latest selectedLines value (avoids stale closure)
      const lines = selectedLinesRef.current;
      if (lines.length === 1) {
        await tryAutoApplyEquivalence(rule, lines[0]);
      }
    }
  };

  const handleSelectTechnique = async (technique: ProofTechnique | null) => {
    if (!technique) {
      setSelectedTechnique(null);
      return;
    }

    // Get the innermost (current) open scope - this is what the backend uses
    const openScopes = proof?.scope_manager.scopes.filter(s => s.end_line === undefined) || [];
    const innermostScope = openScopes.length > 0 ? openScopes[openScopes.length - 1] : null;

    // Only try to auto-close if the innermost scope matches the clicked technique
    if (innermostScope && innermostScope.technique === technique) {
      // We're in an open subproof of the same type - try to auto-close
      try {
        const autoClose = await invoke<AutoCloseInfo | null>('get_subproof_auto_close', { proof });

        if (autoClose) {
          // Auto-close with computed conclusion
          const success = await closeSubproof(technique, autoClose.conclusion);
          if (success) {
            setSelectedTechnique(null);
            setMode('apply');
          }
        } else {
          // Can't auto-close (e.g., IP without contradiction)
          if (technique === 'indirectProof') {
            setError('Cannot close: derive a contradiction (⊥) first');
          } else {
            setError('Cannot auto-close subproof');
          }
        }
      } catch (err) {
        setError(`Error closing subproof: ${err}`);
      }
    } else {
      // Not in matching subproof - open new one or select technique
      setSelectedTechnique(technique);
      setSelectedInferenceRule(null);
      setSelectedEquivalenceRule(null);
      setMode('open');
    }
  };

  const currentDepth = proof.scope_manager.scopes.filter(s => s.end_line === undefined).length;
  const hasOpenSubproof = currentDepth > 0;

  // Get the current (innermost) scope's technique if there's an open subproof
  const openScopes = proof.scope_manager.scopes.filter(s => s.end_line === undefined);
  const currentScopeTechnique = hasOpenSubproof
    ? openScopes[openScopes.length - 1]?.technique
    : null;

  const handleStartRename = () => {
    setNameInput(proof.theorem.name || '');
    setIsEditingName(true);
  };

  const handleSaveRename = () => {
    if (nameInput.trim()) {
      renameProof(nameInput.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelRename = () => {
    setIsEditingName(false);
    setNameInput('');
  };

  return (
    <div className="main-content">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditingName ? (
            <>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                autoFocus
                style={{
                  padding: '4px 8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  border: '1px solid var(--accent)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: '200px',
                }}
                placeholder="Enter name..."
              />
              <button className="btn btn-primary btn-small" onClick={handleSaveRename}>
                Save
              </button>
              <button className="btn btn-secondary btn-small" onClick={handleCancelRename}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <h1 style={{ cursor: 'pointer' }} onClick={handleStartRename} title="Click to rename">
                {proof.theorem.name || 'Untitled Proof'}
              </h1>
              <button
                className="btn-icon"
                onClick={handleStartRename}
                title="Rename proof"
                style={{ fontSize: '0.875rem' }}
              >
                ✏️
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!proof.is_complete && (
            <button className="btn btn-secondary" onClick={handleSaveProgress}>
              Save Progress
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleGetHint}>
            Hint
          </button>
          <button className="btn btn-secondary" onClick={undoLine}>
            Undo
          </button>
          <button className="btn btn-secondary" onClick={clearProof}>
            Close
          </button>
        </div>
      </div>

      <div className="workspace-layout">
        <div className="proof-area">
          {/* Theorem Display */}
          <div className="theorem-display">
            <div className="label">Prove:</div>
            <div className="formula">
              {proof.theorem.premises.length > 0 && (
                <>
                  {proof.theorem.premises.map((p, i) => (
                    <span key={i}>
                      <FormulaDisplay formula={p} />
                      {i < proof.theorem.premises.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                  {' ∴ '}
                </>
              )}
              <FormulaDisplay formula={proof.theorem.conclusion} />
            </div>
          </div>

          {/* Proof Complete Message */}
          {proof.is_complete && (
            <div className="success-message fade-in">
              Proof Complete! The conclusion has been derived.
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
              <button
                onClick={clearError}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Hint Message */}
          {hint && (
            <div className="hint-message">
              {hint}
            </div>
          )}

          {/* Fitch-style Proof Box */}
          <FitchBox
            proof={proof}
            selectedLines={selectedLines}
            onLineClick={handleLineClick}
            scopeGoals={scopeGoals}
            pendingGoalScopeId={pendingGoalScopeId}
            goalInput={goalInput}
            onGoalInputChange={setGoalInput}
            onGoalSubmit={handleGoalSubmit}
            onGoalSkip={handleGoalSkip}
            isComplete={proof.is_complete}
            onReorder={reorderProof}
          />

          {/* Mode Selector for Subproofs */}
          {(selectedTechnique || hasOpenSubproof) && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                className={`btn ${mode === 'apply' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('apply')}
              >
                Apply Rule
              </button>
              <button
                className={`btn ${mode === 'open' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('open')}
              >
                Open Subproof
              </button>
              {hasOpenSubproof && (
                <button
                  className={`btn ${mode === 'close' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMode('close')}
                >
                  Close Subproof
                </button>
              )}
            </div>
          )}

          {/* Formula Input */}
          <FormulaInput
            value={formulaInput}
            onChange={setFormulaInput}
            onSubmit={handleSubmit}
            placeholder="Q 1,2 MP  or  Q //1, 2, MP"
          />

          {/* Selection Info */}
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            {selectedLines.length > 0 && (
              <span>Selected lines: {selectedLines.join(', ')}</span>
            )}
            {selectedInferenceRule && (
              <span style={{ marginLeft: selectedLines.length > 0 ? '16px' : 0 }}>
                Rule: {inferenceRuleInfo[selectedInferenceRule].name}
                (needs {inferenceRuleInfo[selectedInferenceRule].premises} premise(s))
              </span>
            )}
            {selectedEquivalenceRule && (
              <span style={{ marginLeft: selectedLines.length > 0 ? '16px' : 0 }}>
                Rule: {equivalenceRuleInfo[selectedEquivalenceRule].name} (select 1 line, enter result)
              </span>
            )}
            {mode === 'open' && selectedTechnique && (
              <span>Opening subproof with {proofTechniqueInfo[selectedTechnique].name}</span>
            )}
            {mode === 'close' && (
              <span>Closing subproof (technique: {currentScopeTechnique})</span>
            )}
          </div>
        </div>

        {/* Rule Palette */}
        <RulePalette
          selectedInferenceRule={selectedInferenceRule}
          selectedEquivalenceRule={selectedEquivalenceRule}
          selectedTechnique={selectedTechnique}
          openSubproofTechnique={currentScopeTechnique as ProofTechnique | null}
          onSelectInferenceRule={handleSelectInferenceRule}
          onSelectEquivalenceRule={handleSelectEquivalenceRule}
          onSelectTechnique={handleSelectTechnique}
        />
      </div>
    </div>
  );
};
