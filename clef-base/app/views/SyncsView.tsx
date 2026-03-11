'use client';

/**
 * SyncsView — Browse sync rules across installed suites
 * Syncs are compile-time entities; data is hardcoded.
 * Fetches /api/health for registered concept count.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';

const syncs = [
  // entity-lifecycle
  { name: 'save-invalidates-cache', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/save -> Cache/invalidateByTags' },
  { name: 'save-indexes-search', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/save -> Queue/enqueue' },
  { name: 'save-generates-alias', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/save -> Pathauto/generateAlias' },
  { name: 'save-tracks-provenance', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/save -> Provenance/record' },
  { name: 'save-reindexes-backlinks', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/save -> Backlink/reindex' },
  { name: 'delete-cascades', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/delete -> Comment,Reference,FileManagement,Backlink,...' },
  { name: 'date-fields-reference-daily-notes', suite: 'entity-lifecycle', tier: 'recommended', pattern: 'ContentStorage/save -> DailyNote/getOrCreateForDate' },
  // component-mapping
  { name: 'slot-source-dispatches-to-provider', suite: 'component-mapping', tier: 'required', pattern: 'SlotSource/resolve -> [provider]/resolve' },
  { name: 'resolver-uses-component-mapping', suite: 'component-mapping', tier: 'required', pattern: 'WidgetResolver/resolve -> ComponentMapping/lookup' },
  // surface-integration
  { name: 'entity-page-uses-triple-zone', suite: 'surface-integration', tier: 'required', pattern: 'Renderer/render -> TripleZoneLayout' },
  { name: 'block-zone-renders-via-canvas', suite: 'surface-integration', tier: 'required', pattern: 'TripleZoneLayout/renderZone -> Canvas/render' },
  { name: 'related-zone-populates-via-embedding', suite: 'surface-integration', tier: 'required', pattern: 'TripleZoneLayout/renderZone -> SemanticEmbedding/search' },
  { name: 'version-context-populates-shell-chrome', suite: 'surface-integration', tier: 'required', pattern: 'VersionContext -> AppShell/chrome' },
  // version-space-integration
  { name: 'version-aware-load', suite: 'version-space-integration', tier: 'required', pattern: 'ContentStorage/load -> VersionSpace/resolve' },
  { name: 'version-aware-save', suite: 'version-space-integration', tier: 'required', pattern: 'ContentStorage/save -> VersionSpace/write' },
  // concept-browser
  { name: 'concept-browser-install-resolves-deps', suite: 'concept-browser', tier: 'required', pattern: 'ConceptBrowser/install -> DependencyResolver/resolve' },
  { name: 'concept-browser-install-validates', suite: 'concept-browser', tier: 'required', pattern: 'ConceptBrowser/install -> Validator/validate' },
  { name: 'concept-browser-install-downloads', suite: 'concept-browser', tier: 'required', pattern: 'ConceptBrowser/install -> Registry/download' },
];

const columns: ColumnDef[] = [
  { key: 'name', label: 'Sync Name', render: (val) => <code>{String(val)}</code> },
  { key: 'suite', label: 'Suite', render: (val) => <Badge variant="info">{String(val)}</Badge> },
  { key: 'tier', label: 'Tier', render: (val) => <Badge variant={val === 'required' ? 'primary' : 'secondary'}>{String(val)}</Badge> },
  { key: 'pattern', label: 'Pattern', render: (val) => <span style={{ fontSize: 'var(--typography-code-sm-size)', fontFamily: 'var(--typography-font-family-mono)' }}>{String(val)}</span> },
];

export const SyncsView: React.FC = () => {
  const [conceptCount, setConceptCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        const concepts = data.registeredConcepts ?? data.concepts ?? [];
        setConceptCount(concepts.length);
      } catch {
        setConceptCount(null);
      }
    }
    fetchHealth();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Syncs</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Badge variant="info">{syncs.length} rules</Badge>
          {conceptCount !== null && (
            <Badge variant="secondary">{conceptCount} registered concepts</Badge>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Sync rules wire concepts together through pattern matching on completions.
        Each sync has a when (trigger), optional where (conditions), and then (effects) clause.
      </p>

      <Card variant="outlined" padding="none">
        <DataTable columns={columns} data={syncs} sortable ariaLabel="Sync rules" />
      </Card>
    </div>
  );
};

export default SyncsView;
