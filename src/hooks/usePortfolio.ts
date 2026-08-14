import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { PortfolioEntry, Proof } from '../types';

interface PortfolioState {
  entries: PortfolioEntry[];
  isLoading: boolean;
  error: string | null;
  selectedEntry: PortfolioEntry | null;

  // Actions
  loadPortfolio: () => Promise<void>;
  saveToPortfolio: (proof: Proof, timeSpentSecs?: number, hintsUsed?: number) => Promise<PortfolioEntry | null>;
  deleteEntry: (id: string) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  renameEntry: (id: string, name: string) => Promise<void>;
  selectEntry: (entry: PortfolioEntry | null) => void;
  clearError: () => void;
}

export const usePortfolio = create<PortfolioState>((set) => ({
  entries: [],
  isLoading: false,
  error: null,
  selectedEntry: null,

  loadPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
      const entries = await invoke<PortfolioEntry[]>('load_portfolio');
      set({ entries, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  saveToPortfolio: async (proof: Proof, timeSpentSecs?: number, hintsUsed?: number) => {
    set({ isLoading: true, error: null });
    try {
      const entry = await invoke<PortfolioEntry>('save_to_portfolio', {
        proof,
        timeSpentSecs: timeSpentSecs ?? null,
        hintsUsed: hintsUsed ?? 0,
      });
      // Add to local state
      set((state) => ({
        entries: [entry, ...state.entries],
        isLoading: false,
      }));
      return entry;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return null;
    }
  },

  deleteEntry: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('delete_portfolio_entry', { id });
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
        selectedEntry: state.selectedEntry?.id === id ? null : state.selectedEntry,
        isLoading: false,
      }));
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  updateNotes: async (id: string, notes: string) => {
    // Store previous state for rollback
    const previousEntries = usePortfolio.getState().entries;
    const previousSelectedEntry = usePortfolio.getState().selectedEntry;

    // Optimistic update
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, notes } : e
      ),
      selectedEntry:
        state.selectedEntry?.id === id
          ? { ...state.selectedEntry, notes }
          : state.selectedEntry,
    }));

    try {
      await invoke('update_portfolio_notes', { id, notes });
    } catch (e) {
      // Rollback on failure
      set({ entries: previousEntries, selectedEntry: previousSelectedEntry, error: String(e) });
    }
  },

  renameEntry: async (id: string, name: string) => {
    // Store previous state for rollback
    const previousEntries = usePortfolio.getState().entries;
    const previousSelectedEntry = usePortfolio.getState().selectedEntry;

    // Optimistic update
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id
          ? { ...e, proof: { ...e.proof, theorem: { ...e.proof.theorem, name } } }
          : e
      ),
      selectedEntry:
        state.selectedEntry?.id === id
          ? {
              ...state.selectedEntry,
              proof: {
                ...state.selectedEntry.proof,
                theorem: { ...state.selectedEntry.proof.theorem, name },
              },
            }
          : state.selectedEntry,
    }));

    try {
      await invoke('rename_portfolio_entry', { id, name });
    } catch (e) {
      // Rollback on failure
      set({ entries: previousEntries, selectedEntry: previousSelectedEntry, error: String(e) });
    }
  },

  selectEntry: (entry: PortfolioEntry | null) => {
    set({ selectedEntry: entry });
  },

  clearError: () => {
    set({ error: null });
  },
}));
