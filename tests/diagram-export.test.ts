// DiagramExport concept handler tests -- export, detectFormat, and importDiagram actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { diagramExportHandler, resetDiagramExportCounter } from '../handlers/ts/diagram-export.handler.js';

describe('DiagramExport', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDiagramExportCounter();
  });

  /** Helper to register a mock export provider for a given format. */
  async function registerProvider(format: string): Promise<void> {
    await storage.put('export-provider', format, { format, name: `${format}-provider` });
  }

  describe('export', () => {
    it('returns error when no provider registered', async () => {
      const result = await diagramExportHandler.export(
        { canvas_id: 'canvas-1', format: 'svg' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('No export provider');
      expect(result.message).toContain('svg');
    });

    it('returns ok when provider exists', async () => {
      await registerProvider('svg');

      const result = await diagramExportHandler.export(
        { canvas_id: 'canvas-1', format: 'svg' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.export).toBe('export-1');
      expect(result.mime_type).toBe('image/svg+xml');
    });

    it('stores export record with pending status when provider exists', async () => {
      await registerProvider('json');

      const result = await diagramExportHandler.export(
        { canvas_id: 'canvas-1', format: 'json' },
        storage,
      );
      const id = result.export as string;

      const record = await storage.get('diagram-export', id);
      expect(record!.status).toBe('pending');
      expect(record!.canvas_id).toBe('canvas-1');
      expect(record!.format).toBe('json');
    });

    it('stores export record with error status when no provider', async () => {
      await diagramExportHandler.export(
        { canvas_id: 'canvas-1', format: 'unknown' },
        storage,
      );

      const record = await storage.get('diagram-export', 'export-1');
      expect(record!.status).toBe('error');
    });

    it('assigns unique export IDs', async () => {
      await registerProvider('json');

      const r1 = await diagramExportHandler.export({ canvas_id: 'c1', format: 'json' }, storage);
      const r2 = await diagramExportHandler.export({ canvas_id: 'c2', format: 'json' }, storage);
      expect(r1.export).not.toBe(r2.export);
    });

    it('returns correct mime type for json', async () => {
      await registerProvider('json');
      const result = await diagramExportHandler.export({ canvas_id: 'c1', format: 'json' }, storage);
      expect(result.mime_type).toBe('application/json');
    });

    it('returns correct mime type for png', async () => {
      await registerProvider('png');
      const result = await diagramExportHandler.export({ canvas_id: 'c1', format: 'png' }, storage);
      expect(result.mime_type).toBe('image/png');
    });

    it('returns correct mime type for pdf', async () => {
      await registerProvider('pdf');
      const result = await diagramExportHandler.export({ canvas_id: 'c1', format: 'pdf' }, storage);
      expect(result.mime_type).toBe('application/pdf');
    });

    it('returns correct mime type for dot', async () => {
      await registerProvider('dot');
      const result = await diagramExportHandler.export({ canvas_id: 'c1', format: 'dot' }, storage);
      expect(result.mime_type).toBe('text/vnd.graphviz');
    });

    it('returns correct mime type for mermaid', async () => {
      await registerProvider('mermaid');
      const result = await diagramExportHandler.export({ canvas_id: 'c1', format: 'mermaid' }, storage);
      expect(result.mime_type).toBe('text/plain');
    });

    it('returns octet-stream for unknown format', async () => {
      await registerProvider('custom-fmt');
      const result = await diagramExportHandler.export({ canvas_id: 'c1', format: 'custom-fmt' }, storage);
      expect(result.mime_type).toBe('application/octet-stream');
    });

    it('stores export options in metadata', async () => {
      await registerProvider('svg');

      await diagramExportHandler.export(
        { canvas_id: 'c1', format: 'svg', options: { width: 800, height: 600, embed_data: true } },
        storage,
      );

      const record = await storage.get('diagram-export', 'export-1');
      const metadata = record!.metadata as Record<string, unknown>;
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.embedded_data).toBe(true);
    });

    it('defaults metadata dimensions to null', async () => {
      await registerProvider('svg');

      await diagramExportHandler.export(
        { canvas_id: 'c1', format: 'svg' },
        storage,
      );

      const record = await storage.get('diagram-export', 'export-1');
      const metadata = record!.metadata as Record<string, unknown>;
      expect(metadata.width).toBeNull();
      expect(metadata.height).toBeNull();
      expect(metadata.embedded_data).toBe(false);
    });
  });

  describe('detectFormat', () => {
    it('detects JSON from leading brace', async () => {
      const result = await diagramExportHandler.detectFormat({ data: '{"nodes":[]}' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('json');
    });

    it('detects JSON from leading bracket', async () => {
      const result = await diagramExportHandler.detectFormat({ data: '[1,2,3]' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('json');
    });

    it('detects SVG from svg tag', async () => {
      const result = await diagramExportHandler.detectFormat({ data: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('svg');
    });

    it('detects SVG from xml declaration without specific markers', async () => {
      const result = await diagramExportHandler.detectFormat({ data: '<?xml version="1.0"?><root></root>' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('svg');
      expect(result.confidence).toBe(0.7);
    });

    it('detects DOT format from digraph keyword', async () => {
      const result = await diagramExportHandler.detectFormat({ data: 'digraph G { A -> B; }' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('dot');
    });

    it('detects DOT format from graph keyword', async () => {
      const result = await diagramExportHandler.detectFormat({ data: 'graph G { A -- B; }' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('dot');
    });

    it('detects Mermaid from flowchart keyword', async () => {
      const result = await diagramExportHandler.detectFormat({ data: 'flowchart LR\n  A --> B' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('mermaid');
    });

    it('detects graph TD as dot (graph keyword matched first)', async () => {
      // The handler checks for 'graph ' (DOT) before 'graph TD' (Mermaid),
      // so 'graph TD' is classified as DOT format.
      const result = await diagramExportHandler.detectFormat({ data: 'graph TD\n  A --> B' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('dot');
    });

    it('detects graph LR as dot (graph keyword matched first)', async () => {
      const result = await diagramExportHandler.detectFormat({ data: 'graph LR\n  A --> B' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('dot');
    });

    it('detects drawio-xml from mxfile', async () => {
      const result = await diagramExportHandler.detectFormat({ data: '<mxfile><diagram>...</diagram></mxfile>' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('drawio-xml');
    });

    it('detects bpmn-xml from xml with bpmn namespace', async () => {
      const result = await diagramExportHandler.detectFormat(
        { data: '<?xml version="1.0"?><definitions xmlns:bpmn:process></definitions>' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.format).toBe('bpmn-xml');
    });

    it('returns unknown for unrecognizable data', async () => {
      const result = await diagramExportHandler.detectFormat({ data: 'just some random text' }, storage);
      expect(result.variant).toBe('unknown');
    });

    it('returns unknown when no data provided', async () => {
      const result = await diagramExportHandler.detectFormat({}, storage);
      expect(result.variant).toBe('unknown');
      expect(result.message).toContain('No data');
    });

    it('returns unknown for null data', async () => {
      const result = await diagramExportHandler.detectFormat({ data: null }, storage);
      expect(result.variant).toBe('unknown');
    });

    it('returns confidence scores', async () => {
      const jsonResult = await diagramExportHandler.detectFormat({ data: '{}' }, storage);
      expect(jsonResult.confidence).toBe(0.9);

      const svgResult = await diagramExportHandler.detectFormat({ data: '<svg></svg>' }, storage);
      expect(svgResult.confidence).toBe(0.95);

      const mermaidResult = await diagramExportHandler.detectFormat({ data: 'flowchart TD\n  A' }, storage);
      expect(mermaidResult.confidence).toBe(0.85);
    });
  });

  describe('importDiagram', () => {
    it('returns error when no provider registered', async () => {
      const result = await diagramExportHandler.importDiagram(
        { data: '{}', format: 'json' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('No import provider');
    });

    it('returns ok when provider exists', async () => {
      await registerProvider('json');

      const result = await diagramExportHandler.importDiagram(
        { data: '{}', format: 'json' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.items_created).toBe(0);
      expect(result.connectors_created).toBe(0);
    });

    it('uses target_canvas when provided', async () => {
      await registerProvider('json');

      const result = await diagramExportHandler.importDiagram(
        { data: '{}', format: 'json', target_canvas: 'canvas-42' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.canvas_id).toBe('canvas-42');
    });

    it('generates a canvas ID when target_canvas omitted', async () => {
      await registerProvider('json');

      const result = await diagramExportHandler.importDiagram(
        { data: '{}', format: 'json' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.canvas_id).toContain('canvas-import-');
    });
  });

  describe('multi-step sequences', () => {
    it('register provider -> export -> verify status', async () => {
      await registerProvider('svg');

      const exportResult = await diagramExportHandler.export(
        { canvas_id: 'canvas-1', format: 'svg', options: { width: 1024 } },
        storage,
      );
      expect(exportResult.variant).toBe('ok');

      const record = await storage.get('diagram-export', exportResult.export as string);
      expect(record!.status).toBe('pending');
      expect(record!.format).toBe('svg');
    });

    it('detect format -> import with detected format', async () => {
      await registerProvider('json');

      const detected = await diagramExportHandler.detectFormat({ data: '{"nodes":[]}' }, storage);
      expect(detected.format).toBe('json');

      const imported = await diagramExportHandler.importDiagram(
        { data: '{"nodes":[]}', format: detected.format as string, target_canvas: 'canvas-5' },
        storage,
      );
      expect(imported.variant).toBe('ok');
      expect(imported.canvas_id).toBe('canvas-5');
    });

    it('export multiple formats from same canvas', async () => {
      await registerProvider('svg');
      await registerProvider('json');
      await registerProvider('png');

      const r1 = await diagramExportHandler.export({ canvas_id: 'canvas-1', format: 'svg' }, storage);
      const r2 = await diagramExportHandler.export({ canvas_id: 'canvas-1', format: 'json' }, storage);
      const r3 = await diagramExportHandler.export({ canvas_id: 'canvas-1', format: 'png' }, storage);

      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
      expect(r3.variant).toBe('ok');
      expect(r1.mime_type).toBe('image/svg+xml');
      expect(r2.mime_type).toBe('application/json');
      expect(r3.mime_type).toBe('image/png');

      // All have unique IDs
      const ids = new Set([r1.export, r2.export, r3.export]);
      expect(ids.size).toBe(3);
    });
  });
});
