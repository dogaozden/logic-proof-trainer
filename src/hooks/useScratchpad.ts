import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ScratchpadLine, TransformationResult } from '../types';

interface ScratchpadState {
  lines: ScratchpadLine[];
  selectedLineId: string | null;
  availableTransformations: TransformationResult[];
  copiedFormula: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  addFormula: (formulaStr: string) => Promise<boolean>;
  addNote: (text: string) => void;
  applyTransformation: (lineId: string, transformation: TransformationResult) => void;
  selectLine: (id: string | null) => Promise<void>;
  removeLine: (id: string) => void;
  clearAll: () => void;
  copyToClipboard: (id: string) => void;
  copyToProof: (id: string) => void;
  clearCopiedFormula: () => void;
  clearError: () => void;
}

let lineIdCounter = 0;

export const useScratchpad = create<ScratchpadState>((set, get) => ({
  lines: [],
  selectedLineId: null,
  availableTransformations: [],
  copiedFormula: null,
  isLoading: false,
  error: null,

  addFormula: async (formulaStr: string) => {
    const trimmed = formulaStr.trim();
    if (!trimmed) return false;

    set({ isLoading: true, error: null });

    try {
      // Validate formula by parsing it on backend
      await invoke('parse_formula', { input: trimmed });

      const newLine: ScratchpadLine = {
        id: `scratch-${++lineIdCounter}`,
        formula: trimmed,
        isValid: true,
        lineType: 'formula',
      };

      set(state => ({
        lines: [...state.lines, newLine],
        isLoading: false,
      }));

      // Auto-select the new line
      get().selectLine(newLine.id);

      return true;
    } catch (err) {
      set({
        error: `Invalid formula: ${err}`,
        isLoading: false,
      });
      return false;
    }
  },

  addNote: (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newLine: ScratchpadLine = {
      id: `scratch-${++lineIdCounter}`,
      formula: trimmed,
      isValid: true,
      lineType: 'note',
    };

    set(state => ({
      lines: [...state.lines, newLine],
      selectedLineId: null,
      availableTransformations: [],
    }));
  },

  applyTransformation: (_lineId: string, transformation: TransformationResult) => {
    const newLine: ScratchpadLine = {
      id: `scratch-${++lineIdCounter}`,
      formula: transformation.result,
      sourceRule: transformation.rule_abbrev,
      isValid: true,
      lineType: 'formula',
    };

    set(state => ({
      lines: [...state.lines, newLine],
    }));

    // Auto-select the new line
    get().selectLine(newLine.id);
  },

  selectLine: async (id: string | null) => {
    if (!id) {
      set({ selectedLineId: null, availableTransformations: [] });
      return;
    }

    const line = get().lines.find(l => l.id === id);
    if (!line) {
      set({ selectedLineId: null, availableTransformations: [] });
      return;
    }

    // Notes don't have transformations
    if (line.lineType === 'note') {
      set({ selectedLineId: id, availableTransformations: [] });
      return;
    }

    set({ selectedLineId: id, isLoading: true });

    try {
      const transformations = await invoke<TransformationResult[]>('get_all_transformations', {
        formulaStr: line.formula,
      });

      set({
        availableTransformations: transformations,
        isLoading: false,
      });
    } catch (err) {
      set({
        availableTransformations: [],
        error: `Failed to get transformations: ${err}`,
        isLoading: false,
      });
    }
  },

  removeLine: (id: string) => {
    set(state => {
      const newLines = state.lines.filter(l => l.id !== id);
      const newSelectedId = state.selectedLineId === id ? null : state.selectedLineId;
      return {
        lines: newLines,
        selectedLineId: newSelectedId,
        availableTransformations: newSelectedId ? state.availableTransformations : [],
      };
    });
  },

  clearAll: () => {
    set({
      lines: [],
      selectedLineId: null,
      availableTransformations: [],
      copiedFormula: null,
      error: null,
    });
  },

  copyToClipboard: (id: string) => {
    const line = get().lines.find(l => l.id === id);
    if (line) {
      navigator.clipboard.writeText(line.formula);
    }
  },

  copyToProof: (id: string) => {
    const line = get().lines.find(l => l.id === id);
    if (line && line.lineType === 'formula') {
      set({ copiedFormula: line.formula });
    }
  },

  clearCopiedFormula: () => {
    set({ copiedFormula: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
