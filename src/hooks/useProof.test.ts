import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProof } from './useProof';
import { invoke } from '@tauri-apps/api/core';
import type { Theorem, Proof, ProofLine } from '../types';

// Mock invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockTheorem: Theorem = {
  id: 'test-theorem-1',
  premises: [{ type: 'Atom', value: 'P' }],
  conclusion: { type: 'Atom', value: 'Q' },
  difficulty: 'easy',
  difficulty_value: 10,
  is_classic: false,
};

const mockProof: Proof = {
  id: 'test-proof-1',
  theorem: mockTheorem,
  lines: [
    {
      id: 'line-1',
      line_number: 1,
      formula: { type: 'Atom', value: 'P' },
      justification: { type: 'Premise' },
      depth: 0,
      is_valid: true,
    },
  ],
  scope_manager: {
    scopes: [],
    next_scope_id: 1,
  },
  is_complete: false,
};

describe('useProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the store state
    const { result } = renderHook(() => useProof());
    act(() => {
      result.current.clearProof();
    });
  });

  describe('initial state', () => {
    it('should have null proof initially', () => {
      const { result } = renderHook(() => useProof());
      expect(result.current.proof).toBeNull();
    });

    it('should have empty selectedLines initially', () => {
      const { result } = renderHook(() => useProof());
      expect(result.current.selectedLines).toEqual([]);
    });

    it('should have null error initially', () => {
      const { result } = renderHook(() => useProof());
      expect(result.current.error).toBeNull();
    });
  });

  describe('createProof', () => {
    it('should create a proof from theorem', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockProof);

      const { result } = renderHook(() => useProof());

      await act(async () => {
        await result.current.createProof(mockTheorem);
      });

      expect(invoke).toHaveBeenCalledWith('create_proof', { theorem: mockTheorem });
      expect(result.current.proof).toEqual(mockProof);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle errors', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed to create proof'));

      const { result } = renderHook(() => useProof());

      await act(async () => {
        await result.current.createProof(mockTheorem);
      });

      expect(result.current.proof).toBeNull();
      expect(result.current.error).toBe('Error: Failed to create proof');
    });
  });

  describe('line selection', () => {
    it('should select a line', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.selectLine(1);
      });

      expect(result.current.selectedLines).toEqual([1]);
    });

    it('should toggle line selection on', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.toggleLineSelection(1);
      });

      expect(result.current.selectedLines).toEqual([1]);
    });

    it('should toggle line selection off', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.toggleLineSelection(1);
      });

      act(() => {
        result.current.toggleLineSelection(1);
      });

      expect(result.current.selectedLines).toEqual([]);
    });

    it('should maintain sorted order when selecting multiple lines', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.toggleLineSelection(3);
        result.current.toggleLineSelection(1);
        result.current.toggleLineSelection(2);
      });

      expect(result.current.selectedLines).toEqual([1, 2, 3]);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.toggleLineSelection(1);
        result.current.toggleLineSelection(2);
        result.current.clearLineSelection();
      });

      expect(result.current.selectedLines).toEqual([]);
    });
  });

  describe('loadProof', () => {
    it('should load a proof and reset state', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.setError('some error');
        result.current.toggleLineSelection(1);
        result.current.loadProof(mockProof);
      });

      expect(result.current.proof).toEqual(mockProof);
      expect(result.current.selectedLines).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearProof', () => {
    it('should clear all proof state', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.loadProof(mockProof);
        result.current.toggleLineSelection(1);
        result.current.setError('test error');
        result.current.clearProof();
      });

      expect(result.current.proof).toBeNull();
      expect(result.current.selectedLines).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('reorderProof', () => {
    it('should update proof and clear selection', () => {
      const { result } = renderHook(() => useProof());
      const reorderedProof = { ...mockProof, id: 'reordered-proof' };

      act(() => {
        result.current.loadProof(mockProof);
        result.current.toggleLineSelection(1);
        result.current.reorderProof(reorderedProof);
      });

      expect(result.current.proof).toEqual(reorderedProof);
      expect(result.current.selectedLines).toEqual([]);
    });
  });

  describe('renameProof', () => {
    it('should rename the proof theorem', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.loadProof(mockProof);
        result.current.renameProof('My Custom Proof');
      });

      expect(result.current.proof?.theorem.name).toBe('My Custom Proof');
    });

    it('should do nothing if no proof is loaded', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.renameProof('My Custom Proof');
      });

      expect(result.current.proof).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');
    });

    it('should clear error', () => {
      const { result } = renderHook(() => useProof());

      act(() => {
        result.current.setError('Test error');
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
