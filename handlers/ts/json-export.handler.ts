// ============================================================
// JsonExportProvider Handler
//
// Export provider for JSON format. Serializes canvas items and
// connectors to a structured JSON document. Supports full
// round-trip import/export.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const jsonExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'json');
    if (existing) {
      return { variant: 'ok', name: 'json', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'json', {
      id: 'json',
      name: 'json',
      category: 'diagram_export',
      mime_type: 'application/json',
      supports_import: true,
    });

    return { variant: 'ok', name: 'json', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    // Collect all canvas items for this canvas
    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

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
    return { variant: 'ok', data: output, mime_type: 'application/json' };
  },

  async importData(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    let document: Record<string, unknown>;
    try {
      document = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Invalid JSON data' };
    }

    const items = (document.items as Record<string, unknown>[]) ?? [];
    const connectors = (document.connectors as Record<string, unknown>[]) ?? [];

    let itemsCreated = 0;
    for (const item of items) {
      const id = (item.id as string) ?? `item-${itemsCreated}`;
      await storage.put('canvas-item', id, {
        ...item,
        id,
        canvas: targetCanvas,
      });
      itemsCreated++;
    }

    let connectorsCreated = 0;
    for (const conn of connectors) {
      const id = (conn.id as string) ?? `conn-${connectorsCreated}`;
      await storage.put('canvas-connector', id, {
        ...conn,
        id,
        canvas: targetCanvas,
      });
      connectorsCreated++;
    }

    return {
      variant: 'ok',
      canvas_id: targetCanvas,
      items_created: itemsCreated,
      connectors_created: connectorsCreated,
    };
  },
};

export default jsonExportHandler;
