import React, { useRef } from 'react';
import { SymbolToolbar } from '../shared/SymbolToolbar';

interface FormulaInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

// Symbol replacements: typing these characters auto-converts to logic symbols
const SYMBOL_REPLACEMENTS: Record<string, string> = {
  '>': '⊃',  // Implication
  'v': '∨',  // Disjunction (lowercase v)
  'V': '∨',  // Disjunction (uppercase V)
  '&': '.',  // Conjunction
  '<>': '≡', // Biconditional
  '!': '~',  // Negation
};

export const FormulaInput: React.FC<FormulaInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Enter formula...',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit();
    }
  };

  // Auto-replace common ASCII symbols with logic symbols
  const handleChange = (newValue: string) => {
    // Check for two-character replacements first (like <>)
    let result = newValue;
    for (const [ascii, symbol] of Object.entries(SYMBOL_REPLACEMENTS)) {
      if (ascii.length === 2) {
        result = result.replace(new RegExp(ascii.replace(/[<>]/g, '\\$&'), 'g'), symbol);
      }
    }
    // Then single-character replacements
    for (const [ascii, symbol] of Object.entries(SYMBOL_REPLACEMENTS)) {
      if (ascii.length === 1) {
        result = result.replace(new RegExp(ascii.replace(/[&]/g, '\\$&'), 'g'), symbol);
      }
    }
    onChange(result);
  };

  const insertSymbol = (symbol: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + symbol + value.slice(end);
      onChange(newValue);

      // Move cursor after inserted symbol
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + symbol.length;
        input.focus();
      }, 0);
    } else {
      onChange(value + symbol);
    }
  };

  return (
    <div className="formula-input-container">
      <input
        ref={inputRef}
        type="text"
        className="formula-input"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      <SymbolToolbar onSymbolClick={insertSymbol} />
    </div>
  );
};
