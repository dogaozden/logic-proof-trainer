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

// Predicate logic and set theory (shown for first-order theorems)
const FIRST_ORDER_SYMBOLS = [
  { symbol: '∀', description: 'For all' },
  { symbol: '∃', description: 'There exists' },
  { symbol: '=', description: 'Identity' },
  { symbol: '≠', description: 'Not identical' },
  { symbol: '∈', description: 'Belongs to' },
  { symbol: '∉', description: 'Does not belong to' },
  { symbol: '⊆', description: 'Included in' },
  { symbol: '∪', description: 'Union' },
  { symbol: '∩', description: 'Intersection' },
  { symbol: '−', description: 'Relative complement' },
  { symbol: '∅', description: 'Empty set' },
  { symbol: '℘', description: 'Power set' },
  { symbol: '{', description: 'Set braces' },
  { symbol: '}', description: 'Set braces' },
  { symbol: ',', description: 'Comma' },
  { symbol: '⟨', description: 'Ordered pair' },
  { symbol: '⟩', description: 'Ordered pair' },
];

const NAMES = ['a', 'b', 'c', 'x', 'y', 'z'];

interface SymbolToolbarProps {
  onSymbolClick: (symbol: string) => void;
  compact?: boolean;
  includeAtoms?: boolean;
  firstOrder?: boolean;
}

export const SymbolToolbar: React.FC<SymbolToolbarProps> = ({
  onSymbolClick,
  compact = false,
  includeAtoms = true,
  firstOrder = false,
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
      {firstOrder && (
        <>
          <span style={{ width: spacerWidth }} />
          {FIRST_ORDER_SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              className="symbol-button"
              onClick={() => onSymbolClick(s.symbol)}
              title={s.description}
              style={buttonStyle}
            >
              {s.symbol}
            </button>
          ))}
          <span style={{ width: spacerWidth }} />
          {NAMES.map((n) => (
            <button
              key={n}
              className="symbol-button"
              onClick={() => onSymbolClick(n)}
              title={`Name ${n}`}
              style={buttonStyle}
            >
              {n}
            </button>
          ))}
        </>
      )}
    </div>
  );
};
