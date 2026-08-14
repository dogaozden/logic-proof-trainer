import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  Proof,
  Theorem,
  RuleApplication,
  ProofTechnique,
  InferenceRule,
  EquivalenceRule,
} from '../types';

interface ProofState {
  proof: Proof | null;
  selectedLines: number[];
  isLoading: boolean;
  error: string | null;
  hint: string | null;

  // Actions
  createProof: (theorem: Theorem) => Promise<void>;
  applyInferenceRule: (rule: InferenceRule, lines: number[], formula: string) => Promise<boolean>;
  applyEquivalenceRule: (rule: EquivalenceRule, line: number, formula: string) => Promise<boolean>;
  openSubproof: (technique: ProofTechnique, assumption: string) => Promise<boolean>;
  closeSubproof: (technique: ProofTechnique, conclusion: string) => Promise<boolean>;
  setError: (error: string | null) => void;
  undoLine: () => Promise<void>;
  getHint: () => Promise<void>;
  selectLine: (lineNumber: number) => void;
  toggleLineSelection: (lineNumber: number) => void;
  clearSelection: () => void;
  clearLineSelection: () => void;
  saveProof: () => Promise<void>;
  loadProof: (proof: Proof) => void;
  clearProof: () => void;
  clearError: () => void;
  reorderProof: (newProof: Proof) => void;
  renameProof: (name: string) => void;
}

export const useProof = create<ProofState>((set, get) => ({
  proof: null,
  selectedLines: [],
  isLoading: false,
  error: null,
  hint: null,

  createProof: async (theorem: Theorem) => {
    set({ isLoading: true, error: null, hint: null, selectedLines: [] });
    try {
      const proof = await invoke<Proof>('create_proof', { theorem });
      set({ proof, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  applyInferenceRule: async (rule: InferenceRule, lines: number[], formula: string) => {
    const { proof } = get();
    if (!proof) return false;

    set({ isLoading: true, error: null });
    try {
      const ruleApplication: RuleApplication = {
        type: 'Inference',
        rule,
        lines,
      };
      const updatedProof = await invoke<Proof>('apply_rule', {
        proof,
        ruleApplication,
        formulaStr: formula,
      });
      set({ proof: updatedProof, isLoading: false, selectedLines: [] });
      return true;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  applyEquivalenceRule: async (rule: EquivalenceRule, line: number, formula: string) => {
    const { proof } = get();
    if (!proof) return false;

    set({ isLoading: true, error: null });
    try {
      const ruleApplication: RuleApplication = {
        type: 'Equivalence',
        rule,
        line,
      };
      const updatedProof = await invoke<Proof>('apply_rule', {
        proof,
        ruleApplication,
        formulaStr: formula,
      });
      set({ proof: updatedProof, isLoading: false, selectedLines: [] });
      return true;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  openSubproof: async (technique: ProofTechnique, assumption: string) => {
    const { proof } = get();
    if (!proof) return false;

    set({ isLoading: true, error: null });
    try {
      const updatedProof = await invoke<Proof>('open_subproof', {
        proof,
        technique,
        assumptionStr: assumption,
      });
      set({ proof: updatedProof, isLoading: false, selectedLines: [] });
      return true;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  closeSubproof: async (technique: ProofTechnique, conclusion: string) => {
    const { proof } = get();
    if (!proof) return false;

    set({ isLoading: true, error: null });
    try {
      const updatedProof = await invoke<Proof>('close_subproof', {
        proof,
        technique,
        conclusionStr: conclusion,
      });
      set({ proof: updatedProof, isLoading: false, selectedLines: [] });
      return true;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  undoLine: async () => {
    const { proof } = get();
    if (!proof) return;

    set({ isLoading: true, error: null });
    try {
      const updatedProof = await invoke<Proof>('undo_line', { proof });
      set({ proof: updatedProof, isLoading: false, selectedLines: [] });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  getHint: async () => {
    const { proof } = get();
    if (!proof) return;

    try {
      const hint = await invoke<string>('get_hint', { proof });
      set({ hint });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  selectLine: (lineNumber: number) => {
    set({ selectedLines: [lineNumber] });
  },

  toggleLineSelection: (lineNumber: number) => {
    const { selectedLines } = get();
    if (selectedLines.includes(lineNumber)) {
      set({ selectedLines: selectedLines.filter((n) => n !== lineNumber) });
    } else {
      set({ selectedLines: [...selectedLines, lineNumber].sort((a, b) => a - b) });
    }
  },

  clearSelection: () => {
    set({ selectedLines: [] });
  },

  clearLineSelection: () => {
    set({ selectedLines: [] });
  },

  saveProof: async () => {
    const { proof } = get();
    if (!proof) return;

    try {
      await invoke('save_proof', { proof });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadProof: (proof: Proof) => {
    set({ proof, selectedLines: [], error: null, hint: null });
  },

  clearProof: () => {
    set({ proof: null, selectedLines: [], error: null, hint: null });
  },

  clearError: () => {
    set({ error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  reorderProof: (newProof: Proof) => {
    set({ proof: newProof, selectedLines: [] });
  },

  renameProof: (name: string) => {
    const { proof } = get();
    if (!proof) return;
    set({
      proof: {
        ...proof,
        theorem: { ...proof.theorem, name },
      },
    });
  },
}));
