'use client';

/**
 * DisplayModesView — Display mode configuration
 * Named presentation profiles selecting layouts and field rendering
 */

import React, { useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';

const createFields = [
  { name: 'mode', label: 'Mode ID', required: true, placeholder: 'e.g. entity-page' },
  { name: 'name', label: 'Display Name', required: true, placeholder: 'e.g. Entity Page' },
];

function countConfig(row: Record<string, unknown>, key: string): number {
  try {
    const val = row[key];
    if (Array.isArray(val)) return val.length;
    if (typeof val === 'object' && val !== null) return Object.keys(val).length;
    if (typeof val === 'string') {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
    }
    if (typeof val === 'number') return val;
  } catch {
    // fall through
  }
  return 0;
}

export const DisplayModesView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('DisplayMode', 'list');
  const { navigateToHref } = useNavigator();

  const rows = data ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Display Modes</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Display Mode
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Display modes are named presentation profiles that select a layout and configure
        per-field rendering for ContentNodes.
      </p>

      {loading ? (
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            title="No display modes defined"
            description="Create a display mode to configure how content is presented."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {rows.map((dm) => {
            const modeId = String(dm.mode ?? dm.id ?? 'unknown');
            const name = String(dm.name ?? modeId);
            const displayCount = countConfig(dm, 'fieldDisplay') || countConfig(dm, 'zones');
            const formCount = countConfig(dm, 'fieldForm') || countConfig(dm, 'formConfig');
            const isDefault = dm.isDefault === true || dm.default === true;

            return (
              <Card
                key={modeId}
                variant="outlined"
                style={{ cursor: 'pointer' }}
                onClick={() => navigateToHref(`/content/${dm.id ?? modeId}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <strong style={{ fontSize: 'var(--typography-heading-sm-size)' }}>{modeId}</strong>
                  {isDefault && <Badge variant="primary">default</Badge>}
                </div>
                <p style={{
                  color: 'var(--palette-on-surface-variant)',
                  fontSize: 'var(--typography-body-sm-size)',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  {name !== modeId ? name : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                  <Badge variant="info">{displayCount} display configs</Badge>
                  <Badge variant="secondary">{formCount} form configs</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
        concept="DisplayMode"
        action="defineMode"
        title="Create Display Mode"
        fields={createFields}
      />
    </div>
  );
};

export default DisplayModesView;
