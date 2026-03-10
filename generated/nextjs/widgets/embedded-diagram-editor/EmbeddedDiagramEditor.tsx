'use client';

import React, { useMemo } from 'react';

import { Canvas } from '../../../../surface/widgets/nextjs/components/widgets/domain/Canvas.tsx';
import { CanvasConnector } from '../../../../surface/widgets/nextjs/components/widgets/domain/CanvasConnector.tsx';
import { CanvasNode } from '../../../../surface/widgets/nextjs/components/widgets/domain/CanvasNode.tsx';
import type { SlashCommand } from '../triple-zone-layout/TripleZoneLayout.tsx';

export type DiagramEmbedType = 'entity' | 'reference' | 'shape' | 'frame' | 'canvas';
export type DiagramConnectorKind = 'visual' | 'semantic' | 'surfaced';

export interface EmbeddedDiagramItem {
  id: string;
  title: string;
  embedType: DiagramEmbedType;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  entityId?: string;
  entityType?: string;
  displayAs?: string;
  shapeKind?: 'rectangle' | 'ellipse' | 'diamond' | 'text';
  excerpt?: string;
}

export interface EmbeddedDiagramConnector {
  id: string;
  source: string;
  target: string;
  kind: DiagramConnectorKind;
  label?: string;
}

export interface EmbeddedDiagramEditorProps {
  canvasId: string;
  title?: string;
  items: EmbeddedDiagramItem[];
  connectors?: EmbeddedDiagramConnector[];
  activeItemId?: string;
  readOnly?: boolean;
}

export function mapEmbedTypeToCanvasNodeType(
  item: EmbeddedDiagramItem,
): 'sticky' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'frame' {
  if (item.embedType === 'frame') {
    return 'frame';
  }
  if (item.embedType === 'shape') {
    if (item.shapeKind === 'ellipse') return 'ellipse';
    if (item.shapeKind === 'diamond') return 'diamond';
    if (item.shapeKind === 'text') return 'text';
  }
  return 'rectangle';
}

export function createEmbeddedDiagramSlashCommands(): SlashCommand[] {
  return [
    {
      id: 'embedded-canvas',
      label: 'Embedded Canvas',
      description: 'Insert a spatial canvas embed backed by real entities, shapes, and frames.',
      icon: '⬚',
      group: 'Canvas',
    },
    {
      id: 'shape',
      label: 'Shape',
      description: 'Insert a shape-backed canvas item using the Shape concept.',
      icon: '◇',
      group: 'Canvas',
    },
    {
      id: 'frame',
      label: 'Frame',
      description: 'Insert a named frame region that groups embedded items.',
      icon: '▭',
      group: 'Canvas',
    },
  ];
}

function connectorPresentation(kind: DiagramConnectorKind): {
  dashed: boolean;
  lineStyle: 'straight' | 'curved' | 'step';
} {
  if (kind === 'visual') {
    return { dashed: true, lineStyle: 'curved' };
  }
  if (kind === 'surfaced') {
    return { dashed: false, lineStyle: 'step' };
  }
  return { dashed: false, lineStyle: 'straight' };
}

export const EmbeddedDiagramEditor: React.FC<EmbeddedDiagramEditorProps> = ({
  canvasId,
  title = 'Embedded Canvas',
  items,
  connectors = [],
  activeItemId,
  readOnly = false,
}) => {
  const indexedItems = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const nodeLayer = items.map((item) => (
    <CanvasNode
      key={item.id}
      id={item.id}
      type={mapEmbedTypeToCanvasNodeType(item)}
      position={item.position}
      size={item.size ?? { width: 240, height: item.embedType === 'frame' ? 180 : 120 }}
      label={item.title}
      color={item.embedType === 'frame' ? '#f7f0d5' : '#ffffff'}
      borderColor={item.embedType === 'reference' ? '#1d4ed8' : '#111827'}
      borderWidth={item.id === activeItemId ? 2 : 1}
    >
      <div data-part="embedded-diagram-node">
        <div data-part="embedded-diagram-node-header">
          <span data-part="embedded-diagram-chip">{item.embedType}</span>
          {item.entityType && <span data-part="embedded-diagram-chip">{item.entityType}</span>}
          {item.displayAs && <span data-part="embedded-diagram-chip">{item.displayAs}</span>}
        </div>
        {item.entityId && (
          <div data-part="embedded-diagram-entity-id">{item.entityId}</div>
        )}
        {item.excerpt && (
          <p data-part="embedded-diagram-excerpt">{item.excerpt}</p>
        )}
      </div>
    </CanvasNode>
  ));

  const edgeLayer = connectors.map((connector) => {
    const source = indexedItems.get(connector.source);
    const target = indexedItems.get(connector.target);
    if (!source || !target) {
      return null;
    }

    const presentation = connectorPresentation(connector.kind);

    return (
      <CanvasConnector
        key={connector.id}
        id={connector.id}
        startNodeId={connector.source}
        endNodeId={connector.target}
        startNodeLabel={source.title}
        endNodeLabel={target.title}
        label={connector.label ?? connector.kind}
        lineStyle={presentation.lineStyle}
        dashed={presentation.dashed}
        arrowEnd
        startPos={{
          x: source.position.x + ((source.size?.width ?? 240) / 2),
          y: source.position.y + ((source.size?.height ?? 120) / 2),
        }}
        endPos={{
          x: target.position.x + ((target.size?.width ?? 240) / 2),
          y: target.position.y + ((target.size?.height ?? 120) / 2),
        }}
      />
    );
  });

  const toolbar = (
    <div data-part="embedded-diagram-toolbar">
      <strong>{title}</strong>
      <span data-part="embedded-diagram-meta">{canvasId}</span>
      <span data-part="embedded-diagram-meta">{items.length} items</span>
      <span data-part="embedded-diagram-meta">{connectors.length} connectors</span>
      <span data-part="embedded-diagram-meta">{readOnly ? 'read only' : 'editable embed'}</span>
    </div>
  );

  return (
    <div data-part="embedded-diagram-shell" data-canvas-id={canvasId}>
      <Canvas
        ariaLabel={title}
        readOnly={readOnly}
        nodes={items.map((item) => ({ id: item.id, x: item.position.x, y: item.position.y }))}
        edges={connectors.map((connector) => ({ id: connector.id, source: connector.source, target: connector.target }))}
        selectedIds={activeItemId ? [activeItemId] : []}
        toolbar={toolbar}
        nodeLayer={nodeLayer}
        edgeLayer={edgeLayer}
      />
    </div>
  );
};

EmbeddedDiagramEditor.displayName = 'EmbeddedDiagramEditor';
export default EmbeddedDiagramEditor;
