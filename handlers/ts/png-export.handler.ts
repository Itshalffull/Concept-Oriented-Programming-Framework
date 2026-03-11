// ============================================================
// PngExportProvider Handler
//
// Export provider for PNG format. Returns a placeholder record
// with dimensions metadata; actual rasterization is performed
// client-side where canvas/image APIs are available.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `png-export-${++idCounter}`;
}

export const pngExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'png');
    if (existing) {
      return { variant: 'ok', name: 'png', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'png', {
      id: 'png',
      name: 'png',
      category: 'diagram_export',
      mime_type: 'image/png',
      supports_import: false,
    });

    return { variant: 'ok', name: 'png', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const width = (options.width as number) ?? 1024;
    const height = (options.height as number) ?? 768;
    const scale = (options.scale as number) ?? 2;
    const background = (options.background as string) ?? 'white';

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const id = nextId();

    // Store metadata record for client-side rasterization
    await storage.put('png-export-metadata', id, {
      id,
      canvas_id: canvasId,
      width,
      height,
      scale,
      background,
      item_count: items.length,
      connector_count: connectors.length,
      status: 'pending_rasterization',
      created_at: new Date().toISOString(),
    });

    return {
      variant: 'ok',
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
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetPngExportCounter(): void {
  idCounter = 0;
}

export default pngExportHandler;
