import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useProof } from '../../hooks/useProof';
import type { PortfolioEntry } from '../../types';
import { FitchBox } from '../ProofWorkspace/FitchBox';
import { FormulaDisplay } from '../FormulaDisplay';

interface PortfolioProps {
  onRetry?: () => void;
}

export const Portfolio: React.FC<PortfolioProps> = ({ onRetry }) => {
  const {
    entries,
    isLoading,
    error,
    selectedEntry,
    loadPortfolio,
    deleteEntry,
    renameEntry,
    selectEntry,
    clearError,
  } = usePortfolio();

  const { createProof, loadProof } = useProof();

  // Tab state for completed vs incomplete
  const [activeTab, setActiveTab] = useState<'completed' | 'incomplete'>('completed');

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Global notepad state
  const [globalNotes, setGlobalNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPortfolio().catch(err => {
      if (!cancelled) console.error('Failed to load portfolio:', err);
    });
    return () => { cancelled = true; };
  }, [loadPortfolio]);

  // Load global notes on mount
  useEffect(() => {
    invoke<string>('load_global_notes')
      .then(notes => setGlobalNotes(notes))
      .catch(err => console.error('Failed to load global notes:', err));
  }, []);

  // Auto-save global notes with debounce
  const handleNotesChange = (value: string) => {
    setGlobalNotes(value);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = window.setTimeout(async () => {
      setNotesSaving(true);
      try {
        await invoke('save_global_notes', { notes: value });
      } catch (err) {
        console.error('Failed to save notes:', err);
      }
      setNotesSaving(false);
    }, 500);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (secs?: number) => {
    if (!secs) return '-';
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    if (mins > 0) {
      return `${mins}m ${remainingSecs}s`;
    }
    return `${remainingSecs}s`;
  };

  const handleStartRename = () => {
    if (selectedEntry) {
      setNameInput(selectedEntry.proof.theorem.name || '');
      setIsEditingName(true);
    }
  };

  const handleSaveRename = async () => {
    if (selectedEntry && nameInput.trim()) {
      await renameEntry(selectedEntry.id, nameInput.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelRename = () => {
    setIsEditingName(false);
    setNameInput('');
  };

  const handleDelete = async (entry: PortfolioEntry) => {
    // Direct delete without confirm dialog for debugging
    try {
      await deleteEntry(entry.id);
    } catch (e) {
      console.error('deleteEntry failed:', e);
    }
  };

  const handleRetry = async (entry: PortfolioEntry) => {
    await createProof(entry.proof.theorem);
    onRetry?.();
  };

  const handleResume = (entry: PortfolioEntry) => {
    loadProof(entry.proof);
    onRetry?.();  // Navigate to workspace
  };

  // Filter entries by completion status
  const completedEntries = entries.filter(e => e.proof.is_complete);
  const incompleteEntries = entries.filter(e => !e.proof.is_complete);
  const displayedEntries = activeTab === 'completed' ? completedEntries : incompleteEntries;

  if (isLoading && entries.length === 0) {
    return (
      <div className="portfolio-container">
        <div className="empty-state">Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h2>My Portfolio</h2>
        <div className="portfolio-tabs">
          <button
            className={`portfolio-tab ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({completedEntries.length})
          </button>
          <button
            className={`portfolio-tab ${activeTab === 'incomplete' ? 'active' : ''}`}
            onClick={() => setActiveTab('incomplete')}
          >
            Incomplete ({incompleteEntries.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={clearError} className="btn-icon">×</button>
        </div>
      )}

      <div className="portfolio-layout">
        {/* Entry List */}
        <div className="portfolio-list">
          {displayedEntries.length === 0 ? (
            <div className="empty-state">
              <h3>No {activeTab} proofs yet</h3>
              <p>
                {activeTab === 'completed'
                  ? 'Complete a proof to add it to your portfolio!'
                  : 'Save your progress on a proof to see it here.'}
              </p>
            </div>
          ) : (
            displayedEntries.map((entry) => (
              <div
                key={entry.id}
                className={`portfolio-entry ${selectedEntry?.id === entry.id ? 'selected' : ''} ${!entry.proof.is_complete ? 'incomplete' : ''}`}
                onClick={() => selectEntry(entry)}
              >
                <div className="entry-header">
                  <span className="entry-name">
                    {entry.proof.theorem.name || 'Custom Proof'}
                  </span>
                  <span className="entry-date">{formatDate(entry.saved_at)}</span>
                </div>
                <div className="entry-formula">
                  {entry.proof.theorem.premises.length > 0 && (
                    <>
                      {entry.proof.theorem.premises.map((p, i) => (
                        <span key={i}>
                          <FormulaDisplay formula={p} />
                          {i < entry.proof.theorem.premises.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                      {' ∴ '}
                    </>
                  )}
                  <FormulaDisplay formula={entry.proof.theorem.conclusion} />
                </div>
                <div className="entry-stats">
                  <span>{entry.steps_count} steps</span>
                  <span>{formatTime(entry.time_spent_secs)}</span>
                  <span>{entry.hints_used} hints</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Entry Detail */}
        {selectedEntry && (
          <div className="portfolio-detail">
            <div className="detail-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isEditingName ? (
                  <>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      autoFocus
                      style={{
                        padding: '4px 8px',
                        fontSize: '1rem',
                        fontWeight: 600,
                        border: '1px solid var(--accent)',
                        borderRadius: '4px',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        minWidth: '150px',
                      }}
                      placeholder="Enter name..."
                    />
                    <button className="btn btn-primary btn-small" onClick={handleSaveRename}>
                      Save
                    </button>
                    <button className="btn btn-secondary btn-small" onClick={handleCancelRename}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <h3 style={{ cursor: 'pointer' }} onClick={handleStartRename} title="Click to rename">
                      {selectedEntry.proof.theorem.name || 'Custom Proof'}
                    </h3>
                    <button
                      className="btn-icon"
                      onClick={handleStartRename}
                      title="Rename"
                      style={{ fontSize: '0.75rem' }}
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedEntry.proof.is_complete ? (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleResume(selectedEntry)}
                    >
                      Review
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleRetry(selectedEntry)}
                    >
                      Retry from scratch
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleResume(selectedEntry)}
                  >
                    Resume
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(selectedEntry)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="detail-theorem">
              <div className="label">Theorem</div>
              <div className="formula">
                {selectedEntry.proof.theorem.premises.length > 0 && (
                  <>
                    {selectedEntry.proof.theorem.premises.map((p, i) => (
                      <span key={i}>
                        <FormulaDisplay formula={p} />
                        {i < selectedEntry.proof.theorem.premises.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    {' ∴ '}
                  </>
                )}
                <FormulaDisplay formula={selectedEntry.proof.theorem.conclusion} />
              </div>
            </div>

            <div className="detail-stats">
              <div className="stat">
                <span className="stat-label">{selectedEntry.proof.is_complete ? 'Completed' : 'Last Saved'}</span>
                <span className="stat-value">{formatDate(selectedEntry.saved_at)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Steps</span>
                <span className="stat-value">{selectedEntry.steps_count}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Time</span>
                <span className="stat-value">{formatTime(selectedEntry.time_spent_secs)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Hints Used</span>
                <span className="stat-value">{selectedEntry.hints_used}</span>
              </div>
            </div>

            <div className="detail-proof">
              <div className="label">Solution</div>
              <FitchBox
                proof={selectedEntry.proof}
                readOnly={true}
              />
            </div>
          </div>
        )}

        {/* Global Notepad */}
        <div className="global-notepad">
          <div className="notepad-header">
            <span className="label">Notepad</span>
            {notesSaving && <span className="saving-indicator">Saving...</span>}
          </div>
          <textarea
            className="notepad-textarea"
            value={globalNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Write your notes here... (auto-saves)"
          />
        </div>
      </div>
    </div>
  );
};
