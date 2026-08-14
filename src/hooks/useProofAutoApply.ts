import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Proof, InferenceRule, EquivalenceRule, TransformationResult } from '../types';
import { inferenceRuleInfo, equivalenceRuleInfo, formulaToString } from '../types';

interface UseProofAutoApplyOptions {
  proof: Proof | null;
  selectedLines: number[];
  selectedInferenceRule: InferenceRule | null;
  selectedEquivalenceRule: EquivalenceRule | null;
  applyInferenceRule: (rule: InferenceRule, lines: number[], formula: string) => Promise<boolean>;
  applyEquivalenceRule: (rule: EquivalenceRule, line: number, formula: string) => Promise<boolean>;
  clearLineSelection: () => void;
  setSelectedInferenceRule: (rule: InferenceRule | null) => void;
  setSelectedEquivalenceRule: (rule: EquivalenceRule | null) => void;
  setFormulaInput: (value: string) => void;
}

export function useProofAutoApply({
  proof,
  selectedLines,
  selectedInferenceRule,
  selectedEquivalenceRule,
  applyInferenceRule,
  applyEquivalenceRule,
  clearLineSelection,
  setSelectedInferenceRule,
  setSelectedEquivalenceRule,
  setFormulaInput,
}: UseProofAutoApplyOptions) {
  // Ref to prevent concurrent auto-apply operations
  const pendingAutoApplyRef = useRef<boolean>(false);

  // Auto-apply inference rule when we have the right number of lines selected
  const tryAutoApplyInference = useCallback(async (rule: InferenceRule, lines: number[]) => {
    const info = inferenceRuleInfo[rule];
    if (lines.length === info.premises) {
      // For rules that don't need additional input, auto-apply without formula
      if (!['addition'].includes(rule)) {
        const success = await applyInferenceRule(rule, lines, '');
        if (success) {
          setSelectedInferenceRule(null);
          clearLineSelection();
        }
        // Don't clear selection on failure so user can see what went wrong
        return success;
      }
    }
    return false;
  }, [applyInferenceRule, clearLineSelection, setSelectedInferenceRule]);

  // Auto-apply equivalence rule when we have 1 line selected
  const tryAutoApplyEquivalence = useCallback(async (rule: EquivalenceRule, line: number) => {
    if (!proof) return false;

    const proofLine = proof.lines.find(l => l.line_number === line);
    if (!proofLine) return false;

    try {
      // Get all possible transformations for this formula
      const allTransformations = await invoke<TransformationResult[]>('get_all_transformations', {
        formulaStr: formulaToString(proofLine.formula),
      });

      // Filter to only transformations matching the selected rule
      const matchingTransformations = allTransformations.filter(
        t => t.rule.toLowerCase() === rule.toLowerCase() ||
          t.rule_abbrev.toLowerCase() === equivalenceRuleInfo[rule].abbrev.toLowerCase()
      );

      // Auto-apply only if there's exactly one matching transformation
      if (matchingTransformations.length === 1) {
        const success = await applyEquivalenceRule(rule, line, matchingTransformations[0].result);
        if (success) {
          setSelectedEquivalenceRule(null);
          clearLineSelection();
        }
        return success;
      }

      // If multiple options, put first one in input field as suggestion
      if (matchingTransformations.length > 1) {
        setFormulaInput(matchingTransformations[0].result);
      }

      return false;
    } catch {
      return false;
    }
  }, [proof, applyEquivalenceRule, clearLineSelection, setSelectedEquivalenceRule, setFormulaInput]);

  // Effect to auto-apply when lines + rule are ready
  useEffect(() => {
    if (selectedInferenceRule && selectedLines.length > 0 && !pendingAutoApplyRef.current) {
      pendingAutoApplyRef.current = true;
      tryAutoApplyInference(selectedInferenceRule, selectedLines).finally(() => {
        pendingAutoApplyRef.current = false;
      });
    }
  }, [selectedLines, selectedInferenceRule, tryAutoApplyInference]);

  // Effect to auto-apply equivalence when line + rule are ready
  useEffect(() => {
    if (selectedEquivalenceRule && selectedLines.length === 1 && !pendingAutoApplyRef.current) {
      pendingAutoApplyRef.current = true;
      tryAutoApplyEquivalence(selectedEquivalenceRule, selectedLines[0]).finally(() => {
        pendingAutoApplyRef.current = false;
      });
    }
  }, [selectedLines, selectedEquivalenceRule, tryAutoApplyEquivalence]);

  return {
    tryAutoApplyInference,
    tryAutoApplyEquivalence,
  };
}
