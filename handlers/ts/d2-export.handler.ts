// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// D2ExportProvider Handler
//
// Export provider for D2 diagram language. Generates D2 syntax
// with identifier-label declarations and source -> target
// connection arrows.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'd2', 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'ok', { name: 'd2', category: 'diagram_export' }),
      (elseP) => {
        elseP = put(elseP, 'export-provider', 'd2', {
          id: 'd2',
          name: 'd2',
          category: 'diagram_export',
          mime_type: 'text/plain',
          supports_import: false,
        });
        return complete(elseP, 'ok', { name: 'd2', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};
    const direction = (options.direction as string) ?? null;

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      const lines: string[] = [];

      if (direction) {
        lines.push(`direction: ${direction}`);
        lines.push('');
      }

      const idMap = new Map<string, string>();
      let nodeIndex = 0;
      for (const item of items) {
        const safeId = toD2Id(item.id as string, nodeIndex++);
        idMap.set(item.id as string, safeId);
      }

      for (const item of items) {
        const safeId = idMap.get(item.id as string)!;
        const label = (item.label as string) ?? null;
        const shape = (item.shape as string) ?? null;

        let line = safeId;
        if (label) {
          line += `: ${escapeD2(label)}`;
        }
        lines.push(line);

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
      return { data: output, mime_type: 'text/plain' };
    }) as StorageProgram<Result>;
  },
};

function toD2Id(rawId: string, index: number): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || `node_${index}`;
}

function escapeD2(text: string): string {
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

export const d2ExportHandler = autoInterpret(_handler);

export default d2ExportHandler;
