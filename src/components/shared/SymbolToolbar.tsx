import React from 'react';

const SYMBOLS = [
  { symbol: '~', label: '~', description: 'Negation' },
  { symbol: '.', label: '.', description: 'Conjunction (AND)' },
  { symbol: '∨', label: '∨', description: 'Disjunction (OR)' },
  { symbol: '⊃', label: '⊃', description: 'Implication' },
  { symbol: '≡', label: '≡', description: 'Biconditional' },
  { symbol: '⊥', label: '⊥', description: 'Contradiction' },
  { symbol: '(', label: '(', description: 'Left paren' },
  { symbol: ')', label: ')', description: 'Right paren' },
];

const ATOMS = ['P', 'Q', 'R', 'S', 'T'];

interface SymbolToolbarProps {
  onSymbolClick: (symbol: string) => void;
  compact?: boolean;
  includeAtoms?: boolean;
}

export const SymbolToolbar: React.FC<SymbolToolbarProps> = ({
  onSymbolClick,
  compact = false,
  includeAtoms = true,
}) => {
  const buttonStyle = compact ? { padding: '4px 8px', fontSize: '0.875rem' } : undefined;
  const spacerWidth = compact ? '4px' : '8px';

  return (
    <div className="symbol-toolbar">
      {includeAtoms && (
        <>
          {ATOMS.map((atom) => (
            <button
              key={atom}
              className="symbol-button"
              onClick={() => onSymbolClick(atom)}
              title={`Atom ${atom}`}
              style={buttonStyle}
            >
              {atom}
            </button>
          ))}
          <span style={{ width: spacerWidth }} />
        </>
      )}
      {SYMBOLS.map((s) => (
        <button
          key={s.symbol}
          className="symbol-button"
          onClick={() => onSymbolClick(s.symbol)}
          title={s.description}
          style={buttonStyle}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
};
