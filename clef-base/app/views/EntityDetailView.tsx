'use client';

/**
 * EntityDetailView — Triple-zone entity page composed of Views via LayoutRenderer.
 *
 * Per spec §2.1, §3.1: A ContentNode's identity is its Schema membership set.
 * The entity header shows applied Schemas as badges. Schema management (apply/remove)
 * is available inline.
 *
 * Flow:
 * 1. Load the entity via ContentNode/get to establish context
 * 2. Load Schema memberships via Schema/getSchemasFor
 * 3. Render LayoutRenderer for "entity-detail" layout with context
 * 4. Child Views use {{entityId}}/{{entityPrimarySchema}} templates
 */

import React, { useState, useCallback } from 'react';
import { Badge } from '../components/widgets/Badge';
import { Card } from '../components/widgets/Card';
import { EmptyState } from '../components/widgets/EmptyState';
import { LayoutRenderer } from '../components/LayoutRenderer';
import { DisplayAsPicker } from '../components/widgets/DisplayAsPicker';
import { ActionButton } from '../components/widgets/ActionButton';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { useVersionPins, VersionPinInfo } from '../../lib/use-version-pins';

interface EntityDetailViewProps {
  id: string;
}

const SCHEMA_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'error'> = {
  Concept: 'primary',
  Schema: 'info',
  Sync: 'warning',
  Widget: 'info',
  Workflow: 'secondary',
  AutomationRule: 'secondary',
  Taxonomy: 'success',
  Theme: 'warning',
  DisplayMode: 'info',
  VersionSpace: 'primary',
  VersionOverride: 'secondary',
  Article: 'success',
  Page: 'success',
  Media: 'warning',
};

