import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export const Settings: React.FC = () => {
  const { theme, toggleHighContrast, coloredBrackets, toggleColoredBrackets, showBracketLines, toggleShowBracketLines, collapsibleBrackets, toggleCollapsibleBrackets } = useTheme();

  // Bracket colors based on theme
  // [] = always color 1
  // {} = depth-based: colors 2-8 for depth 0-6
  const squareColor = theme === 'high-contrast'
    ? { color: '#00ccff', name: 'Cyan' }
    : { color: '#0077ee', name: 'Blue' };

  const curlyColors = theme === 'high-contrast'
    ? [
      { color: '#ff3366', name: 'Crimson (depth 0)' },
      { color: '#33ff66', name: 'Lime (depth 1)' },
      { color: '#ff66ff', name: 'Magenta (depth 2)' },
      { color: '#ff9933', name: 'Orange (depth 3)' },
      { color: '#aaff44', name: 'Lime (depth 4)' },
      { color: '#66ddff', name: 'Sky Blue (depth 5)' },
      { color: '#ff7799', name: 'Coral (depth 6)' },
    ]
    : [
      { color: '#dd4422', name: 'Red-Orange (depth 0)' },
      { color: '#00aa77', name: 'Teal (depth 1)' },
      { color: '#aa44dd', name: 'Purple (depth 2)' },
      { color: '#dd2266', name: 'Magenta (depth 3)' },
      { color: '#88bb22', name: 'Lime (depth 4)' },
      { color: '#2299dd', name: 'Sky Blue (depth 5)' },
      { color: '#ee8800', name: 'Amber (depth 6)' },
    ];

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <h3 className="settings-section-title">Theme</h3>
        <div className="theme-options">
          <button
            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => theme !== 'dark' && toggleHighContrast()}
          >
            <span className="theme-icon">&#9680;</span>
            <span>Light Mode</span>
          </button>
          <button
            className={`theme-option ${theme === 'high-contrast' ? 'active' : ''}`}
            onClick={() => theme !== 'high-contrast' && toggleHighContrast()}
          >
            <span className="theme-icon">&#9681;</span>
            <span>High Contrast</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Bracket Colors</h3>

        <div className="settings-toggle-row">
          <span>Colored Brackets</span>
          <button
            className={`toggle-button ${coloredBrackets ? 'active' : ''}`}
            onClick={toggleColoredBrackets}
            aria-pressed={coloredBrackets}
          >
            <span className="toggle-slider" />
          </button>
        </div>

        {coloredBrackets && (
          <>
            <p className="settings-description">
              Brackets are color-coded to help read complex formulas.
              Square [ ] are always one color. Curly {'{ }'} use different colors based on nesting depth.
              Parentheses ( ) use default text color.
            </p>

            <div className="settings-toggle-row">
              <span>Show Bracket Matching Lines</span>
              <button
                className={`toggle-button ${showBracketLines ? 'active' : ''}`}
                onClick={toggleShowBracketLines}
                aria-pressed={showBracketLines}
              >
                <span className="toggle-slider" />
              </button>
            </div>

            <div className="settings-toggle-row">
              <span>Collapsible Brackets</span>
              <button
                className={`toggle-button ${collapsibleBrackets ? 'active' : ''}`}
                onClick={toggleCollapsibleBrackets}
                aria-pressed={collapsibleBrackets}
              >
                <span className="toggle-slider" />
              </button>
            </div>
            <p className="settings-description" style={{ marginTop: '-8px', marginBottom: '12px' }}>
              Click any opening bracket to collapse its contents.
            </p>

            <div className="bracket-legend">
              {/* Square brackets - always same color */}
              <div className="bracket-legend-item">
                <span
                  className="bracket-sample"
                  style={{ color: squareColor.color, fontFamily: 'var(--font-mono)' }}
                >
                  [ ]
                </span>
                <span className="bracket-color-name">{squareColor.name}</span>
              </div>
              {/* Curly brackets - depth-based */}
              {curlyColors.map((item, index) => (
                <div key={index} className="bracket-legend-item">
                  <span
                    className="bracket-sample"
                    style={{ color: item.color, fontFamily: 'var(--font-mono)' }}
                  >
                    {'{ }'}
                  </span>
                  <span className="bracket-color-name">{item.name}</span>
                </div>
              ))}
              {/* Parentheses - no color */}
              <div className="bracket-legend-item">
                <span
                  className="bracket-sample"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  ( )
                </span>
                <span className="bracket-color-name">No color</span>
              </div>
            </div>
          </>
        )}
      </div>

      {coloredBrackets && (
        <div className="settings-section">
          <h3 className="settings-section-title">Example</h3>
          {/* Example: {[(P → Q) ∧ (R ∨ S)]}
              {} = curlyColors[0] (depth 0), [] = squareColor, () = no color */}
          <div className="bracket-example">
            <span style={{ color: curlyColors[0].color, fontFamily: 'var(--font-mono)' }}>{'{'}</span>
            <span style={{ color: squareColor.color, fontFamily: 'var(--font-mono)' }}>[</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>(</span>
            P <span style={{ fontFamily: 'var(--font-mono)' }}>&#8594;</span> Q
            <span style={{ fontFamily: 'var(--font-mono)' }}>)</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}> &#8743; </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>(</span>
            R <span style={{ fontFamily: 'var(--font-mono)' }}>&#8744;</span> S
            <span style={{ fontFamily: 'var(--font-mono)' }}>)</span>
            <span style={{ color: squareColor.color, fontFamily: 'var(--font-mono)' }}>]</span>
            <span style={{ color: curlyColors[0].color, fontFamily: 'var(--font-mono)' }}>{'}'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
