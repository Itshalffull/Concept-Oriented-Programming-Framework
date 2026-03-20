// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// PdfExportProvider Handler
//
// Export provider for PDF format. Returns a placeholder record;
// actual PDF generation is environment-specific and delegated
// to the client or a dedicated rendering service.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `pdf-export-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'pdf', 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      (bp) => complete(bp, 'ok', { name: 'pdf', category: 'diagram_export' }),
      (bp) => {
        const bp2 = put(bp, 'export-provider', 'pdf', {
          id: 'pdf',
          name: 'pdf',
          category: 'diagram_export',
          mime_type: 'application/pdf',
          supports_import: false,
        });
        return complete(bp2, 'ok', { name: 'pdf', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const pageSize = (options.page_size as string) ?? 'A4';
    const orientation = (options.orientation as string) ?? 'landscape';
    const margin = (options.margin as number) ?? 20;

    const id = nextId();

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    // Store pending generation metadata for external retrieval
    p = putFrom(p, 'pdf-export-metadata', id, (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];
      return {
        status: 'pending_generation',
        page_size: pageSize,
        orientation,
        margin,
        item_count: items.length,
        connector_count: connectors.length,
        note: 'PDF generation is environment-specific and must be handled externally',
      };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      return {
        export_id: id,
        data: null,
        mime_type: 'application/pdf',
        metadata: {
          page_size: pageSize,
          orientation,
          margin,
          item_count: items.length,
          connector_count: connectors.length,
          note: 'PDF generation is environment-specific and must be handled externally',
        },
      };
    }) as StorageProgram<Result>;
  },
};

export const pdfExportHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetPdfExportCounter(): void {
  idCounter = 0;
}

export default pdfExportHandler;
