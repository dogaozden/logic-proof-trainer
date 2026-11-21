import React, { useEffect, useMemo, useState } from 'react';
import { useSetTheoryTrack } from '../../hooks/useSetTheoryTrack';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useProof } from '../../hooks/useProof';
import { useTheorems } from '../../hooks/useTheorems';
import type { Difficulty, TrackExercise } from '../../types';
import { difficultyColor } from '../../types';
import { FormulaDisplay } from '../FormulaDisplay';

// Exercise levels use the four preset difficulties; colors follow the tier palette.
const LEVEL: Record<string, { label: string; tier: Difficulty }> = {
  easy: { label: 'Easy', tier: 'easy' },
  medium: { label: 'Medium', tier: 'medium' },
  hard: { label: 'Hard', tier: 'hard' },
  expert: { label: 'Expert', tier: 'expert' },
};

export const SetTheoryTrack: React.FC = () => {
  const { chapters, error, loadTrack } = useSetTheoryTrack();
  const { entries, loadPortfolio } = usePortfolio();
  const { createProof, proof } = useProof();
  const { selectTheorem } = useTheorems();
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  useEffect(() => {
    loadTrack();
    loadPortfolio();
  }, [loadTrack, loadPortfolio]);

  // An exercise is done once a complete proof of it is in the portfolio (saved on completion).
  const done = useMemo(
    () => new Set(entries.filter((e) => e.proof.is_complete).map((e) => e.proof.theorem.id)),
    [entries],
  );

  useEffect(() => {
    if (openChapter === null && chapters.length > 0) {
      const firstUnfinished = chapters.find((c) => c.exercises.some((x) => !done.has(x.id)));
      setOpenChapter((firstUnfinished ?? chapters[0]).id);
    }
  }, [chapters, done, openChapter]);

  const start = async (exercise: TrackExercise) => {
    selectTheorem(exercise.theorem);
    await createProof(exercise.theorem);
  };

  if (error) return <div className="error-message">{error}</div>;

  const total = chapters.reduce((n, c) => n + c.exercises.length, 0);
  const finished = chapters.reduce((n, c) => n + c.exercises.filter((x) => done.has(x.id)).length, 0);

  return (
    <div className="track">
      <div className="track-intro">
        Halmos, <i>Naive Set Theory</i>, one chapter at a time. Axioms arrive as premises in the order
        Halmos introduces them; Def unfolds ⊆, ∅, {'{a, b}'}, ∪, ∩, −, ℘ and ⟨a, b⟩.
        <div className="track-progress-total">{finished} / {total} proved</div>
      </div>
      {chapters.map((chapter) => {
        const doneHere = chapter.exercises.filter((x) => done.has(x.id)).length;
        const isOpen = openChapter === chapter.id;
        return (
          <div key={chapter.id} className={`track-chapter ${isOpen ? 'open' : ''}`}>
            <button className="track-chapter-header" onClick={() => setOpenChapter(isOpen ? null : chapter.id)}>
              <span className="track-chapter-number">{chapter.number === 0 ? '§0' : `§${chapter.number}`}</span>
              <span className="track-chapter-title">{chapter.title}</span>
              <span className="track-chapter-progress">{doneHere}/{chapter.exercises.length}</span>
            </button>
            {isOpen && (
              <div className="track-chapter-body">
                <p className="track-chapter-summary">{chapter.summary}</p>
                {chapter.axioms.map((axiom) => (
                  <div key={axiom.id} className="track-axiom" title={axiom.note}>
                    <span className="track-axiom-name">Axiom of {axiom.name}</span>
                    <FormulaDisplay formula={axiom.formula} />
                  </div>
                ))}
                {chapter.exercises.map((exercise, i) => {
                  const level = LEVEL[exercise.theorem.difficulty];
                  const active = proof?.theorem.id === exercise.id;
                  return (
                    <div
                      key={exercise.id}
                      className={`track-exercise ${active ? 'active' : ''} ${done.has(exercise.id) ? 'done' : ''}`}
                      onClick={() => start(exercise)}
                      data-exercise={exercise.id}
                    >
                      <div className="track-exercise-header">
                        <span className="track-exercise-check">{done.has(exercise.id) ? '✓' : `${chapter.number}.${i + 1}`}</span>
                        <span className="track-exercise-title">{exercise.title}</span>
                        <span className="tier-card-badge" style={{ backgroundColor: difficultyColor(level.tier), color: 'white' }}>
                          {level.label}
                        </span>
                      </div>
                      <div className="track-exercise-formula">
                        {exercise.axioms.length > 0 && (
                          <span className="track-exercise-axioms">{exercise.axioms.map((a) => `[${a}]`).join(' ')} </span>
                        )}
                        {exercise.theorem.premises.length > exercise.axioms.length && (
                          <>
                            {exercise.theorem.premises.slice(exercise.axioms.length).map((p, k) => (
                              <span key={k}>{k > 0 ? ', ' : ''}<FormulaDisplay formula={p} /></span>
                            ))}{' '}
                          </>
                        )}
                        {'⊢ '}<FormulaDisplay formula={exercise.theorem.conclusion} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
