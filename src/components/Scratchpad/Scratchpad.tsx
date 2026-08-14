import React, { useState, useRef } from 'react';
import { useScratchpad } from '../../hooks/useScratchpad';
import { SymbolToolbar } from '../shared/SymbolToolbar';

const SYMBOL_REPLACEMENTS: Record<string, string> = {
  '>': '⊃',
  'v': '∨',
  'V': '∨',
  '&': '.',
  '<>': '≡',
  '!': '~',
};

type InputMode = 'formula' | 'note';

export const Scratchpad: React.FC = () => {
  const {
    lines,
    selectedLineId,
    availableTransformations,
    isLoading,
    error,
    addFormula,
    addNote,
    applyTransformation,
    selectLine,
    removeLine,
    clearAll,
    copyToProof,
    clearError,
  } = useScratchpad();

  const [formulaInput, setFormulaInput] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('formula');
  const inputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (newValue: string) => {
    let result = newValue;
    for (const [ascii, symbol] of Object.entries(SYMBOL_REPLACEMENTS)) {
      if (ascii.length === 2) {
        result = result.replace(new RegExp(ascii.replace(/[<>]/g, '\\$&'), 'g'), symbol);
      }
    }
    for (const [ascii, symbol] of Object.entries(SYMBOL_REPLACEMENTS)) {
      if (ascii.length === 1) {
        result = result.replace(new RegExp(ascii.replace(/[&]/g, '\\$&'), 'g'), symbol);
      }
    }
    setFormulaInput(result);
  };

  const insertSymbol = (symbol: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      const newValue = formulaInput.slice(0, start) + symbol + formulaInput.slice(end);
      setFormulaInput(newValue);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + symbol.length;
        input.focus();
      }, 0);
    } else {
      setFormulaInput(formulaInput + symbol);
    }
  };

  const handleSubmit = async () => {
    if (!formulaInput.trim()) return;
    if (inputMode === 'formula') {
      const success = await addFormula(formulaInput);
      if (success) {
        setFormulaInput('');
      }
    } else {
      addNote(formulaInput);
      setFormulaInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && formulaInput.trim()) {
      if (inputMode === 'note' && !e.shiftKey) {
        // For notes, Enter without Shift submits
        e.preventDefault();
        handleSubmit();
      } else if (inputMode === 'formula') {
        handleSubmit();
      }
    }
  };

  const handleCopyToProof = () => {
    if (selectedLineId) {
      copyToProof(selectedLineId);
    }
  };

  const selectedLine = lines.find(l => l.id === selectedLineId);
  const canCopyToProof = selectedLine && selectedLine.lineType === 'formula';

  return (
    <div className="scratchpad">
      {/* Input Mode Tabs */}
      <div className="scratchpad-mode-tabs">
        <button
          className={`mode-tab ${inputMode === 'formula' ? 'active' : ''}`}
          onClick={() => setInputMode('formula')}
        >
          Formula
        </button>
        <button
          className={`mode-tab ${inputMode === 'note' ? 'active' : ''}`}
          onClick={() => setInputMode('note')}
        >
          Note
        </button>
      </div>

      {/* Formula Input */}
      {inputMode === 'formula' ? (
        <div className="scratchpad-input">
          <input
            ref={inputRef}
            type="text"
            className="formula-input"
            value={formulaInput}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter formula..."
            spellCheck={false}
            autoComplete="off"
          />
          <div style={{ marginTop: '6px' }}>
            <SymbolToolbar onSymbolClick={insertSymbol} compact={true} />
          </div>
        </div>
      ) : (
        <div className="scratchpad-input">
          <textarea
            ref={noteInputRef}
            className="note-input"
            value={formulaInput}
            onChange={(e) => setFormulaInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note..."
            rows={2}
          />
          <button
            className="btn btn-primary btn-small"
            onClick={handleSubmit}
            disabled={!formulaInput.trim()}
            style={{ marginTop: '6px', alignSelf: 'flex-end' }}
          >
            Add Note
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="scratchpad-error">
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
            x
          </button>
        </div>
      )}

      {/* Lines List */}
      <div className="scratchpad-lines">
        {lines.length === 0 ? (
          <div className="scratchpad-empty">
            Enter a formula above to explore its equivalent forms
          </div>
        ) : (
          lines.map((line, index) => (
            <div
              key={line.id}
              className={`scratchpad-line ${line.lineType} ${selectedLineId === line.id ? 'selected' : ''}`}
              onClick={() => selectLine(line.id)}
            >
              <span className="line-number">{index + 1}.</span>
              {line.lineType === 'note' ? (
                <span className="note-text">{line.formula}</span>
              ) : (
                <span className="formula">{line.formula}</span>
              )}
              {line.sourceRule && (
                <span className="rule-badge">{line.sourceRule}</span>
              )}
              {line.lineType === 'note' && (
                <span className="note-badge">note</span>
              )}
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLine(line.id);
                }}
                title="Remove line"
              >
                x
              </button>
            </div>
          ))
        )}
      </div>

      {/* Transformations Section - only for formula lines */}
      {selectedLine && selectedLine.lineType === 'formula' && (
        <div className="scratchpad-transformations">
          <div className="transformations-header">
            Transformations for line {lines.findIndex(l => l.id === selectedLineId) + 1}:
          </div>
          {isLoading ? (
            <div className="transformations-loading">Loading...</div>
          ) : availableTransformations.length === 0 ? (
            <div className="transformations-empty">No transformations available</div>
          ) : (
            <div className="transformations-list">
              {availableTransformations.map((t, idx) => (
                <button
                  key={`${t.rule}-${idx}`}
                  className="transformation-btn"
                  onClick={() => applyTransformation(selectedLineId!, t)}
                  title={t.rule_name}
                >
                  <span className="transformation-result">{t.result}</span>
                  <span className="transformation-rule">{t.rule_abbrev}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="scratchpad-actions">
        <button
          className="btn btn-secondary"
          onClick={clearAll}
          disabled={lines.length === 0}
        >
          Clear All
        </button>
        <button
          className="btn btn-primary"
          onClick={handleCopyToProof}
          disabled={!canCopyToProof}
          title={selectedLine?.lineType === 'note' ? 'Cannot copy notes to proof' : 'Copy formula to proof input'}
        >
          Copy to Proof
        </button>
      </div>
    </div>
  );
};
