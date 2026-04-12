'use client';

import React from 'react';
import { Badge } from './Badge';
import { Card } from './Card';
import { getThemeId, isThemeActive, type ThemeRecord } from '../../../lib/theme-selection';

const paletteTokens = [
  { token: '--palette-primary', label: 'Primary' },
  { token: '--palette-secondary', label: 'Secondary' },
  { token: '--palette-surface', label: 'Surface' },
  { token: '--palette-background', label: 'Background' },
  { token: '--palette-success', label: 'Success' },
  { token: '--palette-error', label: 'Error' },
];

export interface ThemePreviewMeta {
  mode: string | null;
  density: string | null;
  motif: string | null;
  styleProfile: string | null;
  sourceType: string | null;
  overrideCount: number;
}

function parseOverrides(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function getThemePreviewMeta(theme: ThemeRecord): ThemePreviewMeta {
  const overrides = parseOverrides(theme.overrides);
  return {
    mode: readString(overrides.mode),
    density: readString(overrides.density),
    motif: readString(overrides.motif),
    styleProfile: readString(overrides.styleProfile),
    sourceType: readString(overrides.sourceType),
    overrideCount: Object.keys(overrides).length,
  };
}

export interface ThemePreviewPanelProps {
  theme: ThemeRecord;
  onOpenDetails: () => void;
  onActivateToggle: () => React.ReactNode;
}

export const ThemePreviewPanel: React.FC<ThemePreviewPanelProps> = ({
  theme,
  onOpenDetails,
  onActivateToggle,
}) => {
  const themeId = getThemeId(theme);
  const name = String(theme.name ?? themeId ?? 'untitled');
  const base = theme.extends ?? theme.base ?? null;
  const active = isThemeActive(theme);
  const meta = getThemePreviewMeta(theme);

  return (
    <article
      className="theme-preview-panel"
      data-theme={themeId || undefined}
      data-theme-preview-active={active ? 'true' : 'false'}
    >
      <div className="theme-preview-panel__hero">
        <div className="theme-preview-panel__hero-copy">
          <div className="theme-preview-panel__eyebrow">Theme QA Surface</div>
          <h3>{name}</h3>
          <p>
            Compare shell tone, component treatment, density, and typography without
            leaving the themes page.
          </p>
        </div>
        <div className="theme-preview-panel__hero-badges">
          {active ? <Badge variant="success">active</Badge> : <Badge variant="secondary">inactive</Badge>}
          {base ? <Badge variant="info">extends {String(base)}</Badge> : null}
          <Badge variant="warning">{meta.overrideCount} overrides</Badge>
        </div>
      </div>

      <div className="theme-preview-panel__meta">
        <div>
          <span>Mode</span>
          <strong>{meta.mode ?? 'inherit'}</strong>
        </div>
        <div>
          <span>Density</span>
          <strong>{meta.density ?? 'default'}</strong>
        </div>
        <div>
          <span>Motif</span>
          <strong>{meta.motif ?? 'default'}</strong>
        </div>
        <div>
          <span>Profile</span>
          <strong>{meta.styleProfile ?? 'standard'}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{meta.sourceType ?? 'seeded'}</strong>
        </div>
      </div>

      <div className="theme-preview-panel__shell">
        <div className="theme-preview-panel__shell-nav">
          <span className="theme-preview-panel__brand">Clef Base</span>
          <span className="theme-preview-panel__nav-chip">Overview</span>
          <span className="theme-preview-panel__nav-chip">Themes</span>
          <span className="theme-preview-panel__nav-chip">Content</span>
        </div>
        <div className="theme-preview-panel__shell-bar">
          <span>Draft workspace</span>
          <span>{meta.motif ?? 'adaptive shell'}</span>
        </div>
      </div>

      <div className="theme-preview-panel__palette">
        {paletteTokens.map(({ token, label }) => (
          <div key={token} className="theme-preview-panel__swatch">
            <div className="theme-preview-panel__swatch-color" style={{ background: `var(${token})` }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="theme-preview-panel__samples">
        <Card
          variant="elevated"
          title="Primary surface"
          description="Body copy, card chrome, and elevated treatment."
          className="theme-preview-panel__card"
        >
          <div className="theme-preview-panel__card-copy">
            <p>Publishing-quality shell chrome should still feel operationally clear.</p>
            <div className="theme-preview-panel__badge-row">
              <Badge variant="primary">Primary</Badge>
              <Badge variant="success">Healthy</Badge>
              <Badge variant="warning">Review</Badge>
            </div>
          </div>
        </Card>

        <Card
          variant="outlined"
          title="Density sample"
          description="List rhythm and control scale preview."
          className="theme-preview-panel__card"
        >
          <div className="theme-preview-panel__table">
            <div><span>Records</span><strong>18</strong></div>
            <div><span>Schema</span><strong>Stable</strong></div>
            <div><span>Theme</span><strong>{meta.density ?? 'default'}</strong></div>
          </div>
          <div className="theme-preview-panel__actions">
            <button data-part="button" data-variant="filled" type="button">Activate</button>
            <button data-part="button" data-variant="ghost" type="button">Inspect</button>
          </div>
          <label className="theme-preview-panel__field">
            <span>Preview input</span>
            <input type="text" value={name} readOnly />
          </label>
        </Card>
      </div>

      <div className="theme-preview-panel__type">
        <div>
          <span className="theme-preview-panel__type-label">Display</span>
          <div className="theme-preview-panel__type-display">Theme personality</div>
        </div>
        <div>
          <span className="theme-preview-panel__type-label">Body</span>
          <p>
            The strongest themes change more than hue. They alter spacing, hierarchy,
            and the emotional posture of shared surfaces.
          </p>
        </div>
      </div>

      <div className="theme-preview-panel__footer">
        <div className="theme-preview-panel__footer-actions">
          {onActivateToggle()}
          <button data-part="button" data-variant="ghost" onClick={onOpenDetails} type="button">
            Details
          </button>
        </div>
      </div>
    </article>
  );
};

export default ThemePreviewPanel;
