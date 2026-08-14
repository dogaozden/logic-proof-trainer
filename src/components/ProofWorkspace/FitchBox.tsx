import React, { useRef, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ProofLine, SortableProofLine } from './ProofLine';
import type { Proof, ProofScope } from '../../types';
import { canMoveLine, reorderLines } from '../../utils/proofReorder';

interface FitchBoxProps {
  proof: Proof;
  selectedLines?: number[];
  onLineClick?: (lineNumber: number) => void;
  scopeGoals?: Record<string, string>;
  pendingGoalScopeId?: string | null;
  goalInput?: string;
  onGoalInputChange?: (value: string) => void;
  onGoalSubmit?: () => void;
  onGoalSkip?: () => void;
  readOnly?: boolean;
  isComplete?: boolean;
  onReorder?: (newProof: Proof) => void;
}

// Calculate which scopes are active at each line
function getScopeInfo(proof: Proof) {
  const scopeMap: Map<number, {
    activeScopes: ProofScope[];
    startsScope: ProofScope | null;
    endsScope: ProofScope | null;
  }> = new Map();

  // Initialize map for each line
  for (const line of proof.lines) {
    scopeMap.set(line.line_number, {
      activeScopes: [],
      startsScope: null,
      endsScope: null,
    });
  }

  // Process each scope
  for (const scope of proof.scope_manager.scopes) {
    const startInfo = scopeMap.get(scope.start_line);
    if (startInfo) {
      startInfo.startsScope = scope;
    }

    if (scope.end_line !== undefined) {
      const endInfo = scopeMap.get(scope.end_line);
      if (endInfo) {
        endInfo.endsScope = scope;
      }
    }

    // Mark all lines within the scope as having this scope active
    for (const line of proof.lines) {
      const lineNum = line.line_number;
      const endLine = scope.end_line ?? Infinity;

      if (lineNum >= scope.start_line && lineNum <= endLine) {
        const info = scopeMap.get(lineNum);
        if (info) {
          info.activeScopes.push(scope);
        }
      }
    }
  }

  return scopeMap;
}

