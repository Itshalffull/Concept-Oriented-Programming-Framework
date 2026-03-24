// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DiagramExport Handler
//
// Export canvas diagrams to multiple formats via pluggable
// providers. Coordination concept dispatching to format-specific
// providers via PluginRegistry.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `export-${++idCounter}`;
}

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

const SUPPORTED_FORMATS = new Set([
  'json', 'svg', 'png', 'pdf', 'mermaid', 'd2', 'dot', 'bpmn-xml', 'drawio-xml',
]);

const _handler: FunctionalConceptHandler = {
  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const format = input.format as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    // Reject unknown formats immediately without needing a registered provider
    if (!format || !SUPPORTED_FORMATS.has(format)) {
      const id = nextId();
      let pErr = createProgram();
      pErr = put(pErr, 'diagram-export', id, {
        id, canvas_id: canvasId, format: format ?? '', status: 'error', output: null, metadata: null,
      });
      return complete(pErr, 'error', { message: `No export provider registered for format '${format}'` }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'diagram-export', id, {
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
    return complete(p, 'ok', { export: id, data: null, mime_type: getMimeType(format) }) as StorageProgram<Result>;
  },

  importDiagram(input: Record<string, unknown>) {
    const format = input.format as string;
    const targetCanvas = (input.target_canvas as string | undefined) ?? null;

    // Reject unknown formats immediately without needing a registered provider
    if (!format || !SUPPORTED_FORMATS.has(format)) {
      const p = createProgram();
      return complete(p, 'error', { message: `No import provider registered for format '${format}'` }) as StorageProgram<Result>;
    }

    const p = createProgram();
    return complete(p, 'ok', {
      canvas_id: targetCanvas ?? `canvas-import-${nextId()}`,
      items_created: 0,
      connectors_created: 0,
    }) as StorageProgram<Result>;
  },

  detectFormat(input: Record<string, unknown>) {
    const data = input.data;

    if (!data) {
      const p = createProgram();
      return complete(p, 'unknown', { message: 'No data provided' }) as StorageProgram<Result>;
    }

    const str = typeof data === 'string' ? data : '';
    const p = createProgram();

    if (str.startsWith('{') || str.startsWith('[')) {
      return complete(p, 'ok', { format: 'json', confidence: 0.9 }) as StorageProgram<Result>;
    }
    if (str.startsWith('<?xml') || str.startsWith('<mxfile')) {
      if (str.includes('bpmn:')) return complete(p, 'ok', { format: 'bpmn-xml', confidence: 0.9 }) as StorageProgram<Result>;
      if (str.includes('mxfile') || str.includes('mxGraphModel')) return complete(p, 'ok', { format: 'drawio-xml', confidence: 0.9 }) as StorageProgram<Result>;
      return complete(p, 'ok', { format: 'svg', confidence: 0.7 }) as StorageProgram<Result>;
    }
    if (str.startsWith('<svg')) {
      return complete(p, 'ok', { format: 'svg', confidence: 0.95 }) as StorageProgram<Result>;
    }
    if (str.includes('graph ') || str.includes('digraph ')) {
      return complete(p, 'ok', { format: 'dot', confidence: 0.8 }) as StorageProgram<Result>;
    }
    if (str.includes('flowchart') || str.includes('graph TD') || str.includes('graph LR')) {
      return complete(p, 'ok', { format: 'mermaid', confidence: 0.85 }) as StorageProgram<Result>;
    }

    return complete(p, 'unknown', { message: 'Cannot determine format from data' }) as StorageProgram<Result>;
  },
};

export const diagramExportHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetDiagramExportCounter(): void {
  idCounter = 0;
}

export default diagramExportHandler;
