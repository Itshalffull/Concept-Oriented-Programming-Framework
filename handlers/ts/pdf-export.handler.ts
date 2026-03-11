// ============================================================
// PdfExportProvider Handler
//
// Export provider for PDF format. Returns a placeholder record;
// actual PDF generation is environment-specific and delegated
// to the client or a dedicated rendering service.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `pdf-export-${++idCounter}`;
}

export const pdfExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'pdf');
    if (existing) {
      return { variant: 'ok', name: 'pdf', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'pdf', {
      id: 'pdf',
      name: 'pdf',
      category: 'diagram_export',
      mime_type: 'application/pdf',
      supports_import: false,
    });

    return { variant: 'ok', name: 'pdf', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const pageSize = (options.page_size as string) ?? 'A4';
    const orientation = (options.orientation as string) ?? 'landscape';
    const margin = (options.margin as number) ?? 20;

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const id = nextId();

    // Store metadata record for environment-specific PDF generation
    await storage.put('pdf-export-metadata', id, {
      id,
      canvas_id: canvasId,
      page_size: pageSize,
      orientation,
      margin,
      item_count: items.length,
      connector_count: connectors.length,
      status: 'pending_generation',
      created_at: new Date().toISOString(),
    });

    return {
      variant: 'ok',
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
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetPdfExportCounter(): void {
  idCounter = 0;
}

export default pdfExportHandler;
