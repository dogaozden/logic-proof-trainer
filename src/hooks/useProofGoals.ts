import { useState, useEffect, useRef } from 'react';
import type { Proof } from '../types';

interface UseProofGoalsOptions {
  proof: Proof | null;
}

export function useProofGoals({ proof }: UseProofGoalsOptions) {
  // Goal tracking for subproofs
  const [scopeGoals, setScopeGoals] = useState<Record<string, string>>({});
  const [pendingGoalScopeId, setPendingGoalScopeId] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState('');

  // Track previous scope count to detect new subproofs
  const prevScopeCountRef = useRef(0);

  useEffect(() => {
    if (!proof) return;
    const currentScopeCount = proof.scope_manager.scopes.length;
    if (currentScopeCount > prevScopeCountRef.current) {
      // New scope was added - find the newest open scope
      const newestOpenScope = proof.scope_manager.scopes.find(s => s.end_line === undefined);
      if (newestOpenScope && !scopeGoals[newestOpenScope.id]) {
        setPendingGoalScopeId(newestOpenScope.id);
        setGoalInput('');
      }
    }
    prevScopeCountRef.current = currentScopeCount;
  }, [proof, scopeGoals]);

  // Handle goal submission
  const handleGoalSubmit = () => {
    if (pendingGoalScopeId && goalInput.trim()) {
      setScopeGoals(prev => ({ ...prev, [pendingGoalScopeId]: goalInput.trim() }));
    }
    setPendingGoalScopeId(null);
    setGoalInput('');
  };

  const handleGoalSkip = () => {
    setPendingGoalScopeId(null);
    setGoalInput('');
  };

  return {
    scopeGoals,
    pendingGoalScopeId,
    goalInput,
    setGoalInput,
    handleGoalSubmit,
    handleGoalSkip,
  };
}
