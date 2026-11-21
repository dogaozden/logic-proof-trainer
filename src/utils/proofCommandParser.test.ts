import { describe, expect, it } from 'vitest';
import { parseCommand } from './proofCommandParser';

describe('quantifier and identity commands', () => {
  it('reads Fitch and Hurley rule names', () => {
    expect(parseCommand('F(a) ⊃ G(a) 1 ∀E')).toEqual({ type: 'ruleApplication', formula: 'F(a) ⊃ G(a)', lines: [1], rule: '∀E', ruleType: 'inference' });
    expect(parseCommand('∀x G(x) 5 UG')).toMatchObject({ type: 'ruleApplication', rule: 'UG', lines: [5] });
    expect(parseCommand('b = a 1,2 =E')).toMatchObject({ type: 'ruleApplication', formula: 'b = a', lines: [1, 2] });
    expect(parseCommand('a ⊆ a 4 Def')).toMatchObject({ type: 'ruleApplication', ruleType: 'equivalence', lines: [4] });
  });

  it('applies =I without cited lines', () => {
    expect(parseCommand('a = a =I')).toEqual({ type: 'ruleApplication', formula: 'a = a', lines: [], rule: '=I', ruleType: 'inference' });
  });

  it('opens and closes ∃E subproofs', () => {
    expect(parseCommand('F(a) ∃E')).toEqual({ type: 'subproofOpen', formula: 'F(a)', technique: 'existentialElimination' });
    expect(parseCommand('∃E')).toEqual({ type: 'subproofClose', formula: null, technique: 'existentialElimination' });
    expect(parseCommand('∃x G(x) 3-6 EI')).toMatchObject({ type: 'subproofClose', technique: 'existentialElimination', lineRange: { start: 3, end: 6 } });
  });

  it('leaves propositional commands as they were', () => {
    expect(parseCommand('Q 1,2 MP')).toEqual({ type: 'ruleApplication', formula: 'Q', lines: [1, 2], rule: 'MP', ruleType: 'inference' });
    expect(parseCommand('P CP')).toEqual({ type: 'subproofOpen', formula: 'P', technique: 'conditionalProof' });
  });
});
