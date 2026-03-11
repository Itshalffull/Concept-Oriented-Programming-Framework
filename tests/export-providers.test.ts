// Export provider handler tests -- register() and export() for all 9 export providers.
// Each provider serializes canvas items and connectors to its target format.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { jsonExportHandler } from '../handlers/ts/json-export.handler.js';
import { svgExportHandler } from '../handlers/ts/svg-export.handler.js';
import { pngExportHandler, resetPngExportCounter } from '../handlers/ts/png-export.handler.js';
import { pdfExportHandler, resetPdfExportCounter } from '../handlers/ts/pdf-export.handler.js';
import { mermaidExportHandler } from '../handlers/ts/mermaid-export.handler.js';
import { d2ExportHandler } from '../handlers/ts/d2-export.handler.js';
import { dotExportHandler } from '../handlers/ts/dot-export.handler.js';
import { bpmnXmlExportHandler } from '../handlers/ts/bpmn-xml-export.handler.js';
import { drawioXmlExportHandler } from '../handlers/ts/drawio-xml-export.handler.js';

/** Wrap in-memory storage with a `list` method used by diagramming handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

/** Seed mock canvas data for export tests. */
async function seedCanvasData(storage: ReturnType<typeof createTestStorage>, canvasId = 'canvas-1') {
  await storage.put('canvas-item', 'item-1', {
    id: 'item-1',
    canvas: canvasId,
    kind: 'node',
    x: 100,
    y: 50,
    width: 120,
    height: 60,
    label: 'Start',
    shape: 'circle',
  });
  await storage.put('canvas-item', 'item-2', {
    id: 'item-2',
    canvas: canvasId,
    kind: 'node',
    x: 300,
    y: 50,
    width: 120,
    height: 60,
    label: 'Process',
    shape: 'rectangle',
  });
  await storage.put('canvas-item', 'item-3', {
    id: 'item-3',
    canvas: canvasId,
    kind: 'node',
    x: 500,
    y: 50,
    width: 120,
    height: 60,
    label: 'Decision',
    shape: 'diamond',
  });
  await storage.put('canvas-connector', 'conn-1', {
    id: 'conn-1',
    canvas: canvasId,
    source: 'item-1',
    target: 'item-2',
    label: 'next',
    style: 'solid',
  });
  await storage.put('canvas-connector', 'conn-2', {
    id: 'conn-2',
    canvas: canvasId,
    source: 'item-2',
    target: 'item-3',
    label: null,
    style: 'dashed',
  });
}

// ============================================================
// JSON Export
// ============================================================

describe('JsonExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant and correct category', async () => {
      const result = await jsonExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('json');
      expect(result.category).toBe('diagram_export');
    });

    it('stores provider in export-provider relation', async () => {
      await jsonExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'json');
      expect(record).not.toBeNull();
      expect(record!.mime_type).toBe('application/json');
      expect(record!.supports_import).toBe(true);
    });

    it('is idempotent', async () => {
      await jsonExportHandler.register({}, storage);
      const r2 = await jsonExportHandler.register({}, storage);
      expect(r2.variant).toBe('ok');
    });
  });

  describe('export', () => {
    it('exports canvas data as JSON', async () => {
      await seedCanvasData(storage);
      const result = await jsonExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('application/json');

      const doc = JSON.parse(result.data as string);
      expect(doc.canvas).toBe('canvas-1');
      expect(doc.items).toHaveLength(3);
      expect(doc.connectors).toHaveLength(2);
    });

    it('returns empty items for non-existent canvas', async () => {
      const result = await jsonExportHandler.export({ canvas_id: 'missing' }, storage);
      expect(result.variant).toBe('ok');

      const doc = JSON.parse(result.data as string);
      expect(doc.items).toHaveLength(0);
      expect(doc.connectors).toHaveLength(0);
    });

    it('includes item fields in output', async () => {
      await seedCanvasData(storage);
      const result = await jsonExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const doc = JSON.parse(result.data as string);
      const first = doc.items[0];
      expect(first.id).toBe('item-1');
      expect(first.label).toBe('Start');
      expect(first.x).toBe(100);
      expect(first.y).toBe(50);
    });

    it('includes connector fields in output', async () => {
      await seedCanvasData(storage);
      const result = await jsonExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const doc = JSON.parse(result.data as string);
      const first = doc.connectors[0];
      expect(first.source).toBe('item-1');
      expect(first.target).toBe('item-2');
      expect(first.label).toBe('next');
    });
  });
});

