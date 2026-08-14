import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTheorems } from '../../hooks/useTheorems';
import { useProof } from '../../hooks/useProof';
import { SymbolToolbar } from '../shared/SymbolToolbar';
import type { Theorem, Difficulty, Formula } from '../../types';
import { ALL_DIFFICULTIES, difficultyLabel, difficultyColor } from '../../types';

interface CustomTheoremModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (theorem: Theorem) => void;
}

// Symbol replacements (same as FormulaInput)
const SYMBOL_REPLACEMENTS: Record<string, string> = {
  '>': '⊃',
  'v': '∨',
  'V': '∨',
  '&': '.',
  '<>': '≡',
  '!': '~',
};

function applySymbolReplacements(value: string): string {
  let result = value;
  // Two-character replacements first
  for (const [ascii, symbol] of Object.entries(SYMBOL_REPLACEMENTS)) {
    if (ascii.length === 2) {
      result = result.replace(new RegExp(ascii.replace(/[<>]/g, '\\$&'), 'g'), symbol);
    }
  }
  // Single-character replacements
  for (const [ascii, symbol] of Object.entries(SYMBOL_REPLACEMENTS)) {
    if (ascii.length === 1) {
      result = result.replace(new RegExp(ascii.replace(/[&]/g, '\\$&'), 'g'), symbol);
    }
  }
  return result;
}

