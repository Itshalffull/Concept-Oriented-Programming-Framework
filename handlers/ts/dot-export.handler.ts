// ============================================================
// DotExportProvider Handler
//
// Export provider for Graphviz DOT format. Generates DOT syntax
// with digraph structure, node shape attributes, and directed
// edges. Supports basic DOT import parsing.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const dotExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'dot');
    if (existing) {
      return { variant: 'ok', name: 'dot', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'dot', {
      id: 'dot',
      name: 'dot',
      category: 'diagram_export',
      mime_type: 'text/vnd.graphviz',
      supports_import: true,
    });

    return { variant: 'ok', name: 'dot', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const graphName = (options.graph_name as string) ?? 'diagram';
    const rankdir = (options.rankdir as string) ?? null;

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const lines: string[] = [];
    lines.push(`digraph ${escapeDotId(graphName)} {`);

    // Graph attributes
    if (rankdir) {
      lines.push(`  rankdir=${rankdir};`);
    }

    // Build node-id to safe-identifier map
    const idMap = new Map<string, string>();
    let nodeIndex = 0;
    for (const item of items) {
      const safeId = toDotId(item.id as string, nodeIndex++);
      idMap.set(item.id as string, safeId);
    }

    // Emit node definitions
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

    // Emit edges
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
    return { variant: 'ok', data: output, mime_type: 'text/vnd.graphviz' };
  },

  async importData(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    const nodes = new Map<string, string>(); // id -> label
    let connectorsCreated = 0;

    const lines = data.split('\n').map((l) => l.trim());

    for (const line of lines) {
      // Match edges: a -> b [label="..."]
      const edgeMatch = line.match(/^\s*(\w+)\s*->\s*(\w+)\s*(?:\[([^\]]*)\])?\s*;?\s*$/);
      if (edgeMatch) {
        const [, source, target, attrStr] = edgeMatch;

        // Ensure nodes exist
        if (!nodes.has(source)) nodes.set(source, source);
        if (!nodes.has(target)) nodes.set(target, target);

        let edgeLabel: string | null = null;
        let edgeStyle = 'solid';
        if (attrStr) {
          const labelMatch = attrStr.match(/label\s*=\s*"([^"]*)"/);
          if (labelMatch) edgeLabel = labelMatch[1];
          if (attrStr.includes('style=dashed')) edgeStyle = 'dashed';
        }

        const connId = `conn-${connectorsCreated}`;
        await storage.put('canvas-connector', connId, {
          id: connId,
          canvas: targetCanvas,
          source,
          target,
          label: edgeLabel,
          style: edgeStyle,
        });
        connectorsCreated++;
        continue;
      }

      // Match node definitions: a [label="...", shape=box]
      const nodeMatch = line.match(/^\s*(\w+)\s*\[([^\]]*)\]\s*;?\s*$/);
      if (nodeMatch) {
        const [, nodeId, attrStr] = nodeMatch;
        const labelMatch = attrStr.match(/label\s*=\s*"([^"]*)"/);
        const label = labelMatch ? labelMatch[1] : nodeId;
        nodes.set(nodeId, label);
      }
    }

    // Create canvas items for all discovered nodes
    let itemsCreated = 0;
    for (const [nodeId, label] of nodes) {
      await storage.put('canvas-item', nodeId, {
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

    return {
      variant: 'ok',
      canvas_id: targetCanvas,
      items_created: itemsCreated,
      connectors_created: connectorsCreated,
    };
  },
};

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

export default dotExportHandler;
