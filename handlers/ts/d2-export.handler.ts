// ============================================================
// D2ExportProvider Handler
//
// Export provider for D2 diagram language. Generates D2 syntax
// with identifier-label declarations and source -> target
// connection arrows.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const d2ExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'd2');
    if (existing) {
      return { variant: 'ok', name: 'd2', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'd2', {
      id: 'd2',
      name: 'd2',
      category: 'diagram_export',
      mime_type: 'text/plain',
      supports_import: false,
    });

    return { variant: 'ok', name: 'd2', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const direction = (options.direction as string) ?? null;

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const lines: string[] = [];

    // Optional direction directive
    if (direction) {
      lines.push(`direction: ${direction}`);
      lines.push('');
    }

    // Build node-id to safe-identifier map
    const idMap = new Map<string, string>();
    let nodeIndex = 0;
    for (const item of items) {
      const safeId = toD2Id(item.id as string, nodeIndex++);
      idMap.set(item.id as string, safeId);
    }

    // Emit node declarations
    for (const item of items) {
      const safeId = idMap.get(item.id as string)!;
      const label = (item.label as string) ?? null;
      const shape = (item.shape as string) ?? null;

      let line = safeId;
      if (label) {
        line += `: ${escapeD2(label)}`;
      }
      lines.push(line);

      // Shape styling
      if (shape) {
        const d2Shape = mapShapeToD2(shape);
        if (d2Shape) {
          lines.push(`${safeId}.shape: ${d2Shape}`);
        }
      }
    }

    if (items.length > 0 && connectors.length > 0) {
      lines.push('');
    }

    // Emit connections
    for (const conn of connectors) {
      const sourceId = idMap.get(conn.source as string);
      const targetId = idMap.get(conn.target as string);
      if (!sourceId || !targetId) continue;

      const label = conn.label as string | undefined;
      const style = (conn.style as string) ?? 'solid';

      let arrow: string;
      if (style === 'dashed') {
        arrow = label ? `${sourceId} -- ${escapeD2(label)} --> ${targetId}` : `${sourceId} --> ${targetId}`;
      } else {
        arrow = label ? `${sourceId} -> ${targetId}: ${escapeD2(label)}` : `${sourceId} -> ${targetId}`;
      }
      lines.push(arrow);
    }

    const output = lines.join('\n');
    return { variant: 'ok', data: output, mime_type: 'text/plain' };
  },
};

function toD2Id(rawId: string, index: number): string {
  // D2 identifiers: alphanumeric + underscores + hyphens
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || `node_${index}`;
}

function escapeD2(text: string): string {
  // D2 labels with special characters should be quoted
  if (/[:{}\[\]|;#]/.test(text)) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function mapShapeToD2(shape: string): string | null {
  const shapeMap: Record<string, string> = {
    rectangle: 'rectangle',
    circle: 'circle',
    ellipse: 'oval',
    diamond: 'diamond',
    hexagon: 'hexagon',
    cylinder: 'cylinder',
    queue: 'queue',
    cloud: 'cloud',
  };
  return shapeMap[shape] ?? null;
}

export default d2ExportHandler;
