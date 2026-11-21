import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TrackChapter, TrackExercise } from '../types';

interface SetTheoryTrackState {
  chapters: TrackChapter[];
  error: string | null;
  loadTrack: () => Promise<void>;
  exerciseFor: (theoremId: string) => TrackExercise | null;
}

export const useSetTheoryTrack = create<SetTheoryTrackState>((set, get) => ({
  chapters: [],
  error: null,

  loadTrack: async () => {
    if (get().chapters.length > 0) return;
    try {
      const chapters = await invoke<TrackChapter[]>('get_set_theory_track');
      set({ chapters, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  exerciseFor: (theoremId: string) =>
    get().chapters.flatMap((c) => c.exercises).find((e) => e.id === theoremId) ?? null,
}));
