// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// JsonExportProvider Handler
//
// Export provider for JSON format. Serializes canvas items and
// connectors to a structured JSON document. Supports full
// round-trip import/export.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'json', 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      (bp) => complete(bp, 'ok', { name: 'json', category: 'diagram_export' }),
      (bp) => {
        const bp2 = put(bp, 'export-provider', 'json', {
          id: 'json',
          name: 'json',
          category: 'diagram_export',
          mime_type: 'application/json',
          supports_import: true,
        });
        return complete(bp2, 'ok', { name: 'json', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      const document = {
        version: '1.0',
        canvas: canvasId,
        exported_at: new Date().toISOString(),
        items: items.map((item) => ({
          id: item.id,
          kind: item.kind,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          label: item.label ?? null,
          shape: item.shape ?? null,
          data: item.data ?? null,
        })),
        connectors: connectors.map((conn) => ({
          id: conn.id,
          source: conn.source,
          target: conn.target,
          label: conn.label ?? null,
          style: conn.style ?? null,
        })),
        options,
      };

      const output = JSON.stringify(document, null, 2);
      return { data: output, mime_type: 'application/json' };
    }) as StorageProgram<Result>;
  },

  importData(input: Record<string, unknown>) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    let document: Record<string, unknown>;
    try {
      document = JSON.parse(data) as Record<string, unknown>;
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid JSON data' }) as StorageProgram<Result>;
    }

    const items = (document.items as Record<string, unknown>[]) ?? [];
    const connectors = (document.connectors as Record<string, unknown>[]) ?? [];

    let p = createProgram();

    let itemsCreated = 0;
    for (const item of items) {
      const id = (item.id as string) ?? `item-${itemsCreated}`;
      p = put(p, 'canvas-item', id, {
        ...item,
        id,
        canvas: targetCanvas,
      });
      itemsCreated++;
    }

    let connectorsCreated = 0;
    for (const conn of connectors) {
      const id = (conn.id as string) ?? `conn-${connectorsCreated}`;
      p = put(p, 'canvas-connector', id, {
        ...conn,
        id,
        canvas: targetCanvas,
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

export const jsonExportHandler = autoInterpret(_handler);

export default jsonExportHandler;
