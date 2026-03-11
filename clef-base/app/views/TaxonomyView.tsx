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
    <div>
      <div className="page-header">
        <h1>Taxonomy</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Vocabulary
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Hierarchical classification using Vocabularies and TaxonomyTerms.
        Terms are ContentNodes with Schema &quot;TaxonomyTerm&quot; applied.
      </p>

      {/* Vocabularies table */}
      <Card variant="outlined" padding="none" style={{ marginBottom: 'var(--spacing-xl)' }}>
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
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
        <div className="section">
          <div className="section__header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
            <h2 className="section__title">
              Terms in <code>{selectedVocab}</code>
            </h2>
            <Badge variant="info">{terms.length} terms</Badge>
            <button
              data-part="button"
              data-variant="outlined"
              style={{ marginLeft: 'auto' }}
              onClick={() => setSelectedVocab(null)}
            >
              Close
            </button>
          </div>

          {terms.length === 0 ? (
            <Card variant="outlined">
              <EmptyState
                title="No terms"
                description={`Vocabulary "${selectedVocab}" has no terms yet.`}
              />
            </Card>
          ) : (
            <Card variant="outlined" padding="none">
              <div style={{ padding: 'var(--spacing-md)' }}>
                {terms.map((term, i) => {
                  const name = String(term.name ?? term.label ?? term.id ?? `Term ${i + 1}`);
                  const depth = typeof term.depth === 'number' ? term.depth : 0;
                  return (
                    <div
                      key={String(term.id ?? i)}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        paddingLeft: `calc(var(--spacing-md) + var(--spacing-lg) * ${depth})`,
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--palette-outline-variant)',
                        fontSize: 'var(--typography-body-md-size)',
                      }}
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
        </div>
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