// ============================================================
// SVG Export
// ============================================================

describe('SvgExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await svgExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('svg');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await svgExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'svg');
      expect(record!.mime_type).toBe('image/svg+xml');
    });
  });

  describe('export', () => {
    it('generates valid SVG markup', async () => {
      await seedCanvasData(storage);
      const result = await svgExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('image/svg+xml');
      expect(result.data).toContain('<svg');
      expect(result.data).toContain('</svg>');
    });

    it('includes items as shape groups', async () => {
      await seedCanvasData(storage);
      const result = await svgExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('Start');
      expect(data).toContain('Process');
      expect(data).toContain('Decision');
    });

    it('includes connectors as path elements', async () => {
      await seedCanvasData(storage);
      const result = await svgExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('<path');
      expect(data).toContain('next');
    });

    it('renders circle shape for ellipse/circle items', async () => {
      await seedCanvasData(storage);
      const result = await svgExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('<ellipse');
    });

    it('renders polygon for diamond items', async () => {
      await seedCanvasData(storage);
      const result = await svgExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('<polygon');
    });

    it('returns empty SVG for non-existent canvas', async () => {
      const result = await svgExportHandler.export({ canvas_id: 'empty' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.data).toContain('<svg');
      expect(result.data).not.toContain('<g');
    });
  });
});

// ============================================================
// PNG Export
// ============================================================

describe('PngExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetPngExportCounter();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await pngExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('png');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await pngExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'png');
      expect(record!.mime_type).toBe('image/png');
    });
  });

  describe('export', () => {
    it('returns metadata for client-side rasterization', async () => {
      await seedCanvasData(storage);
      const result = await pngExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('image/png');
      expect(result.data).toBeNull();
      expect(result.export_id).toBe('png-export-1');
      expect(result.metadata).toBeDefined();
    });

    it('stores pending rasterization metadata', async () => {
      await seedCanvasData(storage);
      await pngExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const meta = await storage.get('png-export-metadata', 'png-export-1');
      expect(meta).not.toBeNull();
      expect(meta!.status).toBe('pending_rasterization');
      expect(meta!.item_count).toBe(3);
      expect(meta!.connector_count).toBe(2);
    });

    it('uses default dimensions', async () => {
      await seedCanvasData(storage);
      const result = await pngExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const meta = result.metadata as Record<string, unknown>;
      expect(meta.width).toBe(1024);
      expect(meta.height).toBe(768);
      expect(meta.scale).toBe(2);
    });

    it('accepts custom options', async () => {
      await seedCanvasData(storage);
      const result = await pngExportHandler.export(
        { canvas_id: 'canvas-1', options: { width: 1920, height: 1080, scale: 3 } },
        storage,
      );
      const meta = result.metadata as Record<string, unknown>;
      expect(meta.width).toBe(1920);
      expect(meta.height).toBe(1080);
      expect(meta.scale).toBe(3);
    });
  });
});

// ============================================================
// PDF Export
// ============================================================

describe('PdfExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetPdfExportCounter();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await pdfExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('pdf');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await pdfExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'pdf');
      expect(record!.mime_type).toBe('application/pdf');
    });
  });

  describe('export', () => {
    it('returns metadata for external PDF generation', async () => {
      await seedCanvasData(storage);
      const result = await pdfExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('application/pdf');
      expect(result.data).toBeNull();
      expect(result.export_id).toBe('pdf-export-1');
    });

    it('stores pending generation metadata', async () => {
      await seedCanvasData(storage);
      await pdfExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const meta = await storage.get('pdf-export-metadata', 'pdf-export-1');
      expect(meta).not.toBeNull();
      expect(meta!.status).toBe('pending_generation');
      expect(meta!.item_count).toBe(3);
    });

    it('uses default page settings', async () => {
      await seedCanvasData(storage);
      const result = await pdfExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const meta = result.metadata as Record<string, unknown>;
      expect(meta.page_size).toBe('A4');
      expect(meta.orientation).toBe('landscape');
      expect(meta.margin).toBe(20);
    });

    it('accepts custom page options', async () => {
      await seedCanvasData(storage);
      const result = await pdfExportHandler.export(
        { canvas_id: 'canvas-1', options: { page_size: 'Letter', orientation: 'portrait', margin: 30 } },
        storage,
      );
      const meta = result.metadata as Record<string, unknown>;
      expect(meta.page_size).toBe('Letter');
      expect(meta.orientation).toBe('portrait');
      expect(meta.margin).toBe(30);
    });
  });
});

