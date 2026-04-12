'use client';

/**
 * DisplayModesView — Display mode detail/edit view.
 * When given a modeKey, shows the strategy editor for that display mode.
 * The list view is handled by ViewRenderer with the display-modes-list View seed.
 */

import React, { useState, useCallback } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';

type StrategyTab = 'component' | 'layout' | 'flat';

interface DisplayModesViewProps {
  modeKey: string;
}

export const DisplayModesView: React.FC<DisplayModesViewProps> = ({ modeKey }) => {
  const { navigateToHref } = useNavigator();
  const invoke = useKernelInvoke();
  const { data: dm, loading, refetch } = useConceptQuery<Record<string, unknown>>(
    'DisplayMode', 'get', { mode: modeKey },
  );

  // Determine active tab from current strategy
  const initialTab: StrategyTab = dm?.component_mapping ? 'component' : dm?.layout ? 'layout' : 'flat';
  const [tab, setTab] = useState<StrategyTab>(initialTab);
  const [mappingId, setMappingId] = useState('');
  const [layoutId, setLayoutId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Parse existing placements
  let existingPlacements: string[] = [];
  try {
    const parsed = JSON.parse(String(dm?.placements ?? '[]'));
    if (Array.isArray(parsed)) existingPlacements = parsed.map(String);
  } catch { /* empty */ }
  const [placements, setPlacements] = useState<string[]>(existingPlacements);
  const [newPlacement, setNewPlacement] = useState('');

  // Sync initial state when data loads
  React.useEffect(() => {
    if (dm) {
      if (dm.component_mapping) setTab('component');
      else if (dm.layout) setTab('layout');
      else setTab('flat');
      setMappingId(String(dm.component_mapping ?? ''));
      setLayoutId(String(dm.layout ?? ''));
      try {
        const parsed = JSON.parse(String(dm.placements ?? '[]'));
        if (Array.isArray(parsed)) setPlacements(parsed.map(String));
      } catch { /* empty */ }
    }
  }, [dm?.component_mapping, dm?.layout, dm?.placements]);

  const handleSetComponentMapping = useCallback(async () => {
    if (!mappingId.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke('DisplayMode', 'set_component_mapping', { mode: modeKey, mapping: mappingId.trim() });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setSaveError((result.message as string | undefined) ?? 'Failed to set component mapping.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to set component mapping.');
    } finally { setSaving(false); }
  }, [invoke, modeKey, mappingId, refetch]);

  const handleSetLayout = useCallback(async () => {
    if (!layoutId.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke('DisplayMode', 'set_layout', { mode: modeKey, layout: layoutId.trim() });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setSaveError((result.message as string | undefined) ?? 'Failed to set layout.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to set layout.');
    } finally { setSaving(false); }
  }, [invoke, modeKey, layoutId, refetch]);

  const handleAddPlacement = useCallback(() => {
    if (!newPlacement.trim()) return;
    setPlacements(prev => [...prev, newPlacement.trim()]);
    setNewPlacement('');
  }, [newPlacement]);

  const handleRemovePlacement = useCallback((idx: number) => {
    setPlacements(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSaveFlatFields = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke('DisplayMode', 'set_flat_fields', { mode: modeKey, placements: JSON.stringify(placements) });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setSaveError((result.message as string | undefined) ?? 'Failed to save flat fields.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save flat fields.');
    } finally { setSaving(false); }
  }, [invoke, modeKey, placements, refetch]);

  const handleClear = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (dm?.component_mapping) {
        await invoke('DisplayMode', 'clear_component_mapping', { mode: modeKey });
      }
      if (dm?.layout) {
        await invoke('DisplayMode', 'clear_layout', { mode: modeKey });
      }
      const result = await invoke('DisplayMode', 'set_flat_fields', { mode: modeKey, placements: '[]' });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setSaveError((result.message as string | undefined) ?? 'Failed to clear strategy.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to clear strategy.');
    } finally { setSaving(false); }
  }, [invoke, modeKey, dm?.component_mapping, dm?.layout, refetch]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    fontSize: '12px',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${active ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
    background: active ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
    color: active ? 'var(--palette-on-primary-container, var(--palette-on-surface))' : 'var(--palette-on-surface-variant)',
    cursor: 'pointer',
    fontFamily: 'var(--typography-font-family-mono)',
  });

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid var(--palette-outline-variant)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--palette-surface)',
    color: 'var(--palette-on-surface)',
    flex: 1,
    fontFamily: 'var(--typography-font-family-mono)',
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: '12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--palette-outline-variant)',
    background: 'var(--palette-primary-container)',
    color: 'var(--palette-on-primary-container, var(--palette-on-surface))',
    cursor: 'pointer',
  };

  if (loading) {
    return <div className="view-shell"><div className="view-loading">Loading...</div></div>;
  }

  if (!dm || dm.variant === 'notfound') {
    return (
      <div className="view-shell">
        <Card variant="outlined" className="view-panel">
          <p>Display mode &quot;{modeKey}&quot; not found.</p>
          <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/display-modes')}>
            Back to Display Modes
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-shell">
      {/* Breadcrumb */}
      <div className="view-breadcrumb">
        <span
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToHref('/display-modes')}
        >
          Display Modes
        </span>
        <span>&rarr;</span>
        <strong>{modeKey}</strong>
      </div>

      {/* Mode metadata */}
      <Card variant="outlined" className="view-panel">
        <div className="view-section-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--typography-title-lg-size)', color: 'var(--palette-on-surface)' }}>
              {String(dm.name ?? modeKey)}
            </h2>
            <div className="view-chip-row" style={{ marginTop: 4 }}>
              <Badge variant="info">{String(dm.schema)}</Badge>
              <Badge variant="secondary">{String(dm.mode_id)}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Save error */}
      {saveError && (
        <div className="view-status-banner" style={{
          marginTop: 'var(--spacing-sm)',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
        }}>
          <span>{saveError}</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1 }} onClick={() => setSaveError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Strategy editor */}
      <section className="view-section">
        <h3 className="view-section-title" style={{ fontSize: 'var(--typography-title-md-size)' }}>
          Rendering Strategy
        </h3>

        {/* Strategy tabs */}
        <div className="view-tabs">
          <button style={tabStyle(tab === 'component')} onClick={() => setTab('component')}>
            Component Mapping
          </button>
          <button style={tabStyle(tab === 'layout')} onClick={() => setTab('layout')}>
            Layout
          </button>
          <button style={tabStyle(tab === 'flat')} onClick={() => setTab('flat')}>
            Flat Fields
          </button>
        </div>

        {/* Component Mapping tab */}
        {tab === 'component' && (
          <Card variant="outlined" className="view-panel">
            <p className="view-page-copy" style={{ fontSize: '12px', marginBottom: 'var(--spacing-sm)' }}>
              Full widget takeover. One ComponentMapping renders the entire entity.
            </p>
            <div className="view-toolbar">
              <input
                style={inputStyle}
                placeholder="Mapping ID (e.g. card-default)"
                value={mappingId}
                onChange={(e) => setMappingId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetComponentMapping()}
              />
              <button style={btnStyle} disabled={saving || !mappingId.trim()} onClick={handleSetComponentMapping}>
                {saving ? '...' : 'Set Mapping'}
              </button>
            </div>
            {dm.component_mapping && (
              <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '12px' }}>
                Current: <Badge variant="primary">{String(dm.component_mapping)}</Badge>
                <span
                  style={{ marginLeft: 8, cursor: 'pointer', textDecoration: 'underline', color: 'var(--palette-primary)' }}
                  onClick={() => navigateToHref(`/mappings/${dm.component_mapping}`)}
                >
                  Edit mapping
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Layout tab */}
        {tab === 'layout' && (
          <Card variant="outlined" className="view-panel">
            <p className="view-page-copy" style={{ fontSize: '12px', marginBottom: 'var(--spacing-sm)' }}>
              Spatial composition. A Layout arranges FieldPlacements and ComponentMappings in areas.
            </p>
            <div className="view-toolbar">
              <input
                style={inputStyle}
                placeholder="Layout ID"
                value={layoutId}
                onChange={(e) => setLayoutId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetLayout()}
              />
              <button style={btnStyle} disabled={saving || !layoutId.trim()} onClick={handleSetLayout}>
                {saving ? '...' : 'Set Layout'}
              </button>
            </div>
            {dm.layout && (
              <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '12px' }}>
                Current: <Badge variant="info">{String(dm.layout)}</Badge>
              </div>
            )}
          </Card>
        )}

        {/* Flat Fields tab */}
        {tab === 'flat' && (
          <Card variant="outlined" className="view-panel">
            <p className="view-page-copy" style={{ fontSize: '12px', marginBottom: 'var(--spacing-sm)' }}>
              Ordered list of FieldPlacement IDs. Simple vertical stack of field renderings.
            </p>
            {placements.length > 0 && (
              <div className="view-chip-row" style={{ marginBottom: 'var(--spacing-sm)' }}>
                {placements.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', fontSize: '12px',
                      background: 'var(--palette-surface-variant)',
                      border: '1px solid var(--palette-outline-variant)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--typography-font-family-mono)',
                    }}
                  >
                    {p}
                    <span
                      style={{ cursor: 'pointer', color: 'var(--palette-error, red)', fontWeight: 'bold' }}
                      onClick={() => handleRemovePlacement(i)}
                    >
                      x
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="view-toolbar">
              <input
                style={inputStyle}
                placeholder="Placement ID (e.g. fp-node-heading)"
                value={newPlacement}
                onChange={(e) => setNewPlacement(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPlacement()}
              />
              <button style={btnStyle} disabled={!newPlacement.trim()} onClick={handleAddPlacement}>
                Add
              </button>
              <button style={btnStyle} disabled={saving} onClick={handleSaveFlatFields}>
                {saving ? '...' : 'Save'}
              </button>
            </div>
          </Card>
        )}

        {/* Clear strategy */}
        <div className="view-toolbar view-toolbar--end">
          <button
            style={{
              padding: '6px 14px', fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--palette-error, red)',
              background: 'var(--palette-surface)',
              color: 'var(--palette-error, red)',
              cursor: 'pointer',
            }}
            disabled={saving}
            onClick={handleClear}
          >
            {saving ? '...' : 'Clear Strategy'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default DisplayModesView;
