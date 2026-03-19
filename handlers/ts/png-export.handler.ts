// @migrated dsl-constructs 2026-03-18
// ============================================================
// PngExportProvider Handler
//
// Export provider for PNG format. Returns a placeholder record
// with dimensions metadata; actual rasterization is performed
// client-side where canvas/image APIs are available.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `png-export-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'png', 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      (bp) => complete(bp, 'ok', { name: 'png', category: 'diagram_export' }),
      (bp) => {
        const bp2 = put(bp, 'export-provider', 'png', {
          id: 'png',
          name: 'png',
          category: 'diagram_export',
          mime_type: 'image/png',
          supports_import: false,
        });
        return complete(bp2, 'ok', { name: 'png', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const width = (options.width as number) ?? 1024;
    const height = (options.height as number) ?? 768;
    const scale = (options.scale as number) ?? 2;
    const background = (options.background as string) ?? 'white';

    const id = nextId();

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    // Store pending rasterization metadata for client-side retrieval
    p = putFrom(p, 'png-export-metadata', id, (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];
      return {
        status: 'pending_rasterization',
        width,
        height,
        scale,
        background,
        item_count: items.length,
        connector_count: connectors.length,
        note: 'Rasterization must be performed client-side',
      };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      return {
        export_id: id,
        data: null,
        mime_type: 'image/png',
        metadata: {
          width,
          height,
          scale,
          background,
          item_count: items.length,
          connector_count: connectors.length,
          note: 'Rasterization must be performed client-side',
        },
      };
    }) as StorageProgram<Result>;
  },
};

export const pngExportHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetPngExportCounter(): void {
  idCounter = 0;
}

export default pngExportHandler;
