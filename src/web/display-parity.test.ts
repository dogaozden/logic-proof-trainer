// @vitest-environment node
// Whatever the TypeScript display prints must parse back (in logic-core) to the same formula:
// users copy displayed formulas into commands. Checked on every formula of the set-theory
// track, every rewrite the scratchpad offers for them, and edge cases, through the WebAssembly
// build. (Bracketing may differ from logic-core's own display_string: the trainer never wraps
// a negated operand.)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initSync, invoke } from './pkg/trainer_wasm.js';
import { formulaToString } from '../types';
import type { Formula, TrackChapter } from '../types';

initSync({ module: readFileSync(new URL('./pkg/trainer_wasm_bg.wasm', import.meta.url)) });

const call = <T>(cmd: string, args: object): T => JSON.parse(invoke(cmd, JSON.stringify(args))) as T;

describe('formula display parity with logic-core', () => {
  const track = call<TrackChapter[]>('get_set_theory_track', {});
  const formulas: Formula[] = track.flatMap((c) => [
    ...c.axioms.map((a) => a.formula),
    ...c.exercises.flatMap((e) => [...e.theorem.premises, e.theorem.conclusion]),
  ]);
  for (const extra of ['~∀x(F(x) . G(x))', '∀x ~(x ∈ a)', '(∀x F(x)) . P', '~(a ⊆ b) ∨ a ∉ b', '~~(a = b)', '⋃(a ∪ b) = c', 'x ∈ a × b ∪ c', 'x ∈ (a ∪ b) × c', 'Fun(f, a, b)', 'Rev(f, g)', 'Comp(g, f, h)']) {
    formulas.push(call<Formula>('parse_formula', { input: extra }));
  }

  it('prints every formula so that it parses back to the same formula', () => {
    expect(formulas.length).toBeGreaterThan(80);
    for (const f of formulas) {
      const shown = formulaToString(f);
      expect(call<Formula>('parse_formula', { input: shown })).toEqual(f);
      const transformations = call<{ result: string }[]>('get_all_transformations', { formulaStr: shown });
      for (const t of transformations) {
        const g = call<Formula>('parse_formula', { input: t.result });
        expect(call<Formula>('parse_formula', { input: formulaToString(g) })).toEqual(g);
      }
    }
  });
});
