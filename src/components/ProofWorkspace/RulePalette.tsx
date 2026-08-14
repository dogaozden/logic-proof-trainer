import React from 'react';
import type { InferenceRule, EquivalenceRule, ProofTechnique } from '../../types';
import { inferenceRuleInfo, equivalenceRuleInfo, proofTechniqueInfo } from '../../types';

interface RulePaletteProps {
  selectedInferenceRule: InferenceRule | null;
  selectedEquivalenceRule: EquivalenceRule | null;
  selectedTechnique: ProofTechnique | null;
  openSubproofTechnique: ProofTechnique | null;
  onSelectInferenceRule: (rule: InferenceRule | null) => void;
  onSelectEquivalenceRule: (rule: EquivalenceRule | null) => void;
  onSelectTechnique: (technique: ProofTechnique | null) => void;
}

// Inference rules - matches rules.md order (1-8)
const INFERENCE_RULES: InferenceRule[] = [
  'modusPonens',           // 1. MP
  'modusTollens',          // 2. MT
  'disjunctiveSyllogism',  // 3. DS
  'simplification',        // 4. Simp
  'conjunction',           // 5. Conj
  'hypotheticalSyllogism', // 6. HS
  'addition',              // 7. Add
  'constructiveDilemma',   // 8. CD
  'contradiction',         // 19. NegE
];

// Equivalence rules - matches rules.md order (9-18)
const EQUIVALENCE_RULES: EquivalenceRule[] = [
  'doubleNegation',   // 9. DN
  'deMorgan',         // 10. DeM
  'commutation',      // 11. Comm
  'association',      // 12. Assoc
  'distribution',     // 13. Dist
  'contraposition',   // 14. Contra
  'implication',      // 15. Impl
  'exportation',      // 16. Exp
  'tautology',        // 17. Taut
  'equivalence',      // 18. Equiv
];

// Proof techniques - CP and IP from rules.md
const TECHNIQUES: ProofTechnique[] = ['conditionalProof', 'indirectProof'];

export const RulePalette: React.FC<RulePaletteProps> = ({
  selectedInferenceRule,
  selectedEquivalenceRule,
  selectedTechnique,
  openSubproofTechnique,
  onSelectInferenceRule,
  onSelectEquivalenceRule,
  onSelectTechnique,
}) => {
  const handleInferenceClick = (rule: InferenceRule) => {
    if (selectedInferenceRule === rule) {
      onSelectInferenceRule(null);
    } else {
      onSelectInferenceRule(rule);
      onSelectEquivalenceRule(null);
      onSelectTechnique(null);
    }
  };

  const handleEquivalenceClick = (rule: EquivalenceRule) => {
    if (selectedEquivalenceRule === rule) {
      onSelectEquivalenceRule(null);
    } else {
      onSelectEquivalenceRule(rule);
      onSelectInferenceRule(null);
      onSelectTechnique(null);
    }
  };

  const handleTechniqueClick = (technique: ProofTechnique) => {
    if (selectedTechnique === technique) {
      onSelectTechnique(null);
    } else {
      onSelectTechnique(technique);
      onSelectInferenceRule(null);
      onSelectEquivalenceRule(null);
    }
  };

  return (
    <div className="rule-palette">
      <h3>Rules</h3>

      {/* Inference Rules (1-8) */}
      <div className="rule-category">
        <div className="rule-category-title">Valid Argument Forms (1-8)</div>
        <div className="rule-list">
          {INFERENCE_RULES.map((rule) => {
            const info = inferenceRuleInfo[rule];
            return (
              <button
                key={rule}
                className={`rule-button ${selectedInferenceRule === rule ? 'selected' : ''}`}
                onClick={() => handleInferenceClick(rule)}
                title={info.symbol}
              >
                <div className="rule-button-content">
                  <div className="rule-header">
                    <span className="rule-abbreviation">{info.abbrev}</span>
                    <span className="rule-name">{info.name}</span>
                  </div>
                  <div className="rule-symbol">{info.symbol}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Equivalence Rules (9-18) */}
      <div className="rule-category">
        <div className="rule-category-title">Equivalence Forms (9-18)</div>
        <div className="rule-list">
          {EQUIVALENCE_RULES.map((rule) => {
            const info = equivalenceRuleInfo[rule];
            return (
              <button
                key={rule}
                className={`rule-button ${selectedEquivalenceRule === rule ? 'selected' : ''}`}
                onClick={() => handleEquivalenceClick(rule)}
                title={info.symbol}
              >
                <div className="rule-button-content">
                  <div className="rule-header">
                    <span className="rule-abbreviation">{info.abbrev}</span>
                    <span className="rule-name">{info.name}</span>
                  </div>
                  <div className="rule-symbol">{info.symbol}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Proof Techniques */}
      <div className="rule-category">
        <div className="rule-category-title">Conditional & Indirect Proof</div>
        <div className="rule-list">
          {TECHNIQUES.map((technique) => {
            const info = proofTechniqueInfo[technique];
            const symbolMap: Record<ProofTechnique, string> = {
              conditionalProof: 'Assume p... derive q ∴ p ⊃ q',
              indirectProof: 'Assume p... derive q · ~q ∴ ~p (or vice versa)',
            };
            const isOpen = openSubproofTechnique === technique;
            const buttonClass = `rule-button ${selectedTechnique === technique ? 'selected' : ''} ${isOpen ? 'subproof-open' : ''}`;
            const tooltip = isOpen
              ? `Click to close ${info.name} subproof`
              : symbolMap[technique];
            return (
              <button
                key={technique}
                className={buttonClass}
                onClick={() => handleTechniqueClick(technique)}
                title={tooltip}
              >
                <div className="rule-button-content">
                  <div className="rule-header">
                    <span className="rule-abbreviation">{info.abbrev}</span>
                    <span className="rule-name">{info.name}</span>
                    {isOpen && <span className="close-hint">(click to close)</span>}
                  </div>
                  <div className="rule-symbol">{symbolMap[technique]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
