// Browser stand-in for Tauri's `invoke`: proof and theorem commands run in logic-core compiled
// to WebAssembly (trainer-core's `dispatch`); storage commands keep their data in localStorage.
// Vite substitutes this module for '@tauri-apps/api/core' in the web build (vite.config.ts).
import init, { invoke as wasmInvoke } from './pkg/trainer_wasm.js';
import type { PortfolioEntry, Proof, Theorem, UserStatistics } from '../types';

type Args = Record<string, unknown>;

let ready: Promise<unknown> | null = null;

const KEY = {
  proofs: 'lpt.proofs',
  customTheorems: 'lpt.customTheorems',
  portfolio: 'lpt.portfolio',
  notes: 'lpt.globalNotes',
} as const;

function read<T>(key: string, empty: T): T {
  const raw = localStorage.getItem(key);
  return raw === null ? empty : (JSON.parse(raw) as T);
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function portfolio(): PortfolioEntry[] {
  return read<PortfolioEntry[]>(KEY.portfolio, []);
}

function updateEntry(id: string, change: (e: PortfolioEntry) => PortfolioEntry): void {
  const entries = portfolio();
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) throw `Portfolio entry not found: ${id}`;
  entries[i] = change(entries[i]);
  write(KEY.portfolio, entries);
}

const emptyStatistics: UserStatistics = {
  total_proofs_attempted: 0,
  total_proofs_completed: 0,
  current_streak: 0,
  longest_streak: 0,
  difficulty_stats: {},
  theme_stats: {},
  rule_usage: {},
  recent_attempts: [],
};

const storage: Record<string, (args: Args) => unknown> = {
  save_proof: ({ proof }) => {
    const p = proof as Proof;
    write(KEY.proofs, { ...read<Record<string, Proof>>(KEY.proofs, {}), [p.id]: p });
    return null;
  },
  load_proofs: () => Object.values(read<Record<string, Proof>>(KEY.proofs, {})),
  get_statistics: () => emptyStatistics,
  save_custom_theorem: ({ theorem }) => {
    const t = theorem as Theorem;
    write(KEY.customTheorems, [...read<Theorem[]>(KEY.customTheorems, []).filter((x) => x.id !== t.id), t]);
    return null;
  },
  load_custom_theorems: () => read<Theorem[]>(KEY.customTheorems, []),
  save_to_portfolio: ({ proof, timeSpentSecs, hintsUsed }) => {
    const p = proof as Proof;
    const entry: PortfolioEntry = {
      id: crypto.randomUUID(),
      proof: p,
      saved_at: new Date().toISOString(),
      time_spent_secs: (timeSpentSecs as number | null | undefined) ?? undefined,
      steps_count: p.lines.length,
      hints_used: hintsUsed as number,
    };
    write(KEY.portfolio, [entry, ...portfolio()]);
    return entry;
  },
  load_portfolio: () => [...portfolio()].sort((a, b) => b.saved_at.localeCompare(a.saved_at)),
  get_portfolio_entry: ({ id }) => {
    const e = portfolio().find((x) => x.id === id);
    if (!e) throw `Portfolio entry not found: ${id}`;
    return e;
  },
  delete_portfolio_entry: ({ id }) => {
    write(KEY.portfolio, portfolio().filter((e) => e.id !== id));
    return null;
  },
  update_portfolio_notes: ({ id, notes }) => {
    updateEntry(id as string, (e) => ({ ...e, notes: notes as string }));
    return null;
  },
  rename_portfolio_entry: ({ id, name }) => {
    updateEntry(id as string, (e) => ({ ...e, proof: { ...e.proof, theorem: { ...e.proof.theorem, name: name as string } } }));
    return null;
  },
  load_global_notes: () => localStorage.getItem(KEY.notes) ?? '',
  save_global_notes: ({ notes }) => {
    localStorage.setItem(KEY.notes, notes as string);
    return null;
  },
};

export async function invoke<T>(cmd: string, args: Args = {}): Promise<T> {
  const local = storage[cmd];
  if (local) return local(args) as T;
  ready ??= init();
  await ready;
  try {
    return JSON.parse(wasmInvoke(cmd, JSON.stringify(args))) as T;
  } catch (e) {
    throw typeof e === 'string' ? e : String(e);
  }
}
