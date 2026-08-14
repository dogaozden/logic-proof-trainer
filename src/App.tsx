import { useState, useEffect, useRef } from 'react';
import { TheoremList } from './components/TheoremList/TheoremList';
import { ProofWorkspace } from './components/ProofWorkspace/ProofWorkspace';
import { Portfolio } from './components/Portfolio/Portfolio';
import { Settings } from './components/Settings/Settings';
import { Scratchpad } from './components/Scratchpad';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTheme } from './hooks/useTheme';
import { useProof } from './hooks/useProof';
import './styles/main.css';

type View = 'theorems' | 'scratchpad' | 'portfolio';

function App() {
  const [view, setView] = useState<View>('theorems');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme } = useTheme();
  const { proof } = useProof();
  const prevProofRef = useRef(proof);

  // Apply theme whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Switch to scratchpad when a new proof is started
  useEffect(() => {
    // Detect when proof changes from null to non-null (new proof started)
    if (proof && !prevProofRef.current) {
      setView('scratchpad');
    }
    prevProofRef.current = proof;
  }, [proof]);

  return (
    <ErrorBoundary>
      <div className="app-container">
        <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {!sidebarCollapsed && (
            <div className="sidebar-nav">
              <button
                className={`nav-tab ${view === 'theorems' ? 'active' : ''}`}
                onClick={() => setView('theorems')}
                title="Theorems"
              >
                Theorems
              </button>
              <button
                className={`nav-tab ${view === 'scratchpad' ? 'active' : ''}`}
                onClick={() => setView('scratchpad')}
                title="Scratchpad"
              >
                Scratchpad
              </button>
              <button
                className={`nav-tab ${view === 'portfolio' ? 'active' : ''}`}
                onClick={() => setView('portfolio')}
                title="Portfolio"
              >
                Portfolio
              </button>
            </div>
          )}
          <div className={`sidebar-content ${sidebarCollapsed ? 'hidden' : ''}`}>
            {view === 'theorems' && <TheoremList />}
            {view === 'scratchpad' && <Scratchpad />}
          </div>
          {/* Toggle inside sidebar when expanded */}
          {!sidebarCollapsed && (
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
            >
              ‹
            </button>
          )}
        </div>
        {/* Toggle at fixed position when collapsed */}
        {sidebarCollapsed && (
          <button
            className="sidebar-toggle-collapsed"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
          >
            ›
          </button>
        )}
        {view === 'theorems' || view === 'scratchpad' ? (
          <ProofWorkspace />
        ) : (
          <Portfolio onRetry={() => setView('theorems')} />
        )}

        {/* Settings gear icon */}
        <button
          className="settings-gear"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          ⚙
        </button>

        {/* Settings modal */}
        {showSettings && (
          <div className="settings-overlay" onClick={() => setShowSettings(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="settings-close"
                onClick={() => setShowSettings(false)}
                title="Close"
              >
                ✕
              </button>
              <Settings />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
