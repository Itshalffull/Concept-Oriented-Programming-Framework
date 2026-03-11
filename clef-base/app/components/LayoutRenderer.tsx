'use client';

/**
 * LayoutRenderer — loads a Layout config entity from the kernel and renders
 * its children (Views) in the appropriate spatial arrangement.
 *
 * A Layout is a composition of multiple Views arranged with a spatial kind
 * (stack, grid, split, sidebar, etc.). Each child is a reference to a View
 * rendered via ViewRenderer.
 *
 * Flow:
 * 1. invoke('Layout', 'get', { layout: layoutId }) → loads the Layout config
 * 2. Parse children → array of { viewId, area?, span? } references
 * 3. Render each child through ViewRenderer in the spatial arrangement
 */

import React from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { ViewRenderer } from './ViewRenderer';
import { Badge } from './widgets/Badge';

interface LayoutChild {
  type: 'view' | 'layout';
  id: string;
  area?: string;
  span?: number;
}

interface LayoutConfig {
  layout: string;
  name: string;
  kind: string;
  title: string;
  description: string;
  direction: string;
  gap: string;
  columns: string;
  children: string;
}

interface LayoutRendererProps {
  layoutId: string;
  title?: string;
  /** Context variables passed through to child ViewRenderers for template resolution */
  context?: Record<string, string>;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({ layoutId, title: titleOverride, context }) => {
  const { data: layoutConfig, loading, error } =
    useConceptQuery<LayoutConfig>('Layout', 'get', { layout: layoutId });

  if (loading && !layoutConfig) {
    return (
      <div>
        <div className="page-header"><h1>{titleOverride ?? layoutId}</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading layout...</p>
      </div>
    );
  }

  if (error || !layoutConfig) {
    return (
      <div>
        <div className="page-header"><h1>{titleOverride ?? layoutId}</h1></div>
        <p style={{ color: 'var(--palette-error)' }}>Layout &quot;{layoutId}&quot; not found: {error}</p>
      </div>
    );
  }

  let children: LayoutChild[] = [];
  try {
    children = JSON.parse(layoutConfig.children);
  } catch { /* empty */ }

  const title = titleOverride ?? layoutConfig.title ?? layoutConfig.name;
  const kind = layoutConfig.kind;
  const gap = layoutConfig.gap || 'var(--spacing-lg)';
  const columns = layoutConfig.columns || '12';

  // Spatial arrangement based on layout kind
  const containerStyle: React.CSSProperties = (() => {
    switch (kind) {
      case 'grid':
        return {
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap,
        };
      case 'split':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap,
        };
      case 'sidebar':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap,
        };
      case 'stack':
      default:
        return {
          display: 'flex',
          flexDirection: layoutConfig.direction === 'horizontal' ? 'row' as const : 'column' as const,
          gap,
        };
    }
  })();

  const renderChild = (child: LayoutChild, index: number) => {
    const childStyle: React.CSSProperties = {};
    if (child.span && kind === 'grid') {
      childStyle.gridColumn = `span ${child.span}`;
    }

    if (child.type === 'layout') {
      return (
        <div key={`${child.id}-${index}`} style={childStyle}>
          <LayoutRenderer layoutId={child.id} context={context} />
        </div>
      );
    }

    return (
      <div key={`${child.id}-${index}`} style={childStyle}>
        <ViewRenderer viewId={child.id} context={context} />
      </div>
    );
  };

  return (
    <div>
      {title && (
        <div className="page-header">
          <h1>{title}</h1>
          {layoutConfig.description && (
            <Badge variant="secondary">{kind}</Badge>
          )}
        </div>
      )}
      {layoutConfig.description && (
        <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
          {layoutConfig.description}
        </p>
      )}
      <div style={containerStyle}>
        {children.map(renderChild)}
      </div>
    </div>
  );
};

export default LayoutRenderer;
