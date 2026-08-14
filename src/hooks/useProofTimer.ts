import { useEffect, useRef, useCallback } from 'react';
import type { Proof, PortfolioEntry } from '../types';

interface UseProofTimerOptions {
  proof: Proof | null;
  saveToPortfolio: (proof: Proof, timeSpent?: number, hintsUsed?: number) => Promise<PortfolioEntry | null>;
}

export function useProofTimer({ proof, saveToPortfolio }: UseProofTimerOptions) {
  // Portfolio tracking
  const startTimeRef = useRef<number | null>(null);
  const hintsUsedRef = useRef(0);
  const savedToPortfolioRef = useRef<string | null>(null); // Track which proof was saved

  // Start timer when proof begins
  useEffect(() => {
    if (proof && !proof.is_complete && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      hintsUsedRef.current = 0;
      savedToPortfolioRef.current = null;
    }
    // Reset when proof is cleared
    if (!proof) {
      startTimeRef.current = null;
      hintsUsedRef.current = 0;
      savedToPortfolioRef.current = null;
    }
  }, [proof]);

  // Save to portfolio when proof is completed
  useEffect(() => {
    if (proof?.is_complete && savedToPortfolioRef.current !== proof.id) {
      savedToPortfolioRef.current = proof.id;
      const timeSpent = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : undefined;
      // Await the save to ensure it completes before potential app close
      (async () => {
        try {
          await saveToPortfolio(proof, timeSpent, hintsUsedRef.current);
        } catch (err) {
          console.error('Failed to auto-save completed proof:', err);
        }
      })();
    }
  }, [proof, saveToPortfolio]);

  // Track hints used
  const incrementHintsUsed = useCallback(() => {
    hintsUsedRef.current += 1;
  }, []);

  // Get time spent for manual save
  const getTimeSpent = useCallback(() => {
    return startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : undefined;
  }, []);

  // Get hints used for manual save
  const getHintsUsed = useCallback(() => {
    return hintsUsedRef.current;
  }, []);

  return {
    incrementHintsUsed,
    getTimeSpent,
    getHintsUsed,
  };
}