// ============================================================
// Mermaid Export
// ============================================================

describe('MermaidExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await mermaidExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('mermaid');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await mermaidExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'mermaid');
      expect(record!.mime_type).toBe('text/plain');
      expect(record!.supports_import).toBe(true);
    });
  });

  describe('export', () => {
    it('generates Mermaid syntax', async () => {
      await seedCanvasData(storage);
      const result = await mermaidExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('text/plain');
      const data = result.data as string;
      expect(data).toContain('graph TD');
    });

    it('maps circle shape to ((...)) syntax', async () => {
      await seedCanvasData(storage);
      const result = await mermaidExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('((');
    });

    it('maps diamond shape to {...} syntax', async () => {
      await seedCanvasData(storage);
      const result = await mermaidExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('{Decision}');
    });

    it('includes labeled edges', async () => {
      await seedCanvasData(storage);
      const result = await mermaidExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('next');
    });

    it('renders dashed edges with dotted arrow syntax', async () => {
      await seedCanvasData(storage);
      const result = await mermaidExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('-.->');
    });

    it('returns empty graph for non-existent canvas', async () => {
      const result = await mermaidExportHandler.export({ canvas_id: 'empty' }, storage);
      expect(result.variant).toBe('ok');
      const data = result.data as string;
      expect(data).toBe('graph TD');
    });
  });
});

// ============================================================
// D2 Export
// ============================================================

describe('D2ExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await d2ExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('d2');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await d2ExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'd2');
      expect(record!.mime_type).toBe('text/plain');
    });
  });

  describe('export', () => {
    it('generates D2 syntax with node declarations', async () => {
      await seedCanvasData(storage);
      const result = await d2ExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      const data = result.data as string;
      expect(data).toContain('Start');
      expect(data).toContain('Process');
      expect(data).toContain('Decision');
    });

    it('includes connection arrows', async () => {
      await seedCanvasData(storage);
      const result = await d2ExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('->');
    });

    it('includes labeled connections', async () => {
      await seedCanvasData(storage);
      const result = await d2ExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('next');
    });

    it('includes shape declarations for known shapes', async () => {
      await seedCanvasData(storage);
      const result = await d2ExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('.shape: circle');
      expect(data).toContain('.shape: rectangle');
      expect(data).toContain('.shape: diamond');
    });

    it('supports direction option', async () => {
      await seedCanvasData(storage);
      const result = await d2ExportHandler.export(
        { canvas_id: 'canvas-1', options: { direction: 'right' } },
        storage,
      );
      const data = result.data as string;
      expect(data).toContain('direction: right');
    });
  });
});

// ============================================================
// DOT Export
// ============================================================

describe('DotExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await dotExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('dot');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await dotExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'dot');
      expect(record!.mime_type).toBe('text/vnd.graphviz');
      expect(record!.supports_import).toBe(true);
    });
  });

  describe('export', () => {
    it('generates valid DOT digraph', async () => {
      await seedCanvasData(storage);
      const result = await dotExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      const data = result.data as string;
      expect(data).toContain('digraph');
      expect(data).toContain('{');
      expect(data).toContain('}');
    });

    it('includes node definitions with labels and shapes', async () => {
      await seedCanvasData(storage);
      const result = await dotExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('label="Start"');
      expect(data).toContain('shape=circle');
      expect(data).toContain('shape=box');
      expect(data).toContain('shape=diamond');
    });

    it('includes edge definitions', async () => {
      await seedCanvasData(storage);
      const result = await dotExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('->');
      expect(data).toContain('label="next"');
    });

    it('renders dashed edges with style attribute', async () => {
      await seedCanvasData(storage);
      const result = await dotExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('style=dashed');
    });

    it('supports rankdir option', async () => {
      await seedCanvasData(storage);
      const result = await dotExportHandler.export(
        { canvas_id: 'canvas-1', options: { rankdir: 'LR' } },
        storage,
      );
      const data = result.data as string;
      expect(data).toContain('rankdir=LR');
    });
  });
});

