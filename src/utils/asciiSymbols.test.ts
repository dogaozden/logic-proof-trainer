import { describe, expect, it } from 'vitest';
import { replaceAsciiSymbols } from './asciiSymbols';

describe('replaceAsciiSymbols', () => {
  it('converts a disjunction between propositional letters', () => {
    expect(replaceAsciiSymbols('PvQ')).toBe('P∨Q');
    expect(replaceAsciiSymbols('P v Q')).toBe('P ∨ Q');
    expect(replaceAsciiSymbols('V')).toBe('∨');
  });

  it('leaves the v inside a rule name alone', () => {
    expect(replaceAsciiSymbols('c ∈ a 18 Equiv')).toBe('c ∈ a 18 Equiv');
    expect(replaceAsciiSymbols('Equiv')).toBe('Equiv');
  });

  it('keeps the other ASCII conversions', () => {
    expect(replaceAsciiSymbols('P>Q & !R')).toBe('P⊃Q . ~R');
    expect(replaceAsciiSymbols('P<>Q != R')).toBe('P≡Q ≠ R');
  });
});
