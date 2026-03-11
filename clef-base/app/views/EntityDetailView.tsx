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
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';

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
  const invoke = useKernelInvoke();
  const { data, loading, error, refetch: refetchNode } = useConceptQuery<Record<string, unknown>>('ContentNode', 'get', { node: id });
  const { data: schemasResult, refetch: refetchSchemas } = useConceptQuery<{ schemas: string }>('Schema', 'getSchemasFor', { entity_id: id });
  const { data: allSchemaDefs } = useConceptQuery<Record<string, unknown>[]>('Schema', 'list');
  const { navigateToHref } = useNavigator();

  const [showSchemaManager, setShowSchemaManager] = useState(false);

  // Parse schemas from the response
  const schemas: string[] = schemasResult?.schemas
    ? (typeof schemasResult.schemas === 'string' ? JSON.parse(schemasResult.schemas) : schemasResult.schemas)
    : [];

  // Available schemas for the apply dropdown
  const availableSchemas = (allSchemaDefs ?? [])
    .map((s) => s.schema as string)
    .filter((s) => !schemas.includes(s));

  const handleApplySchema = useCallback(async (schema: string) => {
    await invoke('Schema', 'applyTo', { entity_id: id, schema });
    refetchSchemas();
  }, [invoke, id, refetchSchemas]);

  const handleRemoveSchema = useCallback(async (schema: string) => {
    await invoke('Schema', 'removeFrom', { entity_id: id, schema });
    refetchSchemas();
  }, [invoke, id, refetchSchemas]);

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
                  <button
                    data-part="button"
                    data-variant="outlined"
                    onClick={() => handleRemoveSchema(s)}
                    style={{ fontSize: '10px', padding: '1px 4px', color: 'var(--palette-error)' }}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableSchemas.length > 0 && (
            <>
              <h3 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '14px' }}>Apply Schema</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                {availableSchemas.map((s) => (
                  <button
                    key={s}
                    data-part="button"
                    data-variant="outlined"
                    onClick={() => handleApplySchema(s)}
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Triple-zone layout — composed of Views via LayoutRenderer */}
      <LayoutRenderer layoutId="entity-detail" context={context} />
    </div>
  );
};

export default EntityDetailView;
