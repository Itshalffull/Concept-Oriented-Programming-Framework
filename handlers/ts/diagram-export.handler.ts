// ============================================================
// DiagramExport Handler
//
// Export canvas diagrams to multiple formats via pluggable
// providers. Coordination concept dispatching to format-specific
// providers via PluginRegistry.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `export-${++idCounter}`;
}

export const diagramExportHandler: ConceptHandler = {
  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const format = input.format as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const id = nextId();

    // Check if provider is registered
    const provider = await storage.get('export-provider', format);
    if (!provider) {
      await storage.put('diagram-export', id, {
        id, canvas_id: canvasId, format, status: 'error', output: null, metadata: null,
      });
      return { variant: 'error', message: `No export provider registered for format '${format}'` };
    }

    // Store export record with pending status; actual rendering happens
    // via sync dispatch to the registered provider
    await storage.put('diagram-export', id, {
      id,
      export: id,
      canvas_id: canvasId,
      format,
      status: 'pending',
      output: null,
      metadata: {
        width: (options.width as number) ?? null,
        height: (options.height as number) ?? null,
        embedded_data: (options.embed_data as boolean) ?? false,
      },
      options,
    });

    return { variant: 'ok', export: id, data: null, mime_type: getMimeType(format) };
  },

  async importDiagram(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data;
    const format = input.format as string;
    const targetCanvas = (input.target_canvas as string | undefined) ?? null;

    // Check if provider is registered
    const provider = await storage.get('export-provider', format);
    if (!provider) {
      return { variant: 'error', message: `No import provider registered for format '${format}'` };
    }

    // Actual import parsing delegated to provider via sync
    return {
      variant: 'ok',
      canvas_id: targetCanvas ?? `canvas-import-${nextId()}`,
      items_created: 0,
      connectors_created: 0,
    };
  },

  async detectFormat(input: Record<string, unknown>, _storage: ConceptStorage) {
    const data = input.data;

    if (!data) {
      return { variant: 'unknown', message: 'No data provided' };
    }

    const str = typeof data === 'string' ? data : '';

    // Simple heuristic detection
    if (str.startsWith('{') || str.startsWith('[')) {
      return { variant: 'ok', format: 'json', confidence: 0.9 };
    }
    if (str.startsWith('<?xml') || str.startsWith('<mxfile')) {
      if (str.includes('bpmn:')) return { variant: 'ok', format: 'bpmn-xml', confidence: 0.9 };
      if (str.includes('mxfile') || str.includes('mxGraphModel')) return { variant: 'ok', format: 'drawio-xml', confidence: 0.9 };
      return { variant: 'ok', format: 'svg', confidence: 0.7 };
    }
    if (str.startsWith('<svg')) {
      return { variant: 'ok', format: 'svg', confidence: 0.95 };
    }
    if (str.includes('graph ') || str.includes('digraph ')) {
      return { variant: 'ok', format: 'dot', confidence: 0.8 };
    }
    if (str.includes('flowchart') || str.includes('graph TD') || str.includes('graph LR')) {
      return { variant: 'ok', format: 'mermaid', confidence: 0.85 };
    }

    return { variant: 'unknown', message: 'Cannot determine format from data' };
  },
};

function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    pdf: 'application/pdf',
    mermaid: 'text/plain',
    d2: 'text/plain',
    dot: 'text/vnd.graphviz',
    'bpmn-xml': 'application/xml',
    'drawio-xml': 'application/xml',
  };
  return mimeTypes[format] ?? 'application/octet-stream';
}

/** Reset the ID counter. Useful for testing. */
export function resetDiagramExportCounter(): void {
  idCounter = 0;
}

export default diagramExportHandler;
