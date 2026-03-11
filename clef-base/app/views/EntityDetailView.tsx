'use client';

/**
 * EntityDetailView — Triple-zone entity page composed of Views via LayoutRenderer.
 *
 * Per spec §3.1: The entity page is NOT a monolithic widget — it's a Layout
 * with three zones (structured, unstructured, related), each rendering through
 * Views with display modes.
 *
 * Flow:
 * 1. Load the entity via ContentNode/get to establish context (entityId, entityType)
 * 2. Render LayoutRenderer for "entity-detail" layout with context
 * 3. Child Views use {{entityId}}/{{entityType}} templates in their dataSources
 *
 * The structured zone uses the "detail" display type (property grid).
 * The unstructured zone uses the "content-body" display type (block editor).
 * The related zone uses embeddable Views (table/card-grid) with queries.
 */

import React, { useState, useCallback } from 'react';
import { Badge } from '../components/widgets/Badge';
import { Card } from '../components/widgets/Card';
import { EmptyState } from '../components/widgets/EmptyState';
import { LayoutRenderer } from '../components/LayoutRenderer';
import { DisplayAsPicker } from '../components/widgets/DisplayAsPicker';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';

interface EntityDetailViewProps {
  id: string;
}

export const EntityDetailView: React.FC<EntityDetailViewProps> = ({ id }) => {
  const { data, loading, error } = useConceptQuery<Record<string, unknown>>('ContentNode', 'get', { node: id });
  const { navigateToHref } = useNavigator();
  const [displayMode, setDisplayMode] = useState('entity-page');

  const handleDisplayModeChange = useCallback((modeId: string) => {
    setDisplayMode(modeId);
  }, []);

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

  const entityType = String(data.type ?? 'default');
  const displayName = String(data.node ?? id).replace(/^(concept|schema|sync|suite|theme|view|widget|display-mode|workflow|automation-rule|taxonomy):/, '');

  // Context for template variable resolution in child Views
  const context = {
    entityId: String(data.node ?? id),
    entityType,
  };

  return (
    <div>
      {/* Entity header with navigation and type badge */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/content')}>
            Back
          </button>
          <h1 style={{ margin: 0 }}>{displayName}</h1>
          <Badge variant="info">{entityType}</Badge>
          <DisplayAsPicker
            currentSchema="ContentNode"
            currentMode={displayMode}
            onChange={handleDisplayModeChange}
            variant="inline"
          />
        </div>
      </div>

      {/* Triple-zone layout — composed of Views via LayoutRenderer */}
      <LayoutRenderer layoutId="entity-detail" context={context} />
    </div>
  );
};

export default EntityDetailView;
