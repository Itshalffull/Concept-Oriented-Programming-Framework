'use client';

/**
 * ScoreView — Score analysis panels
 * Tabs: Concept Graph (impact), Flow Traces, Schema Browser
 */

import React, { useState, useEffect } from 'react';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';

interface HealthData {
  registeredConcepts?: string[];
  concepts?: string[];
}

export const ScoreView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'impact' | 'trace' | 'schemas'>('impact');
  const [concepts, setConcepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { navigateToHref } = useNavigator();

  useEffect(() => {
    async function fetchConcepts() {
      try {
        const res = await fetch('/api/health');
        const data: HealthData = await res.json();
        setConcepts(data.registeredConcepts ?? data.concepts ?? []);
      } catch {
        // Fallback to known concept list
        setConcepts([
          'ComponentMapping', 'ConceptBrowser', 'SlotSource',
          'BlockEmbedSource', 'EntityFieldSource', 'FormulaSource',
          'MenuSource', 'StaticValueSource', 'ViewEmbedSource',
          'WidgetEmbedSource', 'HubProxy', 'EntityReferenceDisplaySource',
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchConcepts();
  }, []);

  return (
    <div className="view-shell">
      <div className="view-page-header">
        <h1>Score</h1>
        <Badge variant="info">code-as-data</Badge>
      </div>

      <p className="view-page-copy">
        Score provides semantic analysis of the Clef application: concept dependencies,
        sync chains, handler coverage, and data flow paths.
      </p>

      <div className="view-tabs" data-part="tabs">
        <button data-part="tab" data-active={activeTab === 'impact' ? 'true' : 'false'} onClick={() => setActiveTab('impact')}>
          Concept Graph
        </button>
        <button data-part="tab" data-active={activeTab === 'trace' ? 'true' : 'false'} onClick={() => setActiveTab('trace')}>
          Flow Traces
        </button>
        <button data-part="tab" data-active={activeTab === 'schemas' ? 'true' : 'false'} onClick={() => setActiveTab('schemas')}>
          Schema Browser
        </button>
      </div>

      {activeTab === 'impact' && (
        <div className="view-panel score-panel">
          <div className="view-panel__header">
            <h2 className="view-section-title">Concept Dependency Graph</h2>
            <Badge variant="secondary">{concepts.length} concepts</Badge>
          </div>
          <p className="view-page-copy" style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--typography-body-sm-size)' }}>
            Resolved from <code>score-impact-panel.uischema</code> via score-graph display mode.
          </p>
          {loading ? (
            <div className="view-loading">Loading...</div>
          ) : (
            <Card variant="filled">
              <div className="view-card-grid view-card-grid--tiles">
                {concepts.map((concept) => (
                  <div
                    key={concept}
                    style={{
                      padding: 'var(--spacing-sm)',
                      background: 'var(--palette-surface)',
                      border: '1px solid var(--palette-outline-variant)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--typography-code-sm-size)',
                      fontFamily: 'var(--typography-font-family-mono)',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigateToHref(`/content/concept:${concept}`)}
                  >
                    {concept}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'trace' && (
        <div className="view-panel score-panel">
          <div className="view-panel__header">
            <h2 className="view-section-title">Flow Traces</h2>
            <Badge variant="secondary">score-trace-panel</Badge>
          </div>
          <p className="view-page-copy" style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--typography-body-sm-size)' }}>
            Resolved from <code>score-trace-panel.uischema</code> via score-graph display mode.
          </p>
          <EmptyState
            title="No traces captured"
            description="Invoke a concept action to generate a flow trace. Traces show the full causal chain: actions -> syncs -> completions."
          />
        </div>
      )}

      {activeTab === 'schemas' && (
        <div className="view-panel score-panel">
          <div className="view-panel__header">
            <h2 className="view-section-title">Schema Browser</h2>
          </div>
          <p className="view-page-copy" style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--typography-body-sm-size)' }}>
            Browse all Schema definitions — concept-mapped and admin-created.
          </p>
          <EmptyState
            title="Connect Score API"
            description="The Schema browser queries ScoreApi for parsed concept and schema entities. Connect the Score index to browse."
          />
        </div>
      )}
    </div>
  );
};

export default ScoreView;
