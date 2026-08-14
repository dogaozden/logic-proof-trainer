import React, { useState } from 'react';
import { useTheorems, CURATED_EXAMPLES } from '../../hooks/useTheorems';
import { useProof } from '../../hooks/useProof';
import type { Difficulty } from '../../types';
import { ALL_DIFFICULTIES, difficultyColor, difficultyLabel } from '../../types';
import { CustomTheoremModal } from './CustomTheoremModal';

// Unified difficulty mode - either a tier or custom value
type DifficultyMode =
  | { type: 'tier'; value: Difficulty }
  | { type: 'custom'; value: number };

export const TheoremList: React.FC = () => {
  const { generateTheoremByTier, generateTheoremWithValue, selectTheorem } = useTheorems();
  const { createProof } = useProof();

  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode | null>(null);
  const [customInputValue, setCustomInputValue] = useState<string>('50');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const handleCardClick = (difficulty: Difficulty) => {
    setDifficultyMode({ type: 'tier', value: difficulty });
  };

  const handleCustomInputChange = (value: string) => {
    setCustomInputValue(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
      setDifficultyMode({ type: 'custom', value: numValue });
    }
  };

  const handleCustomInputFocus = () => {
    const numValue = parseInt(customInputValue, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
      setDifficultyMode({ type: 'custom', value: numValue });
    }
  };

  const handleGenerateNew = async () => {
    if (!difficultyMode) return;

    setIsGenerating(true);
    try {
      let theorem;
      if (difficultyMode.type === 'tier') {
        theorem = await generateTheoremByTier(difficultyMode.value);
      } else {
        theorem = await generateTheoremWithValue(difficultyMode.value);
      }
      selectTheorem(theorem);
      await createProof(theorem);
    } finally {
      setIsGenerating(false);
    }
  };

  const isTierSelected = (difficulty: Difficulty) =>
    difficultyMode?.type === 'tier' && difficultyMode.value === difficulty;

  const isCustomSelected = difficultyMode?.type === 'custom';

  return (
    <>
      <div className="theorem-list-header">
        <h2>Theorems</h2>
      </div>

      {/* Scrollable 10-Tier Cards */}
      <div className="tier-card-list">
        {ALL_DIFFICULTIES.map((difficulty) => {
          const example = CURATED_EXAMPLES[difficulty];
          const isSelected = isTierSelected(difficulty);
          const color = difficultyColor(difficulty);
          // For cosmic/mind with light colors, use dark text on the badge
          const badgeTextColor = (difficulty === 'cosmic') ? '#333' : 'white';

          return (
            <div
              key={difficulty}
              className={`tier-card ${isSelected ? 'tier-card-selected' : ''}`}
              onClick={() => handleCardClick(difficulty)}
              style={{
                borderColor: isSelected ? color : undefined,
              }}
            >
              {/* Card Header */}
              <div className="tier-card-header">
                <span
                  className="tier-card-name"
                  style={{ color: isSelected ? color : undefined }}
                >
                  {difficultyLabel(difficulty)}
                </span>
                <span
                  className="tier-card-badge"
                  style={{ backgroundColor: color, color: badgeTextColor }}
                >
                  {example.benchmarkId}
                </span>
              </div>

              {/* Formula preview */}
              <div className="tier-card-formula">
                {'\u2234 '}{example.formulaString}
              </div>

              {/* Description */}
              <p className="tier-card-desc">
                {example.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Custom Difficulty Input + Action Buttons at Bottom */}
      <div className="tier-bottom-panel">
        {/* Custom difficulty input */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Custom difficulty:
            </span>
            <input
              type="number"
              min="1"
              max="100"
              value={customInputValue}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              onFocus={handleCustomInputFocus}
              className={`tier-custom-input ${isCustomSelected ? 'tier-custom-input-active' : ''}`}
              placeholder="1-100"
              title="Custom difficulty (1-100)"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-primary"
            onClick={handleGenerateNew}
            disabled={!difficultyMode || isGenerating}
            style={{ flex: 1 }}
          >
            {isGenerating ? 'Generating...' : 'Generate New'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowCustomModal(true)}
            style={{ flexShrink: 0 }}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Theorem Modal */}
      <CustomTheoremModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onCreated={() => {
          setShowCustomModal(false);
        }}
      />
    </>
  );
};
