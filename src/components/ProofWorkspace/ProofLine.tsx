import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProofLine as ProofLineType, ProofScope } from '../../types';
import { justificationToString } from '../../types';
import { FormulaDisplay } from '../FormulaDisplay';

interface ProofLineProps {
  line: ProofLineType;
  isSelected: boolean;
  onClick: () => void;
  activeScopes: ProofScope[];
  startsScope: ProofScope | null;
  endsScope: ProofScope | null;
  maxScopes: number;
  goal?: string;
  readOnly?: boolean;
  isNew?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  dropValid?: boolean;
  dropReason?: string;
}

// Render scope brackets on the right side
const ScopeBrackets: React.FC<{
  activeScopes: ProofScope[];
  startsScope: ProofScope | null;
  endsScope: ProofScope | null;
  maxScopes: number;
}> = ({ activeScopes, startsScope, endsScope, maxScopes }) => {
  if (maxScopes === 0) return null;

  const bracketWidth = 12;
  const totalWidth = maxScopes * bracketWidth;

  return (
    <div className="scope-brackets" style={{ width: totalWidth }}>
      {activeScopes.map((scope, index) => {
        const isStart = startsScope?.id === scope.id;
        const isEnd = endsScope?.id === scope.id;
        const left = index * bracketWidth;

        return (
          <div
            key={scope.id}
            className="scope-bracket"
            style={{ left }}
          >
            <div className="scope-line-vertical" />
            {isStart && (
              <div className="scope-line-top">
                <span className="scope-arrow">←</span>
              </div>
            )}
            {isEnd && (
              <div className="scope-line-bottom">
                <span className="scope-arrow">←</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const ProofLine: React.FC<ProofLineProps> = ({
  line,
  isSelected,
  onClick,
  activeScopes,
  startsScope,
  endsScope,
  maxScopes,
  goal,
  readOnly = false,
  isNew = false,
  isDragging = false,
  isDropTarget = false,
  dropValid = true,
  dropReason = '',
}) => {
  const classNames = [
    'proof-line',
    isSelected ? 'selected' : '',
    !line.is_valid ? 'invalid' : '',
    readOnly ? 'read-only' : '',
    isNew ? 'new-line' : '',
    isDragging ? 'dragging' : '',
    isDropTarget ? (dropValid ? 'drop-valid' : 'drop-invalid') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      data-depth={line.depth}
      onClick={readOnly ? undefined : onClick}
      title={line.validation_message || (isDropTarget && !dropValid ? dropReason : undefined)}
    >
      {goal && (
        <span className="scope-goal">{goal}</span>
      )}
      <span className="line-number">{line.line_number}.</span>
      <span className="formula">
        <FormulaDisplay formula={line.formula} style={{ color: line.is_valid ? 'inherit' : 'var(--error)' }} />
      </span>
      <span className="justification">{justificationToString(line.justification)}</span>
      <ScopeBrackets
        activeScopes={activeScopes}
        startsScope={startsScope}
        endsScope={endsScope}
        maxScopes={maxScopes}
      />
    </div>
  );
};

// Sortable version of ProofLine with drag handle
export const SortableProofLine: React.FC<ProofLineProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({ id: props.line.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting ? 0.5 : 1,
  };

  const {
    line,
    isSelected,
    onClick,
    activeScopes,
    startsScope,
    endsScope,
    maxScopes,
    goal,
    readOnly = false,
    isNew = false,
    isDragging = false,
    isDropTarget = false,
    dropValid = true,
    dropReason = '',
  } = props;

  const classNames = [
    'proof-line',
    'sortable',
    isSelected ? 'selected' : '',
    !line.is_valid ? 'invalid' : '',
    readOnly ? 'read-only' : '',
    isNew ? 'new-line' : '',
    isDragging || isSorting ? 'dragging' : '',
    isDropTarget ? (dropValid ? 'drop-valid' : 'drop-invalid') : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Check if this line can be dragged (not premise, assumption, or conclusion)
  const canDrag = line.justification.type !== 'Premise' &&
    line.justification.type !== 'Assumption' &&
    line.justification.type !== 'SubproofConclusion';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames}
      data-depth={line.depth}
      onClick={readOnly ? undefined : onClick}
      title={line.validation_message || (isDropTarget && !dropValid ? dropReason : undefined)}
    >
      {canDrag && (
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </span>
      )}
      {goal && (
        <span className="scope-goal">{goal}</span>
      )}
      <span className="line-number">{line.line_number}.</span>
      <span className="formula">
        <FormulaDisplay formula={line.formula} style={{ color: line.is_valid ? 'inherit' : 'var(--error)' }} />
      </span>
      <span className="justification">{justificationToString(line.justification)}</span>
      <ScopeBrackets
        activeScopes={activeScopes}
        startsScope={startsScope}
        endsScope={endsScope}
        maxScopes={maxScopes}
      />
    </div>
  );
};
