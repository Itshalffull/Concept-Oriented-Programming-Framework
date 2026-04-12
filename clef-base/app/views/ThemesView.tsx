'use client';

/**
 * ThemesView — Theme browser with token previews
 * Generated CSS is produced by ThemeParser -> ThemeGen pipeline
 */

import React, { useMemo, useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { ActionButton } from '../components/widgets/ActionButton';
import { ThemePreviewPanel, getThemePreviewMeta } from '../components/widgets/ThemePreviewPanel';
import { getThemeId, isThemeActive, type ThemeRecord } from '../../lib/theme-selection';

const createFields = [
  { name: 'theme', label: 'Theme ID', required: true, placeholder: 'e.g. ocean' },
  { name: 'name', label: 'Display Name', required: true, placeholder: 'e.g. Ocean Theme' },
  { name: 'overrides', label: 'Overrides (JSON)', type: 'textarea' as const, placeholder: '{ "palette-primary": "oklch(0.6 0.15 250)" }' },
];

export const ThemesView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useConceptQuery<ThemeRecord[]>('Theme', 'list');
  const { navigateToHref } = useNavigator();

  const rows = [...(data ?? [])].sort((left, right) => {
    if (isThemeActive(left) && !isThemeActive(right)) return -1;
    if (!isThemeActive(left) && isThemeActive(right)) return 1;
    return getThemeId(left).localeCompare(getThemeId(right));
  });
  const activeCount = rows.filter((theme) => isThemeActive(theme)).length;
  const activeTheme = rows.find((theme) => isThemeActive(theme)) ?? rows[0] ?? null;
  const themeSummary = useMemo(() => {
    return rows.map((theme) => ({
      id: getThemeId(theme),
      name: String(theme.name ?? getThemeId(theme) ?? 'untitled'),
      active: isThemeActive(theme),
      meta: getThemePreviewMeta(theme),
    }));
  }, [rows]);

  return (
    <div className="themes-view">
      <div className="page-header">
        <h1>Themes</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Theme
        </button>
      </div>

      <section className="themes-view__hero">
        <div>
          <p className="themes-view__lede">
            Design system themes generated through the ThemeParser/ThemeGen pipeline from
            <code> .theme</code> and expressive theme sources. Compare palette, shell tone,
            density, and type hierarchy without leaving this page.
          </p>
          <div className="themes-view__summary">
            <Badge variant="primary">{rows.length} themes</Badge>
            <Badge variant="success">{activeCount} active</Badge>
            {activeTheme ? <Badge variant="info">Current: {String(activeTheme.name ?? getThemeId(activeTheme))}</Badge> : null}
          </div>
        </div>
        <Card variant="outlined" className="themes-view__scorecard">
          <div className="themes-view__scorecard-grid">
            <div>
              <span>Density modes</span>
              <strong>{new Set(themeSummary.map((item) => item.meta.density ?? 'default')).size}</strong>
            </div>
            <div>
              <span>Motifs</span>
              <strong>{new Set(themeSummary.map((item) => item.meta.motif ?? 'default')).size}</strong>
            </div>
            <div>
              <span>Profiles</span>
              <strong>{new Set(themeSummary.map((item) => item.meta.styleProfile ?? 'standard')).size}</strong>
            </div>
          </div>
        </Card>
      </section>

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
        <div className="themes-view__grid">
          {rows.map((theme) => {
            const themeId = getThemeId(theme);
            const name = String(theme.name ?? themeId ?? 'untitled');
            const active = isThemeActive(theme);
            return (
              <ThemePreviewPanel
                key={themeId || name}
                theme={theme}
                onOpenDetails={() => navigateToHref(`/content/${themeId || name}`)}
                onActivateToggle={() => (
                  <ActionButton
                    binding={active ? 'theme-deactivate' : 'theme-activate'}
                    context={{ id: themeId }}
                    label={active ? 'Deactivate' : 'Activate'}
                    buttonVariant={active ? 'ghost' : 'primary'}
                    disabled={active && activeCount <= 1}
                    onSuccess={() => refetch()}
                  />
                )}
              />
            );
          })}
        </div>
      )}

      <div className="section">
        <div className="section__header">
          <h2 className="section__title">Theme QA Checklist</h2>
        </div>
        <Card variant="outlined" className="themes-view__checklist">
          <div className="themes-view__checklist-grid">
            <div>
              <strong>Shell</strong>
              <p>Check whether motif and density change the navigation rhythm meaningfully.</p>
            </div>
            <div>
              <strong>Typography</strong>
              <p>Look for hierarchy, tone, and readability differences, not just font swaps.</p>
            </div>
            <div>
              <strong>Components</strong>
              <p>Ensure cards, badges, controls, and surfaces still feel like the same product.</p>
            </div>
            <div>
              <strong>Contrast</strong>
              <p>Verify emphasis stays legible across primary, status, and surface treatments.</p>
            </div>
          </div>
        </Card>
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
