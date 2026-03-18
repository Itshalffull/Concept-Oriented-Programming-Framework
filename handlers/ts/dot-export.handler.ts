// @migrated dsl-constructs 2026-03-18
// ============================================================
// DotExportProvider Handler
//
// Export provider for Graphviz DOT format. Generates DOT syntax
// with digraph structure, node shape attributes, and directed
// edges. Supports basic DOT import parsing.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toDotId(rawId: string, index: number): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_]/g, '_');
  return cleaned || `node_${index}`;
}

function escapeDotId(name: string): string {
  if (/^[a-zA-Z_]\w*$/.test(name)) return name;
  return `"${name.replace(/"/g, '\\"')}"`;
}

function escapeDotString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function mapShapeToDot(shape: string): string {
  const shapeMap: Record<string, string> = {
    rectangle: 'box',
    circle: 'circle',
    ellipse: 'ellipse',
    diamond: 'diamond',
    triangle: 'triangle',
    hexagon: 'hexagon',
    cylinder: 'cylinder',
    rounded: 'box',
  };
  return shapeMap[shape] ?? 'box';
}

/**
 * Parse DOT data and extract nodes and edges.
 */
function parseDotData(data: string): {
  nodes: Map<string, string>;
  edges: Array<{ source: string; target: string; label: string | null; style: string }>;
} {
  const nodes = new Map<string, string>();
  const edges: Array<{ source: string; target: string; label: string | null; style: string }> = [];

  const lines = data.split('\n').map((l) => l.trim());

  for (const line of lines) {
    const edgeMatch = line.match(/^\s*(\w+)\s*->\s*(\w+)\s*(?:\[([^\]]*)\])?\s*;?\s*$/);
    if (edgeMatch) {
      const [, source, target, attrStr] = edgeMatch;
      if (!nodes.has(source)) nodes.set(source, source);
      if (!nodes.has(target)) nodes.set(target, target);

      let edgeLabel: string | null = null;
      let edgeStyle = 'solid';
      if (attrStr) {
        const labelMatch = attrStr.match(/label\s*=\s*"([^"]*)"/);
        if (labelMatch) edgeLabel = labelMatch[1];
        if (attrStr.includes('style=dashed')) edgeStyle = 'dashed';
      }

      edges.push({ source, target, label: edgeLabel, style: edgeStyle });
      continue;
    }

    const nodeMatch = line.match(/^\s*(\w+)\s*\[([^\]]*)\]\s*;?\s*$/);
    if (nodeMatch) {
      const [, nodeId, attrStr] = nodeMatch;
      const labelMatch = attrStr.match(/label\s*=\s*"([^"]*)"/);
      const label = labelMatch ? labelMatch[1] : nodeId;
      nodes.set(nodeId, label);
    }
  }

  return { nodes, edges };
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'dot', 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'ok', { name: 'dot', category: 'diagram_export' }),
      (elseP) => {
        elseP = put(elseP, 'export-provider', 'dot', {
          id: 'dot',
          name: 'dot',
          category: 'diagram_export',
          mime_type: 'text/vnd.graphviz',
          supports_import: true,
        });
        return complete(elseP, 'ok', { name: 'dot', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const graphName = (options.graph_name as string) ?? 'diagram';
    const rankdir = (options.rankdir as string) ?? null;

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      const lines: string[] = [];
      lines.push(`digraph ${escapeDotId(graphName)} {`);

      if (rankdir) {
        lines.push(`  rankdir=${rankdir};`);
      }

      const idMap = new Map<string, string>();
      let nodeIndex = 0;
      for (const item of items) {
        const safeId = toDotId(item.id as string, nodeIndex++);
        idMap.set(item.id as string, safeId);
      }

      for (const item of items) {
        const safeId = idMap.get(item.id as string)!;
        const label = (item.label as string) ?? (item.id as string);
        const shape = (item.shape as string) ?? 'rectangle';
        const dotShape = mapShapeToDot(shape);

        const attrs: string[] = [];
        attrs.push(`label="${escapeDotString(label)}"`);
        attrs.push(`shape=${dotShape}`);

        lines.push(`  ${safeId} [${attrs.join(', ')}];`);
      }

      if (items.length > 0 && connectors.length > 0) {
        lines.push('');
      }

      for (const conn of connectors) {
        const sourceId = idMap.get(conn.source as string);
        const targetId = idMap.get(conn.target as string);
        if (!sourceId || !targetId) continue;

        const label = conn.label as string | undefined;
        const style = (conn.style as string) ?? 'solid';

        const edgeAttrs: string[] = [];
        if (label) {
          edgeAttrs.push(`label="${escapeDotString(label)}"`);
        }
        if (style === 'dashed') {
          edgeAttrs.push('style=dashed');
        }

        const attrStr = edgeAttrs.length > 0 ? ` [${edgeAttrs.join(', ')}]` : '';
        lines.push(`  ${sourceId} -> ${targetId}${attrStr};`);
      }

      lines.push('}');

      const output = lines.join('\n');
      return { data: output, mime_type: 'text/vnd.graphviz' };
    }) as StorageProgram<Result>;
  },

  importData(input: Record<string, unknown>) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    // Parse DOT data using pure helper
    const { nodes, edges } = parseDotData(data);

    // Build the storage program to write all nodes and edges
    let p = createProgram();

    let itemsCreated = 0;
    for (const [nodeId, label] of nodes) {
      p = put(p, 'canvas-item', nodeId, {
        id: nodeId,
        canvas: targetCanvas,
        kind: 'node',
        x: itemsCreated * 150,
        y: 0,
        width: 120,
        height: 60,
        label,
        shape: 'rectangle',
      });
      itemsCreated++;
    }

    let connectorsCreated = 0;
    for (const edge of edges) {
      const connId = `conn-${connectorsCreated}`;
      p = put(p, 'canvas-connector', connId, {
        id: connId,
        canvas: targetCanvas,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        style: edge.style,
      });
      connectorsCreated++;
    }

    return complete(p, 'ok', {
      canvas_id: targetCanvas,
      items_created: itemsCreated,
      connectors_created: connectorsCreated,
    }) as StorageProgram<Result>;
  },
};

export const dotExportHandler = autoInterpret(_handler);

export default dotExportHandler;
