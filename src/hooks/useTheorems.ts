import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Theorem, Difficulty } from '../types';

// v8 example theorems - one per tier, with display string for card preview
export interface TierExample {
  description: string;
  /** The raw formula string for display on the card (avoids building huge ASTs) */
  formulaString: string;
  benchmarkId: string;
  difficultyValue: number;
}

export const CURATED_EXAMPLES: Record<Difficulty, TierExample> = {
  baby: {
    description: '2 variables, simple implication',
    formulaString: '~P ⊃ ~(P . Q)',
    benchmarkId: 'v1-007',
    difficultyValue: 10,
  },
  easy: {
    description: '3 variables, basic disjunction',
    formulaString: '(~Q ∨ P) ∨ ~P',
    benchmarkId: 'v1-018',
    difficultyValue: 20,
  },
  medium: {
    description: '4 variables, nested conditionals',
    formulaString: '{P . [P ⊃ (R ∨ ~Q)]} ⊃ (Q ⊃ R)',
    benchmarkId: 'v1-025',
    difficultyValue: 40,
  },
  hard: {
    description: '5 variables, deep nesting',
    formulaString: '~{{{{{P . [(T ⊃ ~P) . (S ∨ S)]} ⊃ ...} . ...} . ...} . ...}',
    benchmarkId: 'v1-037',
    difficultyValue: 60,
  },
  expert: {
    description: '5 vars, 2 passes, compound structure',
    formulaString: '{~{{{{~T ⊃ {{~{...} ⊃ ...}} . ...} . ...} . ...}} ∨ ...}',
    benchmarkId: 'v1-041',
    difficultyValue: 80,
  },
  nightmare: {
    description: '5 vars, 3 passes, massive formula',
    formulaString: '{(P . S) ⊃ {{~S ⊃ {~[...]}} ⊃ ...}} ∨ {~{...}}',
    benchmarkId: 'v1-060',
    difficultyValue: 90,
  },
  marathon: {
    description: '6 vars, 5 passes, endurance test',
    formulaString: '{{~{(S ⊃ Q) . {{{...} ⊃ ...} . ~T}}} ∨ ...} ∨ ...}',
    benchmarkId: 'v1-070',
    difficultyValue: 98,
  },
  absurd: {
    description: '7 vars, 10 passes, extreme depth',
    formulaString: '{~{{{~{{~{...} . B}} . ~T} ⊃ ...}}} ∨ ...}',
    benchmarkId: 'v1-080',
    difficultyValue: 100,
  },
  cosmic: {
    description: '7 vars, 20 passes, 869 characters',
    formulaString: '{~{{{{...} ∨ T} ∨ ...} . ...}} ∨ {{~{...} ∨ ...}}',
    benchmarkId: 'v1-083',
    difficultyValue: 100,
  },
  mind: {
    description: '7 vars, 50 passes, 1951 characters',
    formulaString: '{{{{~{{T ∨ ...} ∨ ...}} ∨ ...} ∨ ...} ∨ ...}',
    benchmarkId: 'v1-095',
    difficultyValue: 100,
  },
};

interface TheoremsState {
  customTheorems: Theorem[];
  selectedTheorem: Theorem | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCustomTheorems: () => Promise<void>;
  generateTheorem: (difficulty: Difficulty) => Promise<Theorem>;
  generateTheoremWithValue: (difficultyValue: number) => Promise<Theorem>;
  generateTheoremByTier: (tier: Difficulty) => Promise<Theorem>;
  selectTheorem: (theorem: Theorem | null) => void;
  saveCustomTheorem: (theorem: Theorem) => Promise<void>;
}

export const useTheorems = create<TheoremsState>((set, get) => ({
  customTheorems: [],
  selectedTheorem: null,
  isLoading: false,
  error: null,

  loadCustomTheorems: async () => {
    set({ isLoading: true, error: null });
    try {
      const theorems = await invoke<Theorem[]>('load_custom_theorems');
      set({ customTheorems: theorems, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  generateTheorem: async (difficulty: Difficulty) => {
    set({ isLoading: true, error: null });
    try {
      const theorem = await invoke<Theorem>('generate_theorem', { difficulty });
      set({ selectedTheorem: theorem, isLoading: false });
      return theorem;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  generateTheoremWithValue: async (difficultyValue: number) => {
    set({ isLoading: true, error: null });
    try {
      const theorem = await invoke<Theorem>('generate_theorem_with_value', { difficultyValue });
      set({ selectedTheorem: theorem, isLoading: false });
      return theorem;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  generateTheoremByTier: async (tier: Difficulty) => {
    set({ isLoading: true, error: null });
    try {
      const theorem = await invoke<Theorem>('generate_theorem_by_tier', { tier });
      set({ selectedTheorem: theorem, isLoading: false });
      return theorem;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  selectTheorem: (theorem) => {
    set({ selectedTheorem: theorem });
  },

  saveCustomTheorem: async (theorem: Theorem) => {
    try {
      await invoke('save_custom_theorem', { theorem });
      const customs = get().customTheorems;
      set({ customTheorems: [...customs, theorem] });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
