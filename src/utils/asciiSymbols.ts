// Typing ASCII stands in for logic symbols while the user types a formula.
// `v` is disjunction only as a connective: a lowercase letter on either side means it is part of
// a word (the rule name "Equiv" must survive). Propositional letters are uppercase, so `PvQ` still
// becomes P∨Q.
export function replaceAsciiSymbols(input: string): string {
  return input
    .replace(/<>/g, '≡')
    .replace(/!=/g, '≠')
    .replace(/>/g, '⊃')
    .replace(/&/g, '.')
    .replace(/!/g, '~')
    .replace(/(^|[^a-z])[vV](?![a-z])/g, (_match, before: string) => `${before}∨`);
}