export const CustomTheoremModal: React.FC<CustomTheoremModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { saveCustomTheorem, selectTheorem } = useTheorems();
  const { createProof } = useProof();

  const [name, setName] = useState('');
  const [premises, setPremises] = useState<string[]>(['']);
  const [conclusion, setConclusion] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const [premiseErrors, setPremiseErrors] = useState<(string | null)[]>([null]);
  const [conclusionError, setConclusionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track focused input for symbol insertion
  const [focusedInput, setFocusedInput] = useState<{ type: 'premise' | 'conclusion'; index?: number } | null>(null);
  const premiseRefs = useRef<(HTMLInputElement | null)[]>([]);
  const conclusionRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setPremises(['']);
    setConclusion('');
    setDifficulty('medium');
    setPremiseErrors([null]);
    setConclusionError(null);
    setFocusedInput(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePremiseChange = (index: number, value: string) => {
    const newPremises = [...premises];
    newPremises[index] = applySymbolReplacements(value);
    setPremises(newPremises);

    // Clear error when typing
    const newErrors = [...premiseErrors];
    newErrors[index] = null;
    setPremiseErrors(newErrors);
  };

  const handleConclusionChange = (value: string) => {
    setConclusion(applySymbolReplacements(value));
    setConclusionError(null);
  };

  const addPremise = () => {
    setPremises([...premises, '']);
    setPremiseErrors([...premiseErrors, null]);
  };

  const removePremise = (index: number) => {
    if (premises.length === 1) {
      // Clear the last premise instead of removing
      setPremises(['']);
      setPremiseErrors([null]);
      return;
    }
    const newPremises = premises.filter((_, i) => i !== index);
    const newErrors = premiseErrors.filter((_, i) => i !== index);
    setPremises(newPremises);
    setPremiseErrors(newErrors);
  };

  const validateFormula = async (formulaStr: string): Promise<{ valid: boolean; formula?: Formula; error?: string }> => {
    const trimmed = formulaStr.trim();
    if (!trimmed) return { valid: true }; // Empty is OK for optional premises

    try {
      const formula = await invoke<Formula>('parse_formula', { input: trimmed });
      return { valid: true, formula };
    } catch (err) {
      return { valid: false, error: String(err) };
    }
  };

  const handlePremiseBlur = async (index: number) => {
    const value = premises[index].trim();
    if (!value) return;

    const result = await validateFormula(value);
    if (!result.valid) {
      const newErrors = [...premiseErrors];
      newErrors[index] = result.error || 'Invalid formula';
      setPremiseErrors(newErrors);
    }
  };

  const handleConclusionBlur = async () => {
    const value = conclusion.trim();
    if (!value) return;

    const result = await validateFormula(value);
    if (!result.valid) {
      setConclusionError(result.error || 'Invalid formula');
    }
  };

  const insertSymbol = (symbol: string) => {
    if (!focusedInput) return;

    if (focusedInput.type === 'premise' && focusedInput.index !== undefined) {
      const input = premiseRefs.current[focusedInput.index];
      if (input) {
        const start = input.selectionStart ?? premises[focusedInput.index].length;
        const end = input.selectionEnd ?? premises[focusedInput.index].length;
        const value = premises[focusedInput.index];
        const newValue = value.slice(0, start) + symbol + value.slice(end);
        handlePremiseChange(focusedInput.index, newValue);

        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + symbol.length;
          input.focus();
        }, 0);
      }
    } else if (focusedInput.type === 'conclusion') {
      const input = conclusionRef.current;
      if (input) {
        const start = input.selectionStart ?? conclusion.length;
        const end = input.selectionEnd ?? conclusion.length;
        const newValue = conclusion.slice(0, start) + symbol + conclusion.slice(end);
        handleConclusionChange(newValue);

        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + symbol.length;
          input.focus();
        }, 0);
      }
    }
  };

  const getDifficultyValue = (d: Difficulty): number => {
    switch (d) {
      case 'baby': return 10;
      case 'easy': return 20;
      case 'medium': return 40;
      case 'hard': return 60;
      case 'expert': return 80;
      case 'nightmare': return 90;
      case 'marathon': return 98;
      case 'absurd': return 100;
      case 'cosmic': return 100;
      case 'mind': return 100;
    }
  };

  const handleCreate = async () => {
    // Validate conclusion is not empty
    if (!conclusion.trim()) {
      setConclusionError('Conclusion is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse all formulas
      const parsedPremises: Formula[] = [];
      const newPremiseErrors: (string | null)[] = premises.map(() => null);
      let hasError = false;

      for (let i = 0; i < premises.length; i++) {
        const p = premises[i].trim();
        if (!p) continue;

        const result = await validateFormula(p);
        if (!result.valid) {
          newPremiseErrors[i] = result.error || 'Invalid formula';
          hasError = true;
        } else if (result.formula) {
          parsedPremises.push(result.formula);
        }
      }
      setPremiseErrors(newPremiseErrors);

      const conclusionResult = await validateFormula(conclusion);
      if (!conclusionResult.valid) {
        setConclusionError(conclusionResult.error || 'Invalid formula');
        hasError = true;
      }

      if (hasError || !conclusionResult.formula) {
        setIsSubmitting(false);
        return;
      }

      // Create the theorem
      const theoremName = name.trim() || `Custom Theorem ${Date.now()}`;
      const difficultyValue = getDifficultyValue(difficulty);

      const theorem: Theorem = {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: theoremName,
        premises: parsedPremises,
        conclusion: conclusionResult.formula,
        difficulty,
        difficulty_value: difficultyValue,
        is_classic: false,
      };

      await saveCustomTheorem(theorem);
      selectTheorem(theorem);
      // Auto-start proof after creation
      await createProof(theorem);
      onCreated(theorem);
      handleClose();
    } catch (err) {
      console.error('Failed to create theorem:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasErrors = premiseErrors.some(e => e !== null) || conclusionError !== null;
  const canSubmit = conclusion.trim() && !hasErrors && !isSubmitting;

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="custom-theorem-modal" onClick={e => e.stopPropagation()}>
        <button className="settings-close" onClick={handleClose}>×</button>

        <h2 style={{ marginBottom: '16px' }}>Create Custom Theorem</h2>

        {/* Name */}
        <div className="custom-theorem-field">
          <label className="custom-theorem-label">Name (optional)</label>
          <input
            type="text"
            className="custom-theorem-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., My Theorem"
            maxLength={200}
          />
        </div>

        {/* Premises */}
        <div className="custom-theorem-field">
          <label className="custom-theorem-label">
            Premises
            <span className="optional-hint">(optional - leave empty for no premises)</span>
          </label>
          <div className="premise-list">
            {premises.map((premise, index) => (
              <div key={index} className="premise-row">
                <span className="premise-number">{index + 1}.</span>
                <input
                  ref={el => premiseRefs.current[index] = el}
                  type="text"
                  className={`custom-theorem-input formula-style ${premiseErrors[index] ? 'has-error' : ''}`}
                  value={premise}
                  onChange={e => handlePremiseChange(index, e.target.value)}
                  onBlur={() => handlePremiseBlur(index)}
                  onFocus={() => setFocusedInput({ type: 'premise', index })}
                  placeholder="e.g., P ⊃ Q"
                  spellCheck={false}
                />
                <button
                  className="btn-icon remove-premise-btn"
                  onClick={() => removePremise(index)}
                  title="Remove premise"
                >
                  ×
                </button>
                {premiseErrors[index] && (
                  <div className="field-error">{premiseErrors[index]}</div>
                )}
              </div>
            ))}
          </div>
          <button
            className="btn btn-secondary add-premise-btn"
            onClick={addPremise}
          >
            + Add Premise
          </button>
        </div>

        {/* Conclusion */}
        <div className="custom-theorem-field">
          <label className="custom-theorem-label">Conclusion</label>
          <input
            ref={conclusionRef}
            type="text"
            className={`custom-theorem-input formula-style ${conclusionError ? 'has-error' : ''}`}
            value={conclusion}
            onChange={e => handleConclusionChange(e.target.value)}
            onBlur={handleConclusionBlur}
            onFocus={() => setFocusedInput({ type: 'conclusion' })}
            placeholder="e.g., Q"
            spellCheck={false}
          />
          {conclusionError && (
            <div className="field-error">{conclusionError}</div>
          )}
        </div>

        {/* Symbol Toolbar */}
        <div className="custom-theorem-field">
          <label className="custom-theorem-label">Symbol Palette</label>
          <SymbolToolbar onSymbolClick={insertSymbol} />
        </div>

        {/* Difficulty */}
        <div className="custom-theorem-field">
          <label className="custom-theorem-label">Difficulty</label>
          <div className="difficulty-selector">
            {ALL_DIFFICULTIES.map(d => (
              <button
                key={d}
                className={`btn ${difficulty === d ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDifficulty(d)}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  borderColor: difficulty === d ? difficultyColor(d) : undefined,
                }}
              >
                {difficultyLabel(d)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="custom-theorem-actions">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Creating...' : 'Create Theorem'}
          </button>
        </div>
      </div>
    </div>
  );
};