export const FitchBox: React.FC<FitchBoxProps> = ({
  proof,
  selectedLines = [],
  onLineClick = () => { },
  scopeGoals = {},
  pendingGoalScopeId = null,
  goalInput = '',
  onGoalInputChange = () => { },
  onGoalSubmit = () => { },
  onGoalSkip = () => { },
  readOnly = false,
  isComplete = false,
  onReorder,
}) => {
  const scopeInfo = getScopeInfo(proof);

  // Track new lines for animation
  const prevLineCountRef = useRef(proof.lines.length);
  const [newLineIds, setNewLineIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<number | undefined>(undefined);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropValid, setDropValid] = useState<boolean>(true);
  const [dropReason, setDropReason] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Always clear existing timer first
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    const currentCount = proof.lines.length;
    const prevCount = prevLineCountRef.current;

    if (currentCount > prevCount) {
      // New lines were added - mark the newest ones
      const newIds = new Set(
        proof.lines.slice(prevCount).map(line => line.id)
      );
      setNewLineIds(newIds);

      // Clear the "new" status after animation completes
      timerRef.current = window.setTimeout(() => {
        setNewLineIds(new Set());
        timerRef.current = undefined;
      }, 300);
    } else {
      // Lines were removed or stayed the same (undo, etc.)
      setNewLineIds(new Set());
    }

    prevLineCountRef.current = currentCount;

    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    };
  }, [proof.lines]);

  // Find the maximum number of active scopes (for calculating width)
  let maxScopes = 0;
  for (const info of scopeInfo.values()) {
    maxScopes = Math.max(maxScopes, info.activeScopes.length);
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over) {
      setOverId(null);
      setDropValid(false);
      return;
    }

    setOverId(over.id as string);

    // Find the line being dragged
    const draggedLine = proof.lines.find(l => l.id === active.id);
    if (!draggedLine) return;

    // Find the target position
    const targetIndex = proof.lines.findIndex(l => l.id === over.id);
    if (targetIndex === -1) return;

    // Check if the move is valid
    const result = canMoveLine(proof, draggedLine.line_number, targetIndex);
    setDropValid(result.valid);
    setDropReason(result.reason || '');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setDropValid(true);
    setDropReason('');

    if (!over || active.id === over.id || !onReorder) return;

    const draggedLine = proof.lines.find(l => l.id === active.id);
    if (!draggedLine) return;

    const targetIndex = proof.lines.findIndex(l => l.id === over.id);
    if (targetIndex === -1) return;

    const newProof = reorderLines(proof, draggedLine.line_number, targetIndex);
    if (newProof) {
      onReorder(newProof);
    }
  };

  const activeLine = activeId ? proof.lines.find(l => l.id === activeId) : null;
  const activeLineInfo = activeLine ? scopeInfo.get(activeLine.line_number) : null;

  const canDrag = !readOnly && !isComplete && onReorder;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`fitch-box ${isComplete ? 'complete' : ''}`}>
        <SortableContext
          items={proof.lines.map(l => l.id)}
          strategy={verticalListSortingStrategy}
          disabled={!canDrag}
        >
          {proof.lines.map((line) => {
            const info = scopeInfo.get(line.line_number);
            const startsScope = info?.startsScope;
            const goal = startsScope ? scopeGoals[startsScope.id] : undefined;
            const showGoalInput = startsScope && pendingGoalScopeId === startsScope.id;
            const isBeingDraggedOver = overId === line.id && activeId !== line.id;

            return (
              <React.Fragment key={line.id}>
                {canDrag ? (
                  <SortableProofLine
                    line={line}
                    isSelected={selectedLines.includes(line.line_number)}
                    onClick={() => onLineClick(line.line_number)}
                    activeScopes={info?.activeScopes || []}
                    startsScope={startsScope || null}
                    endsScope={info?.endsScope || null}
                    maxScopes={maxScopes}
                    goal={goal}
                    readOnly={readOnly}
                    isNew={newLineIds.has(line.id)}
                    isDragging={activeId === line.id}
                    isDropTarget={isBeingDraggedOver}
                    dropValid={isBeingDraggedOver ? dropValid : true}
                    dropReason={isBeingDraggedOver ? dropReason : ''}
                  />
                ) : (
                  <ProofLine
                    line={line}
                    isSelected={selectedLines.includes(line.line_number)}
                    onClick={() => onLineClick(line.line_number)}
                    activeScopes={info?.activeScopes || []}
                    startsScope={startsScope || null}
                    endsScope={info?.endsScope || null}
                    maxScopes={maxScopes}
                    goal={goal}
                    readOnly={readOnly}
                    isNew={newLineIds.has(line.id)}
                  />
                )}
                {showGoalInput && (
                  <div
                    className="goal-input-row"
                    data-depth={line.depth}
                    style={{ marginLeft: `${line.depth * 8}px` }}
                  >
                    <div className="goal-input-container">
                      <span className="goal-label">Goal:</span>
                      <input
                        type="text"
                        className="goal-input"
                        value={goalInput}
                        onChange={(e) => onGoalInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onGoalSubmit();
                          if (e.key === 'Escape') onGoalSkip();
                        }}
                        placeholder="What are you trying to derive?"
                        autoFocus
                      />
                      <button className="btn btn-small btn-primary" onClick={onGoalSubmit}>Set</button>
                      <button className="btn btn-small btn-secondary" onClick={onGoalSkip}>Skip</button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </SortableContext>

        {proof.lines.length === 0 && (
          <div className="empty-state">
            <p>No lines in proof yet.</p>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeLine && activeLineInfo && (
          <div className="proof-line-drag-overlay">
            <ProofLine
              line={activeLine}
              isSelected={false}
              onClick={() => {}}
              activeScopes={activeLineInfo.activeScopes}
              startsScope={activeLineInfo.startsScope}
              endsScope={activeLineInfo.endsScope}
              maxScopes={maxScopes}
              readOnly={true}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
