// Typing ASCII stands in for logic symbols while the user types a formula.
// `V` is always disjunction when no lowercase letter touches it (propositional and predicate
// letters are uppercase; variables are lowercase, so an uppercase V is never a variable).
// A lowercase `v` is a variable (∀v, ⟨v, u⟩, v ∈ a), so it becomes ∨ only between a left operand
// (an uppercase letter or a closing parenthesis or negation) and a right operand (an uppercase
// letter, an opening parenthesis or negation): `PvQ`, `P v Q`, `F(a) v G(a)`. A lowercase letter
// on either side means it is part of a word (the rule name "Equiv" must survive).
const LEFT_OPERAND = /[A-Z)~]/;
const RIGHT_OPERAND = /[A-Z(~]/;

function isLower(c: string | undefined): boolean {
  return c !== undefined && /[a-z]/.test(c);
}

function previousNonSpace(s: string, i: number): string | undefined {
  for (let j = i - 1; j >= 0; j--) if (s[j] !== ' ') return s[j];
  return undefined;
}

function nextNonSpace(s: string, i: number): string | undefined {
  for (let j = i + 1; j < s.length; j++) if (s[j] !== ' ') return s[j];
  return undefined;
}

function convertDisjunctionV(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c === 'V' || c === 'v') && !isLower(s[i - 1]) && !isLower(s[i + 1])) {
      const left = previousNonSpace(s, i);
      const right = nextNonSpace(s, i);
      if (c === 'V' || (left !== undefined && LEFT_OPERAND.test(left) && right !== undefined && RIGHT_OPERAND.test(right))) {
        out += '∨';
        continue;
      }
    }
    out += c;
  }
  return out;
}

export function replaceAsciiSymbols(input: string): string {
  return convertDisjunctionV(
    input
      .replace(/<>/g, '≡')
      .replace(/!=/g, '≠')
      .replace(/>/g, '⊃')
      .replace(/&/g, '.')
      .replace(/!/g, '~'),
  );
}
