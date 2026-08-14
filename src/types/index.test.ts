import { describe, it, expect } from 'vitest';
import {
  formulaToString,
  justificationToString,
  difficultyColor,
  type Formula,
  type Justification,
} from './index';

describe('formulaToString', () => {
  it('should format atoms', () => {
    const formula: Formula = { type: 'Atom', value: 'P' };
    expect(formulaToString(formula)).toBe('P');
  });

  it('should format contradiction', () => {
    const formula: Formula = { type: 'Contradiction' };
    expect(formulaToString(formula)).toBe('⊥');
  });

  it('should format simple negation', () => {
    const formula: Formula = {
      type: 'Not',
      value: { type: 'Atom', value: 'P' },
    };
    expect(formulaToString(formula)).toBe('~P');
  });

  it('should format negation of compound with brackets', () => {
    const formula: Formula = {
      type: 'Not',
      value: {
        type: 'And',
        value: [
          { type: 'Atom', value: 'P' },
          { type: 'Atom', value: 'Q' },
        ],
      },
    };
    expect(formulaToString(formula)).toBe('~(P . Q)');
  });

  it('should format conjunction', () => {
    const formula: Formula = {
      type: 'And',
      value: [
        { type: 'Atom', value: 'P' },
        { type: 'Atom', value: 'Q' },
      ],
    };
    expect(formulaToString(formula)).toBe('P . Q');
  });

  it('should format disjunction', () => {
    const formula: Formula = {
      type: 'Or',
      value: [
        { type: 'Atom', value: 'P' },
        { type: 'Atom', value: 'Q' },
      ],
    };
    expect(formulaToString(formula)).toBe('P ∨ Q');
  });

  it('should format implication', () => {
    const formula: Formula = {
      type: 'Implies',
      value: [
        { type: 'Atom', value: 'P' },
        { type: 'Atom', value: 'Q' },
      ],
    };
    expect(formulaToString(formula)).toBe('P ⊃ Q');
  });

  it('should format biconditional', () => {
    const formula: Formula = {
      type: 'Biconditional',
      value: [
        { type: 'Atom', value: 'P' },
        { type: 'Atom', value: 'Q' },
      ],
    };
    expect(formulaToString(formula)).toBe('P ≡ Q');
  });

  it('should format nested formulas with brackets', () => {
    // (P ∨ Q) ⊃ R
    const formula: Formula = {
      type: 'Implies',
      value: [
        {
          type: 'Or',
          value: [
            { type: 'Atom', value: 'P' },
            { type: 'Atom', value: 'Q' },
          ],
        },
        { type: 'Atom', value: 'R' },
      ],
    };
    expect(formulaToString(formula)).toBe('(P ∨ Q) ⊃ R');
  });
});

describe('justificationToString', () => {
  it('should format Premise', () => {
    const j: Justification = { type: 'Premise' };
    expect(justificationToString(j)).toBe('Premise');
  });

  it('should format Assumption with CP', () => {
    const j: Justification = { type: 'Assumption', technique: 'conditionalProof' };
    expect(justificationToString(j)).toBe('Assumption (CP)');
  });

  it('should format Assumption with IP', () => {
    const j: Justification = { type: 'Assumption', technique: 'indirectProof' };
    expect(justificationToString(j)).toBe('Assumption (IP)');
  });

  it('should format Inference rule', () => {
    const j: Justification = { type: 'Inference', rule: 'modusPonens', lines: [1, 2] };
    expect(justificationToString(j)).toBe('MP 1, 2');
  });

  it('should format Equivalence rule', () => {
    const j: Justification = { type: 'Equivalence', rule: 'doubleNegation', line: 3 };
    expect(justificationToString(j)).toBe('DN 3');
  });

  it('should format SubproofConclusion', () => {
    const j: Justification = {
      type: 'SubproofConclusion',
      technique: 'conditionalProof',
      subproof_start: 2,
      subproof_end: 5,
    };
    expect(justificationToString(j)).toBe('CP 2-5');
  });
});

describe('difficultyColor', () => {
  it('should return light blue for baby', () => {
    expect(difficultyColor('baby')).toBe('#81d4fa');
  });

  it('should return green for easy', () => {
    expect(difficultyColor('easy')).toBe('#4caf50');
  });

  it('should return orange for medium', () => {
    expect(difficultyColor('medium')).toBe('#ff9800');
  });

  it('should return red for hard', () => {
    expect(difficultyColor('hard')).toBe('#f44336');
  });

  it('should return purple for expert', () => {
    expect(difficultyColor('expert')).toBe('#9c27b0');
  });

  it('should return dark red for nightmare', () => {
    expect(difficultyColor('nightmare')).toBe('#b71c1c');
  });

  it('should return dark purple for marathon', () => {
    expect(difficultyColor('marathon')).toBe('#4a148c');
  });

  it('should return hot pink for absurd', () => {
    expect(difficultyColor('absurd')).toBe('#e91e63');
  });

  it('should return gold for cosmic', () => {
    expect(difficultyColor('cosmic')).toBe('#ffd600');
  });

  it('should return silver for mind', () => {
    expect(difficultyColor('mind')).toBe('#b0bec5');
  });
});