// ============================================================
// BPMN XML Export
// ============================================================

describe('BpmnXmlExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await bpmnXmlExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('bpmn-xml');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await bpmnXmlExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'bpmn-xml');
      expect(record!.mime_type).toBe('application/xml');
      expect(record!.supports_import).toBe(true);
    });
  });

  describe('export', () => {
    it('generates valid BPMN XML', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('application/xml');
      const data = result.data as string;
      expect(data).toContain('<?xml');
      expect(data).toContain('bpmn:definitions');
      expect(data).toContain('bpmn:process');
    });

    it('includes BPMN elements for canvas items', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('name="Start"');
      expect(data).toContain('name="Process"');
      expect(data).toContain('name="Decision"');
    });

    it('maps circle shape to startEvent', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('bpmn:startEvent');
    });

    it('maps diamond shape to exclusiveGateway', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('bpmn:exclusiveGateway');
    });

    it('includes sequence flows', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('bpmn:sequenceFlow');
      expect(data).toContain('sourceRef=');
      expect(data).toContain('targetRef=');
    });

    it('includes BPMNDI layout data', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('bpmndi:BPMNDiagram');
      expect(data).toContain('bpmndi:BPMNShape');
      expect(data).toContain('dc:Bounds');
    });

    it('includes edge waypoints', async () => {
      await seedCanvasData(storage);
      const result = await bpmnXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('bpmndi:BPMNEdge');
      expect(data).toContain('di:waypoint');
    });
  });
});

// ============================================================
// Draw.io XML Export
// ============================================================

describe('DrawioXmlExportProvider', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('register', () => {
    it('registers with ok variant', async () => {
      const result = await drawioXmlExportHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('drawio-xml');
      expect(result.category).toBe('diagram_export');
    });

    it('stores correct mime type', async () => {
      await drawioXmlExportHandler.register({}, storage);
      const record = await storage.get('export-provider', 'drawio-xml');
      expect(record!.mime_type).toBe('application/xml');
      expect(record!.supports_import).toBe(true);
    });
  });

  describe('export', () => {
    it('generates valid mxfile XML', async () => {
      await seedCanvasData(storage);
      const result = await drawioXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.mime_type).toBe('application/xml');
      const data = result.data as string;
      expect(data).toContain('<mxfile>');
      expect(data).toContain('</mxfile>');
      expect(data).toContain('mxGraphModel');
    });

    it('includes root cells', async () => {
      await seedCanvasData(storage);
      const result = await drawioXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('<mxCell id="0"');
      expect(data).toContain('<mxCell id="1"');
    });

    it('includes vertex cells for items', async () => {
      await seedCanvasData(storage);
      const result = await drawioXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('vertex="1"');
      expect(data).toContain('value="Start"');
      expect(data).toContain('value="Process"');
      expect(data).toContain('value="Decision"');
    });

    it('includes geometry for items', async () => {
      await seedCanvasData(storage);
      const result = await drawioXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('mxGeometry');
      expect(data).toContain('x="100"');
      expect(data).toContain('width="120"');
    });

    it('includes edge cells for connectors', async () => {
      await seedCanvasData(storage);
      const result = await drawioXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('edge="1"');
      expect(data).toContain('value="next"');
    });

    it('renders dashed connectors with dashed=1 style', async () => {
      await seedCanvasData(storage);
      const result = await drawioXmlExportHandler.export({ canvas_id: 'canvas-1' }, storage);
      const data = result.data as string;
      expect(data).toContain('dashed=1');
    });

    it('returns minimal mxfile for empty canvas', async () => {
      const result = await drawioXmlExportHandler.export({ canvas_id: 'empty' }, storage);
      expect(result.variant).toBe('ok');
      const data = result.data as string;
      expect(data).toContain('<mxfile>');
      expect(data).toContain('<mxCell id="0"');
      expect(data).not.toContain('vertex="1"');
    });
  });
});
