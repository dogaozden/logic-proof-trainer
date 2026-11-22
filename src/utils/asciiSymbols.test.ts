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

  it('keeps a lowercase v as a variable in a formula', () => {
    expect(replaceAsciiSymbols('∀v(v ∈ a)')).toBe('∀v(v ∈ a)');
    expect(replaceAsciiSymbols('(u ∈ a . v ∈ a)')).toBe('(u ∈ a . v ∈ a)');
    expect(replaceAsciiSymbols('⟨v, u⟩ ∈ r')).toBe('⟨v, u⟩ ∈ r');
    expect(replaceAsciiSymbols('u = v ∨ ⟨v, u⟩')).toBe('u = v ∨ ⟨v, u⟩');
  });

  it('converts a lowercase v only between two operands', () => {
    expect(replaceAsciiSymbols('F(a) v G(a)')).toBe('F(a) ∨ G(a)');
    expect(replaceAsciiSymbols('(P) v ~Q')).toBe('(P) ∨ ~Q');
  });

  it('keeps the other ASCII conversions', () => {
    expect(replaceAsciiSymbols('P>Q & !R')).toBe('P⊃Q . ~R');
    expect(replaceAsciiSymbols('P<>Q != R')).toBe('P≡Q ≠ R');
  });
});