export const EntityDetailView: React.FC<EntityDetailViewProps> = ({ id }) => {
  const { data, loading, error, refetch: refetchNode } = useConceptQuery<Record<string, unknown>>('ContentNode', 'get', { node: id });
  const { data: schemasResult, refetch: refetchSchemas } = useConceptQuery<{ schemas: string }>('Schema', 'getSchemasFor', { entity_id: id });
  const { data: allSchemaDefs } = useConceptQuery<Record<string, unknown>[]>('Schema', 'list');
  const { navigateToHref } = useNavigator();
  const [displayMode, setDisplayMode] = useState('entity-page');
  const [showVersionPins, setShowVersionPins] = useState(false);
  const versionPins = useVersionPins(id);

  const handleDisplayModeChange = useCallback((modeId: string) => {
    setDisplayMode(modeId);
  }, []);

  const [showSchemaManager, setShowSchemaManager] = useState(false);

  // Parse schemas from the response
  const schemas: string[] = schemasResult?.schemas
    ? (typeof schemasResult.schemas === 'string' ? JSON.parse(schemasResult.schemas) : schemasResult.schemas)
    : [];

  // Available schemas for the apply dropdown
  const availableSchemas = (allSchemaDefs ?? [])
    .map((s) => s.schema as string)
    .filter((s) => !schemas.includes(s));
  const parsedContent = (() => {
    if (typeof data?.content !== 'string') return null;
    try {
      return JSON.parse(data.content) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  const registryConcept = schemas.includes('Concept') ? String(parsedContent?.name ?? '') : '';
  const registrySuite = schemas.includes('Suite') ? String(parsedContent?.suite ?? parsedContent?.name ?? '') : '';
  const { data: widgetRegistryResult } = useConceptQuery<Record<string, unknown>>(
    registryConcept || registrySuite ? 'WidgetRegistry' : '__none__',
    'query',
    {
      concept: registryConcept || null,
      suite: registrySuite || null,
      interactor: null,
    },
  );
  const recommendedWidgets = typeof widgetRegistryResult?.entries === 'string'
    ? JSON.parse(widgetRegistryResult.entries as string) as Array<Record<string, unknown>>
    : [];

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Loading...</h1>
        </div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading entity...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <div className="page-header">
          <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/content')}>
            Back
          </button>
          <h1>Not Found</h1>
        </div>
        <Card variant="outlined">
          <EmptyState title={`Entity "${id}" not found`} description={error ?? 'This entity does not exist in the kernel.'} />
        </Card>
      </div>
    );
  }

  const primarySchema = schemas[0] ?? 'default';
  const displayName = String(data.node ?? id).replace(/^(concept|schema|sync|suite|theme|view|widget|display-mode|workflow|automation-rule|taxonomy):/, '');

  // Context for template variable resolution in child Views
  const context = {
    entityId: String(data.node ?? id),
    entityPrimarySchema: primarySchema,
  };

  return (
    <div>
      {/* Entity header with navigation and schema badges */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/content')}>
            Back
          </button>
          <h1 style={{ margin: 0 }}>{displayName}</h1>
          {schemas.map((s) => (
            <Badge key={s} variant={SCHEMA_COLORS[s] ?? 'secondary'}>
              {s}
            </Badge>
          ))}
          {schemas.length === 0 && (
            <Badge variant="secondary">no schemas</Badge>
          )}
          <DisplayAsPicker
            currentSchema={primarySchema}
            currentMode={displayMode}
            onChange={handleDisplayModeChange}
            variant="inline"
          />
          <button
            data-part="button"
            data-variant="outlined"
            onClick={() => setShowSchemaManager(!showSchemaManager)}
            style={{ fontSize: '12px', padding: '2px 8px' }}
          >
            {showSchemaManager ? 'Hide' : 'Manage Schemas'}
          </button>
        </div>
      </div>

      {/* Schema manager — apply/remove schemas */}
      {showSchemaManager && (
        <Card variant="outlined" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '14px' }}>Applied Schemas</h3>
          {schemas.length === 0 ? (
            <p style={{ color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm) 0' }}>
              No schemas applied. Apply a schema to give this ContentNode structure and behavior.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              {schemas.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Badge variant={SCHEMA_COLORS[s] ?? 'secondary'}>{s}</Badge>
                  <ActionButton
                    binding="schema-remove"
                    context={{ entity_id: id, schema: s }}
                    label="remove"
                    buttonVariant="ghost"
                    onSuccess={() => refetchSchemas()}
                  />
                </div>
              ))}
            </div>
          )}

          {availableSchemas.length > 0 && (
            <>
              <h3 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '14px' }}>Apply Schema</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                {availableSchemas.map((s) => (
                  <ActionButton
                    key={s}
                    binding="schema-apply"
                    context={{ entity_id: id, schema: s }}
                    label={`+ ${s}`}
                    buttonVariant="secondary"
                    onSuccess={() => refetchSchemas()}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {recommendedWidgets.length > 0 && (
        <Card variant="outlined" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '14px' }}>Recommended Widgets</h3>
              <p style={{ color: 'var(--palette-on-surface-variant)' }}>
                Registered via the entity widget pipeline for this {registryConcept ? 'concept' : 'suite'}.
              </p>
            </div>
            <Badge variant="secondary">{recommendedWidgets.length}</Badge>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
            {recommendedWidgets.map((entry) => (
              <div
                key={String(entry.entry)}
                style={{
                  border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--palette-surface-variant)',
                  minWidth: '220px',
                }}
              >
                <strong>{String(entry.widget)}</strong>
                <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
                  {String(entry.interactor)}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  <Badge variant="info">spec {String(entry.specificity ?? '')}</Badge>
                  {entry.suite ? <Badge variant="secondary">{String(entry.suite)}</Badge> : null}
                  {entry.concept ? <Badge variant="secondary">{String(entry.concept)}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Version Pins — collapsible sidebar section */}
      {(versionPins.outdatedCount > 0 || versionPins.orphanedCount > 0) && (
        <Card variant="outlined" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowVersionPins(!showVersionPins)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Version Pins</h3>
              <Badge variant="warning">
                {versionPins.outdatedCount > 0 ? `${versionPins.outdatedCount} outdated` : ''}
                {versionPins.outdatedCount > 0 && versionPins.orphanedCount > 0 ? ', ' : ''}
                {versionPins.orphanedCount > 0 ? `${versionPins.orphanedCount} orphaned` : ''}
              </Badge>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>
              {showVersionPins ? 'Collapse' : 'Expand'}
            </span>
          </div>

          {showVersionPins && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              {/* Batch update button */}
              {versionPins.outdatedCount > 0 && (
                <button
                  data-part="button"
                  data-variant="filled"
                  onClick={async () => { await versionPins.reanchorAll(); }}
                  style={{ fontSize: '12px', padding: '4px 12px', marginBottom: 'var(--spacing-md)' }}
                >
                  Update All ({versionPins.outdatedCount})
                </button>
              )}

              {versionPins.error && (
                <p style={{ color: 'var(--palette-error)', fontSize: '12px', margin: '0 0 var(--spacing-sm) 0' }}>
                  {versionPins.error}
                </p>
              )}

              {/* Pin items grouped by freshness */}
              <VersionPinGroup
                label="Outdated"
                pins={versionPins.pins.filter(p => p.freshness === 'outdated')}
                onReanchor={versionPins.reanchor}
                onGetOriginal={versionPins.getOriginal}
              />
              <VersionPinGroup
                label="Orphaned"
                pins={versionPins.pins.filter(p => p.freshness === 'orphaned')}
                onReanchor={versionPins.reanchor}
                onGetOriginal={versionPins.getOriginal}
              />
            </div>
          )}
        </Card>
      )}

      {/* Triple-zone layout — composed of Views via LayoutRenderer */}
      <LayoutRenderer layoutId="entity-detail" context={context} />
    </div>
  );
};

// ─── Version Pin Helper Components ───────────────────────────────────────────

const OWNER_KIND_ICONS: Record<string, string> = {
  sync: 'S',
  widget: 'W',
  handler: 'H',
  theme: 'T',
  derived: 'D',
};

const FRESHNESS_BADGE_VARIANT: Record<string, 'warning' | 'error' | 'success'> = {
  outdated: 'warning',
  orphaned: 'error',
  current: 'success',
};

interface VersionPinGroupProps {
  label: string;
  pins: VersionPinInfo[];
  onReanchor: (pinId: string) => Promise<void>;
  onGetOriginal: (pinId: string) => Promise<string>;
}

const VersionPinGroup: React.FC<VersionPinGroupProps> = ({ label, pins, onReanchor, onGetOriginal }) => {
  if (pins.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--spacing-md)' }}>
      <h4 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '12px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} ({pins.length})
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {pins.map((pin) => (
          <VersionPinItem key={pin.pin} pin={pin} onReanchor={onReanchor} onGetOriginal={onGetOriginal} />
        ))}
      </div>
    </div>
  );
};

interface VersionPinItemProps {
  pin: VersionPinInfo;
  onReanchor: (pinId: string) => Promise<void>;
  onGetOriginal: (pinId: string) => Promise<string>;
}

const VersionPinItem: React.FC<VersionPinItemProps> = ({ pin, onReanchor, onGetOriginal }) => {
  const kindIcon = OWNER_KIND_ICONS[pin.ownerKind] ?? pin.ownerKind.charAt(0).toUpperCase();
  const badgeVariant = FRESHNESS_BADGE_VARIANT[pin.freshness] ?? 'secondary';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: '4px 8px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--palette-surface-variant)',
        fontSize: '12px',
      }}
    >
      {/* Owner kind icon */}
      <span
        style={{
          width: '20px',
          height: '20px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--palette-primary)',
          color: 'var(--palette-on-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 600,
          flexShrink: 0,
        }}
        title={pin.ownerKind}
      >
        {kindIcon}
      </span>

      {/* Label */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pin.ownerRef}
      </span>

      {/* Freshness badge */}
      <Badge variant={badgeVariant}>
        {pin.freshness}{pin.versionsBehind > 0 ? ` (-${pin.versionsBehind})` : ''}
      </Badge>

      {/* Action buttons */}
      {pin.freshness === 'outdated' && (
        <button
          data-part="button"
          data-variant="outlined"
          onClick={() => onReanchor(pin.pin)}
          style={{ fontSize: '10px', padding: '1px 6px' }}
        >
          Update
        </button>
      )}
      <button
        data-part="button"
        data-variant="outlined"
        onClick={() => onGetOriginal(pin.pin)}
        style={{ fontSize: '10px', padding: '1px 6px' }}
        title="View the original pinned content"
      >
        View Original
      </button>
    </div>
  );
};

export default EntityDetailView;
