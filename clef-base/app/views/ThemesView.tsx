'use client';

/**
 * ThemesView — Theme browser with token previews
 * Generated CSS is produced by ThemeParser -> ThemeGen pipeline
 */

import React, { useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';

const createFields = [
  { name: 'theme', label: 'Theme ID', required: true, placeholder: 'e.g. ocean' },
  { name: 'name', label: 'Display Name', required: true, placeholder: 'e.g. Ocean Theme' },
  { name: 'overrides', label: 'Overrides (JSON)', type: 'textarea' as const, placeholder: '{ "palette-primary": "oklch(0.6 0.15 250)" }' },
];

const palettePreview = [
  { token: '--palette-primary', label: 'Primary' },
  { token: '--palette-secondary', label: 'Secondary' },
  { token: '--palette-tertiary', label: 'Tertiary' },
  { token: '--palette-surface', label: 'Surface' },
  { token: '--palette-background', label: 'Background' },
  { token: '--palette-error', label: 'Error' },
  { token: '--palette-warning', label: 'Warning' },
  { token: '--palette-success', label: 'Success' },
  { token: '--palette-info', label: 'Info' },
];

function countOverrides(row: Record<string, unknown>): number {
  try {
    const overrides = row.overrides;
    if (typeof overrides === 'object' && overrides !== null) return Object.keys(overrides).length;
    if (typeof overrides === 'string') return Object.keys(JSON.parse(overrides)).length;
  } catch {
    // fall through
  }
  return 0;
}

export const ThemesView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('Theme', 'list');
  const { navigateToHref } = useNavigator();

  const rows = data ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Themes</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Theme
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Design system themes generated through the ThemeParser/ThemeGen pipeline from
        <code> .theme</code> spec files. All colors use oklch for perceptual uniformity.
      </p>

      {/* Theme cards */}
      {loading ? (
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            title="No themes registered"
            description="Create a theme to define design system tokens for your application."
          />
        </Card>
      ) : (
        <div className="card-grid" style={{ marginBottom: 'var(--spacing-2xl)' }}>
          {rows.map((theme) => {
            const name = String(theme.name ?? theme.theme ?? theme.id ?? 'untitled');
            const base = theme.extends ?? theme.base ?? null;
            const active = theme.active ?? theme.status === 'active';
            const overrides = countOverrides(theme);
            return (
              <Card
                key={name}
                variant="outlined"
                style={{ cursor: 'pointer' }}
                onClick={() => navigateToHref(`/content/${theme.id ?? name}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <strong style={{ fontSize: 'var(--typography-heading-sm-size)' }}>{name}</strong>
                  {base && <Badge variant="secondary">extends {String(base)}</Badge>}
                  {active ? (
                    <Badge variant="success">active</Badge>
                  ) : (
                    <Badge variant="warning">inactive</Badge>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                  <Badge variant="info">{overrides} overrides</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active palette preview */}
      <div className="section">
        <div className="section__header">
          <h2 className="section__title">Active Palette Preview</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--spacing-sm)' }}>
          {palettePreview.map(({ token, label }) => (
            <div key={token} style={{ textAlign: 'center' }}>
              <div style={{
                width: '100%',
                height: 48,
                borderRadius: 'var(--radius-md)',
                background: `var(${token})`,
                border: '1px solid var(--palette-outline-variant)',
                marginBottom: 'var(--spacing-xs)',
              }} />
              <small style={{ color: 'var(--palette-on-surface-variant)' }}>{label}</small>
            </div>
          ))}
        </div>
      </div>

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
        concept="Theme"
        action="create"
        title="Create Theme"
        fields={createFields}
      />
    </div>
  );
};

export default ThemesView;
