'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type HTMLAttributes,
  type ChangeEvent,
} from 'react';

import { CanvasPanel } from './CanvasPanel.js';
import {
  graphAnalysisPanelReducer,
  initialGraphAnalysisPanelState,
} from './GraphAnalysisPanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const CATEGORIES = [
  'centrality',
  'community',
  'path',
  'pattern',
  'flow',
  'structural',
  'clustering',
] as const;

type AnalysisCategory = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  centrality: 'Centrality',
  community: 'Community',
  path: 'Path',
  pattern: 'Pattern',
  flow: 'Flow',
  structural: 'Structural',
  clustering: 'Clustering',
};

const CATEGORY_ALGORITHMS: Record<AnalysisCategory, string[]> = {
  centrality: ['degree', 'betweenness', 'closeness', 'eigenvector', 'pagerank', 'katz'],
  community: ['louvain', 'label-propagation', 'girvan-newman', 'modularity'],
  path: ['shortest-path', 'all-paths', 'minimum-spanning-tree', 'a-star'],
  pattern: ['motif-detection', 'subgraph-isomorphism', 'frequent-subgraph'],
  flow: ['max-flow', 'min-cut', 'network-flow', 'circulation'],
  structural: ['bridges', 'articulation-points', 'strongly-connected', 'biconnected'],
  clustering: ['k-means', 'spectral', 'hierarchical', 'dbscan'],
};

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface GraphAnalysisPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Canvas this panel belongs to. */
  canvasId: string;
  /** JSON-serialised graph snapshot. */
  graphData?: string;
  /** Currently selected analysis category. */
  selectedCategory: AnalysisCategory;
  /** Currently selected algorithm within the category. */
  selectedAlgorithm?: string;
  /** JSON-serialised algorithm configuration. */
  algorithmConfig?: string;
  /** ID of the current result set. */
  resultId?: string;
  /** Overlay kinds available for visualisation. */
  overlayKinds?: string[];
  /** Report output format. */
  reportFormat?: 'table' | 'summary' | 'dashboard';
  /** Automatically enable overlays when results arrive. */
  autoOverlay?: boolean;
  /** Called when the user runs analysis. */
  onRun?: (algorithm: string, config: string) => void;
  /** Called when overlay visibility is toggled. */
  onOverlayToggle?: (kind: string, enabled: boolean) => void;
  /** Called when the user requests a report. */
  onGenerateReport?: (format: string) => void;
  /** Called when the user exports results. */
  onExport?: (resultId: string) => void;
  /** Called when the user compares results. */
  onCompare?: (resultIdA: string, resultIdB: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const GraphAnalysisPanel = forwardRef<HTMLDivElement, GraphAnalysisPanelProps>(
  function GraphAnalysisPanel(
    {
      canvasId,
      graphData,
      selectedCategory,
      selectedAlgorithm,
      algorithmConfig,
      resultId,
      overlayKinds = ['node-color', 'node-size'],
      reportFormat = 'table',
      autoOverlay = true,
      onRun,
      onOverlayToggle,
      onGenerateReport,
      onExport,
      onCompare,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(graphAnalysisPanelReducer, initialGraphAnalysisPanelState);

    /* --- Local UI state not part of the state machine --- */
    const [localAlgorithm, setLocalAlgorithm] = useState(selectedAlgorithm ?? '');
    const [localConfig, setLocalConfig] = useState(algorithmConfig ?? '{}');
    const [localFormat, setLocalFormat] = useState<'table' | 'summary' | 'dashboard'>(reportFormat);
    const [enabledOverlays, setEnabledOverlays] = useState<Set<string>>(new Set(overlayKinds));
    const [compareResultId, setCompareResultId] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const algorithms = useMemo(
      () => CATEGORY_ALGORITHMS[selectedCategory] ?? [],
      [selectedCategory],
    );

    /* --- Sync controlled selectedCategory to state machine --- */
    useEffect(() => {
      send({ type: 'SELECT_CATEGORY', category: selectedCategory });
    }, [selectedCategory]);

    /* --- Sync controlled selectedAlgorithm --- */
    useEffect(() => {
      if (selectedAlgorithm) {
        setLocalAlgorithm(selectedAlgorithm);
        send({ type: 'SELECT_ALGORITHM', algorithm: selectedAlgorithm });
      }
    }, [selectedAlgorithm]);

    /* --- Sync controlled algorithmConfig --- */
    useEffect(() => {
      if (algorithmConfig !== undefined) {
        setLocalConfig(algorithmConfig);
      }
    }, [algorithmConfig]);

    /* --- Sync controlled resultId — transition to showingResults --- */
    useEffect(() => {
      if (resultId && state.workflow === 'running') {
        send({ type: 'COMPLETE', resultId });
        setStatusMessage('');
        if (autoOverlay) {
          send({ type: 'ENABLE_OVERLAYS' });
        }
      }
    }, [resultId, state.workflow, autoOverlay]);

    /* --- Sync controlled reportFormat --- */
    useEffect(() => {
      setLocalFormat(reportFormat);
    }, [reportFormat]);

    /* --- Handlers --- */
    const handleAlgorithmChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setLocalAlgorithm(value);
        send({ type: 'SELECT_ALGORITHM', algorithm: value });
      },
      [],
    );

    const handleConfigChange = useCallback(
      (e: ChangeEvent<HTMLTextAreaElement>) => {
        setLocalConfig(e.target.value);
      },
      [],
    );

    const handleRun = useCallback(() => {
      if (!localAlgorithm) return;
      send({ type: 'RUN' });
      setStatusMessage(`Running ${localAlgorithm}...`);
      onRun?.(localAlgorithm, localConfig);
    }, [localAlgorithm, localConfig, onRun]);

    const handleCancel = useCallback(() => {
      send({ type: 'CANCEL' });
      setStatusMessage('');
    }, []);

    const handleMasterOverlayToggle = useCallback(() => {
      send({ type: 'TOGGLE_OVERLAY' });
    }, []);

    const handleOverlayKindToggle = useCallback(
      (kind: string) => {
        setEnabledOverlays((prev) => {
          const next = new Set(prev);
          const nowEnabled = !next.has(kind);
          if (nowEnabled) {
            next.add(kind);
          } else {
            next.delete(kind);
          }
          onOverlayToggle?.(kind, nowEnabled);
          return next;
        });
      },
      [onOverlayToggle],
    );

    const handleGenerateReport = useCallback(() => {
      send({ type: 'GENERATE_REPORT' });
      onGenerateReport?.(localFormat);
    }, [localFormat, onGenerateReport]);

    const handleBackToResults = useCallback(() => {
      send({ type: 'BACK_TO_RESULTS' });
    }, []);

    const handleExport = useCallback(() => {
      if (resultId) {
        send({ type: 'EXPORT' });
        onExport?.(resultId);
      }
    }, [resultId, onExport]);

    const handleCompare = useCallback(() => {
      if (resultId && compareResultId) {
        send({ type: 'COMPARE' });
        onCompare?.(resultId, compareResultId);
      }
    }, [resultId, compareResultId, onCompare]);

    const handleFormatChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        setLocalFormat(e.target.value as 'table' | 'summary' | 'dashboard');
      },
      [],
    );

    const handleCompareResultIdChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setCompareResultId(e.target.value);
        if (e.target.value) {
          send({ type: 'LOAD_PREVIOUS_RESULT' });
        }
      },
      [],
    );

    /* --- Derived booleans --- */
    const isRunning = state.workflow === 'running';
    const hasResults = state.workflow === 'showingResults'
      || state.workflow === 'showingReport'
      || state.workflow === 'comparing';
    const showReport = state.workflow === 'showingReport';
    const showCompare = state.workflow === 'comparing';
    const overlaysOn = state.overlays === 'overlaysOn';

    return (
      <CanvasPanel
        ref={ref}
        canvasId={canvasId}
        ariaLabel="Graph analysis panel"
        title="Graph Analysis"
        dock="right"
      >
        <div
          data-surface-widget=""
          data-widget-name="graph-analysis-panel"
          data-part="root"
          data-state={state.workflow}
          data-overlays={state.overlays}
          data-canvas={canvasId}
          data-category={selectedCategory}
          data-algorithm={localAlgorithm || undefined}
          data-result-id={resultId || undefined}
          role="region"
          aria-label="Graph analysis controls"
          {...rest}
        >
          {/* --- Category tabs (rendered inline for semantics) --- */}
          <div
            data-part="category-tabs"
            role="tablist"
            aria-label="Analysis categories"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                data-part="category-tab"
                data-category={cat}
                data-state={selectedCategory === cat ? 'active' : 'inactive'}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat}
                aria-label={CATEGORY_LABELS[cat]}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* --- Algorithm selector --- */}
          <div data-part="algorithm-selector" role="group" aria-label="Algorithm selection">
            <label htmlFor={`algo-select-${canvasId}`}>Algorithm</label>
            <select
              id={`algo-select-${canvasId}`}
              data-part="algorithm-dropdown"
              value={localAlgorithm}
              onChange={handleAlgorithmChange}
              disabled={isRunning}
              aria-label="Select algorithm"
            >
              <option value="">-- Select --</option>
              {algorithms.map((algo) => (
                <option key={algo} value={algo}>
                  {algo}
                </option>
              ))}
            </select>
          </div>

          {/* --- Config form --- */}
          <div
            data-part="config-form"
            data-visible={state.workflow === 'configuring' || state.workflow === 'idle' ? 'true' : 'false'}
            role="form"
            aria-label="Algorithm configuration"
          >
            <label htmlFor={`algo-config-${canvasId}`}>Configuration (JSON)</label>
            <textarea
              id={`algo-config-${canvasId}`}
              data-part="config-input"
              value={localConfig}
              onChange={handleConfigChange}
              disabled={isRunning}
              rows={4}
              aria-label="Algorithm configuration JSON"
            />
          </div>

          {/* --- Run button --- */}
          <div data-part="run-controls">
            <button
              data-part="run-button"
              type="button"
              disabled={isRunning || !localAlgorithm}
              aria-disabled={isRunning || !localAlgorithm}
              aria-label={isRunning ? 'Analysis running' : 'Run analysis'}
              onClick={handleRun}
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>

            {isRunning && (
              <button
                data-part="cancel-button"
                type="button"
                aria-label="Cancel analysis"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
          </div>

          {/* --- Status bar --- */}
          <div
            data-part="status-bar"
            data-visible={isRunning ? 'true' : 'false'}
            role="status"
            aria-live="polite"
            aria-label="Analysis status"
          >
            {isRunning && (
              <>
                <span data-part="progress-indicator" aria-hidden="true">
                  &#9696;
                </span>
                <span>{statusMessage}</span>
              </>
            )}
          </div>

          {/* --- Results panel --- */}
          <div
            data-part="results-panel"
            data-visible={hasResults && !showReport && !showCompare ? 'true' : 'false'}
            role="region"
            aria-label="Analysis results"
            aria-hidden={!hasResults || showReport || showCompare}
          >
            {hasResults && !showReport && !showCompare && (
              <>
                <div data-part="result-header">
                  <span>Result: {resultId ?? 'N/A'}</span>
                  <button
                    data-part="export-button"
                    type="button"
                    aria-label="Export results"
                    onClick={handleExport}
                  >
                    Export
                  </button>
                </div>

                {/* --- Scores table --- */}
                <table data-part="scores-table" role="table" aria-label="Analysis scores">
                  <thead>
                    <tr>
                      <th scope="col">Node</th>
                      <th scope="col">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphData ? (
                      (() => {
                        try {
                          const parsed = JSON.parse(graphData);
                          const nodes: Array<{ id: string; score?: number }> = parsed.nodes ?? [];
                          return nodes.map((node) => (
                            <tr key={node.id} data-part="score-row">
                              <td>{node.id}</td>
                              <td>{node.score !== undefined ? node.score.toFixed(4) : '\u2014'}</td>
                            </tr>
                          ));
                        } catch {
                          return (
                            <tr>
                              <td colSpan={2}>No data available</td>
                            </tr>
                          );
                        }
                      })()
                    ) : (
                      <tr>
                        <td colSpan={2}>No graph data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* --- Overlay controls --- */}
          <div
            data-part="overlay-controls"
            data-visible={hasResults ? 'true' : 'false'}
            role="group"
            aria-label="Overlay controls"
          >
            {hasResults && (
              <>
                <div data-part="overlay-master-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={overlaysOn}
                      onChange={handleMasterOverlayToggle}
                      aria-label="Toggle all overlays"
                    />
                    Overlays {overlaysOn ? 'On' : 'Off'}
                  </label>
                </div>

                <div
                  data-part="overlay-toggle-list"
                  data-visible={overlaysOn ? 'true' : 'false'}
                  role="group"
                  aria-label="Individual overlay toggles"
                >
                  {overlaysOn &&
                    overlayKinds.map((kind) => (
                      <label key={kind} data-part="overlay-toggle-item" data-overlay-kind={kind}>
                        <input
                          type="checkbox"
                          checked={enabledOverlays.has(kind)}
                          onChange={() => handleOverlayKindToggle(kind)}
                          aria-label={`Toggle ${kind} overlay`}
                        />
                        {kind}
                      </label>
                    ))}
                </div>
              </>
            )}
          </div>

          {/* --- Report section --- */}
          <div
            data-part="report-section"
            data-visible={showReport ? 'true' : 'false'}
            role="region"
            aria-label="Analysis report"
            aria-hidden={!showReport}
          >
            {showReport && (
              <>
                <div data-part="report-header">
                  <button
                    data-part="back-to-results"
                    type="button"
                    aria-label="Back to results"
                    onClick={handleBackToResults}
                  >
                    &larr; Results
                  </button>
                  <button
                    data-part="export-report-button"
                    type="button"
                    aria-label="Export report"
                    onClick={handleExport}
                  >
                    Export
                  </button>
                </div>

                <div data-part="report-format-selector" role="group" aria-label="Report format">
                  <label htmlFor={`report-format-${canvasId}`}>Format</label>
                  <select
                    id={`report-format-${canvasId}`}
                    value={localFormat}
                    onChange={handleFormatChange}
                    aria-label="Select report format"
                  >
                    <option value="table">Table</option>
                    <option value="summary">Summary</option>
                    <option value="dashboard">Dashboard</option>
                  </select>
                </div>

                <div data-part="report-content" role="document">
                  <p>Report ({localFormat}): {resultId ?? 'N/A'}</p>
                </div>
              </>
            )}
          </div>

          {/* --- Compare section --- */}
          <div
            data-part="compare-section"
            data-visible={showCompare ? 'true' : 'false'}
            role="region"
            aria-label="Compare results"
            aria-hidden={!showCompare}
          >
            {showCompare && (
              <>
                <div data-part="compare-header">
                  <button
                    data-part="back-to-results"
                    type="button"
                    aria-label="Back to results"
                    onClick={handleBackToResults}
                  >
                    &larr; Results
                  </button>
                </div>
                <p>Comparing {resultId} with {compareResultId || '...'}</p>
              </>
            )}
          </div>

          {/* --- Footer actions (visible when results exist) --- */}
          {hasResults && !showReport && !showCompare && (
            <div data-part="footer-actions" role="group" aria-label="Result actions">
              <button
                data-part="generate-report-button"
                type="button"
                aria-label="Generate report"
                onClick={handleGenerateReport}
              >
                Generate Report
              </button>

              <div data-part="compare-controls" role="group" aria-label="Compare controls">
                <input
                  data-part="compare-result-input"
                  type="text"
                  placeholder="Previous result ID"
                  value={compareResultId}
                  onChange={handleCompareResultIdChange}
                  aria-label="Previous result ID for comparison"
                />
                <button
                  data-part="compare-button"
                  type="button"
                  disabled={!compareResultId}
                  aria-disabled={!compareResultId}
                  aria-label="Compare with previous result"
                  onClick={handleCompare}
                >
                  Compare
                </button>
              </div>
            </div>
          )}
        </div>
      </CanvasPanel>
    );
  },
);

GraphAnalysisPanel.displayName = 'GraphAnalysisPanel';
export { GraphAnalysisPanel };
export default GraphAnalysisPanel;
