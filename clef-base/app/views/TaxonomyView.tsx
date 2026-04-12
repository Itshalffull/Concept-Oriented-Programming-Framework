'use client';

/**
 * TaxonomyView — Taxonomy term browser
 * Two sections: Vocabularies list (DataTable) + term tree for selected vocabulary
 */

import React, { useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';

const createFields = [
  { name: 'vocab', label: 'Vocabulary ID', required: true, placeholder: 'e.g. tags' },
  { name: 'name', label: 'Display Name', required: true, placeholder: 'e.g. Tags' },
];

function parseTermCount(row: Record<string, unknown>): number {
  try {
    const terms = row.terms;
    if (Array.isArray(terms)) return terms.length;
    if (typeof terms === 'string') return JSON.parse(terms).length;
    if (typeof terms === 'number') return terms;
  } catch {
    // fall through
  }
  return 0;
}

const columns: ColumnDef[] = [
  { key: 'vocab', label: 'Vocabulary', render: (val) => <code>{String(val)}</code> },
  { key: 'name', label: 'Name' },
  {
    key: 'terms',
    label: 'Terms',
    render: (_val, row) => {
      const count = parseTermCount(row);
      return <Badge variant="info">{count} terms</Badge>;
    },
  },
];

export const TaxonomyView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVocab, setSelectedVocab] = useState<string | null>(null);
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('Taxonomy', 'list');
  const { navigateToHref } = useNavigator();

  const rows = data ?? [];

  const selectedRow = selectedVocab
    ? rows.find((r) => r.vocab === selectedVocab || r.id === selectedVocab)
    : null;

  let terms: Record<string, unknown>[] = [];
  if (selectedRow) {
    try {
      const raw = selectedRow.terms;
      if (Array.isArray(raw)) {
        terms = raw as Record<string, unknown>[];
      } else if (typeof raw === 'string') {
        terms = JSON.parse(raw);
      }
    } catch {
      terms = [];
    }
  }

  return (
    <div className="view-shell">
      <div className="view-page-header">
        <h1>Taxonomy</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Vocabulary
        </button>
      </div>

      <p className="view-page-copy">
        Hierarchical classification using Vocabularies and TaxonomyTerms.
        Terms are ContentNodes with Schema &quot;TaxonomyTerm&quot; applied.
      </p>

      {/* Vocabularies table */}
      <Card variant="outlined" padding="none" className="view-panel">
        {loading ? (
          <div className="view-loading">Loading...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No vocabularies defined"
            description="Create a vocabulary to organize content with hierarchical taxonomy terms."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            sortable
            ariaLabel="Taxonomy vocabularies"
            onRowClick={(row) => {
              const vocab = String(row.vocab ?? row.id ?? '');
              setSelectedVocab(vocab);
            }}
          />
        )}
      </Card>

      {/* Selected vocabulary term tree */}
      {selectedVocab && (
        <section className="view-section">
          <div className="view-section-header">
            <h2 className="view-section-title">
              Terms in <code>{selectedVocab}</code>
            </h2>
            <div className="view-toolbar">
              <Badge variant="info">{terms.length} terms</Badge>
              <button
                data-part="button"
                data-variant="outlined"
                onClick={() => setSelectedVocab(null)}
              >
                Close
              </button>
            </div>
          </div>

          {terms.length === 0 ? (
            <Card variant="outlined" className="view-panel view-panel--flush">
              <EmptyState
                title="No terms"
                description={`Vocabulary "${selectedVocab}" has no terms yet.`}
              />
            </Card>
          ) : (
            <Card variant="outlined" padding="none" className="view-panel view-panel--flush">
              <div className="view-tree-list">
                {terms.map((term, i) => {
                  const name = String(term.name ?? term.label ?? term.id ?? `Term ${i + 1}`);
                  const depth = typeof term.depth === 'number' ? term.depth : 0;
                  return (
                    <div
                      key={String(term.id ?? i)}
                      className="view-tree-item"
                      style={{ paddingLeft: `calc(var(--spacing-md) + var(--spacing-lg) * ${depth})` }}
                      onClick={() => navigateToHref(`/content/${term.id ?? term.name}`)}
                    >
                      {depth > 0 && (
                        <span style={{ color: 'var(--palette-on-surface-variant)', marginRight: 'var(--spacing-xs)' }}>
                          {'  '.repeat(depth)}
                        </span>
                      )}
                      {name}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </section>
      )}

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
        concept="Taxonomy"
        action="createVocabulary"
        title="Create Vocabulary"
        fields={createFields}
      />
    </div>
  );
};

export default TaxonomyView;
