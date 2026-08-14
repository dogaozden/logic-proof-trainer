import type { Proof, ProofLine, Justification } from '../types';

/**
 * Get the line numbers that a given line depends on
 */
function getLineDependencies(justification: Justification): number[] {
  switch (justification.type) {
    case 'Premise':
      return [];
    case 'Assumption':
      return [];
    case 'Inference':
      return justification.lines;
    case 'Equivalence':
      return [justification.line];
    case 'SubproofConclusion':
      return [justification.subproof_start, justification.subproof_end];
    default:
      return [];
  }
}

/**
 * Check if moving a line to a new position would break dependencies
 */
export function canMoveLine(
  proof: Proof,
  fromLineNumber: number,
  toPosition: number // 0-indexed position in the array
): { valid: boolean; reason?: string } {
  const lines = proof.lines;
  const fromIndex = lines.findIndex(l => l.line_number === fromLineNumber);

  if (fromIndex === -1) {
    return { valid: false, reason: 'Line not found' };
  }

  const movingLine = lines[fromIndex];

  // Can't move premises
  if (movingLine.justification.type === 'Premise') {
    return { valid: false, reason: 'Cannot move premises' };
  }

  // Can't move assumptions (they define scope boundaries)
  if (movingLine.justification.type === 'Assumption') {
    return { valid: false, reason: 'Cannot move assumptions' };
  }

  // Can't move subproof conclusions
  if (movingLine.justification.type === 'SubproofConclusion') {
    return { valid: false, reason: 'Cannot move subproof conclusions' };
  }

  // Get the dependencies of the line being moved
  const deps = getLineDependencies(movingLine.justification);

  // Simulate the new order
  const newLines = [...lines];
  newLines.splice(fromIndex, 1);
  newLines.splice(toPosition, 0, movingLine);

  // Calculate new line numbers
  const newLineNumbers = new Map<string, number>();
  newLines.forEach((line, idx) => {
    newLineNumbers.set(line.id, idx + 1);
  });

  const newLineNumber = newLineNumbers.get(movingLine.id)!;

  // Check: line being moved must come after its dependencies
  for (const depLineNum of deps) {
    const depLine = lines.find(l => l.line_number === depLineNum);
    if (depLine) {
      const depNewLineNum = newLineNumbers.get(depLine.id)!;
      if (depNewLineNum >= newLineNumber) {
        return {
          valid: false,
          reason: `Line depends on line ${depLineNum}, which would come after it`
        };
      }
    }
  }

  // Check: lines that depend on the moved line must still come after it
  for (const line of lines) {
    if (line.id === movingLine.id) continue;

    const lineDeps = getLineDependencies(line.justification);
    if (lineDeps.includes(fromLineNumber)) {
      const dependentNewLineNum = newLineNumbers.get(line.id)!;
      if (dependentNewLineNum <= newLineNumber) {
        return {
          valid: false,
          reason: `Line ${line.line_number} depends on this line and would come before it`
        };
      }
    }
  }

  // Check scope boundaries - line must stay within its scope
  const movingLineScope = movingLine.scope_id;
  if (movingLineScope) {
    const scope = proof.scope_manager.scopes.find(s => s.id === movingLineScope);
    if (scope) {
      // Find the new position boundaries
      const scopeStartLine = lines.find(l => l.line_number === scope.start_line);
      const scopeEndLine = scope.end_line !== undefined
        ? lines.find(l => l.line_number === scope.end_line)
        : null;

      if (scopeStartLine) {
        const scopeStartNewPos = newLineNumbers.get(scopeStartLine.id)!;
        const scopeEndNewPos = scopeEndLine
          ? newLineNumbers.get(scopeEndLine.id)!
          : newLines.length;

        if (newLineNumber < scopeStartNewPos || newLineNumber > scopeEndNewPos) {
          return { valid: false, reason: 'Line cannot leave its subproof scope' };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Reorder lines and update all references
 */
export function reorderLines(
  proof: Proof,
  fromLineNumber: number,
  toPosition: number
): Proof | null {
  const result = canMoveLine(proof, fromLineNumber, toPosition);
  if (!result.valid) {
    return null;
  }

  const lines = [...proof.lines];
  const fromIndex = lines.findIndex(l => l.line_number === fromLineNumber);
  if (fromIndex === -1) {
    return null;
  }
  const movingLine = lines[fromIndex];

  // Remove and reinsert
  lines.splice(fromIndex, 1);
  lines.splice(toPosition, 0, movingLine);

  // Build old -> new line number mapping
  const lineNumberMap = new Map<number, number>();
  const oldLineNumbers = proof.lines.map(l => l.line_number);
  lines.forEach((line, idx) => {
    const oldIdx = proof.lines.findIndex(l => l.id === line.id);
    lineNumberMap.set(oldLineNumbers[oldIdx], idx + 1);
  });

  // Update all line numbers and references
  const updatedLines: ProofLine[] = lines.map((line, idx) => {
    const newLineNumber = idx + 1;
    const updatedJustification = updateJustificationReferences(
      line.justification,
      lineNumberMap
    );
    return {
      ...line,
      line_number: newLineNumber,
      justification: updatedJustification,
    };
  });

  // Update scope references
  const updatedScopes = proof.scope_manager.scopes.map(scope => ({
    ...scope,
    start_line: lineNumberMap.get(scope.start_line) ?? scope.start_line,
    end_line: scope.end_line !== undefined
      ? lineNumberMap.get(scope.end_line) ?? scope.end_line
      : undefined,
  }));

  return {
    ...proof,
    lines: updatedLines,
    scope_manager: {
      ...proof.scope_manager,
      scopes: updatedScopes,
    },
  };
}

function updateJustificationReferences(
  justification: Justification,
  lineNumberMap: Map<number, number>
): Justification {
  switch (justification.type) {
    case 'Inference':
      return {
        ...justification,
        lines: justification.lines.map(ln => lineNumberMap.get(ln) ?? ln),
      };
    case 'Equivalence':
      return {
        ...justification,
        line: lineNumberMap.get(justification.line) ?? justification.line,
      };
    case 'SubproofConclusion':
      return {
        ...justification,
        subproof_start: lineNumberMap.get(justification.subproof_start) ?? justification.subproof_start,
        subproof_end: lineNumberMap.get(justification.subproof_end) ?? justification.subproof_end,
      };
    default:
      return justification;
  }
}
