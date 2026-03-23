// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DrawioXmlExportProvider Handler
//
// Export provider for draw.io (diagrams.net) mxGraphModel XML
// format. Generates mxfile XML with mxCell elements for items
// and connectors. Supports import of mxGraphModel XML.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function mapShapeToDrawioStyle(shape: string): string {
  const styleMap: Record<string, string> = {
    rectangle: 'rounded=0;whiteSpace=wrap;html=1;',
    rounded: 'rounded=1;whiteSpace=wrap;html=1;',
    circle: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;',
    ellipse: 'ellipse;whiteSpace=wrap;html=1;',
    diamond: 'rhombus;whiteSpace=wrap;html=1;',
    triangle: 'triangle;whiteSpace=wrap;html=1;',
    hexagon: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
    cylinder: 'shape=cylinder3;whiteSpace=wrap;html=1;',
    cloud: 'ellipse;shape=cloud;whiteSpace=wrap;html=1;',
  };
  return styleMap[shape] ?? 'rounded=0;whiteSpace=wrap;html=1;';
}

/**
 * Parse draw.io XML and extract vertices and edges.
 */
function parseDrawioXml(data: string): {
  vertices: Array<{ cellId: string; label: string; x: number; y: number; w: number; h: number }>;
  edges: Array<{ cellId: string; label: string; sourceCell: string; targetCell: string; dashed: boolean }>;
} {
  const vertices: Array<{ cellId: string; label: string; x: number; y: number; w: number; h: number }> = [];
  const edges: Array<{ cellId: string; label: string; sourceCell: string; targetCell: string; dashed: boolean }> = [];

  const vertexPattern = /<mxCell\s+id="(\d+)"\s+value="([^"]*)"[^>]*vertex="1"[^>]*>[\s\S]*?<mxGeometry\s+x="([^"]*)" y="([^"]*)" width="([^"]*)" height="([^"]*)"[^>]*\/>[\s\S]*?<\/mxCell>/g;
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(data)) !== null) {
    const [, cellId, label, x, y, w, h] = match;
    vertices.push({
      cellId,
      label: unescapeXml(label),
      x: parseFloat(x),
      y: parseFloat(y),
      w: parseFloat(w),
      h: parseFloat(h),
    });
  }

  const edgePattern = /<mxCell\s+id="(\d+)"\s+value="([^"]*)"[^>]*edge="1"[^>]*source="(\d+)"[^>]*target="(\d+)"[^>]*/g;
  while ((match = edgePattern.exec(data)) !== null) {
    const [fullMatch, cellId, label, sourceCell, targetCell] = match;
    edges.push({
      cellId,
      label: unescapeXml(label),
      sourceCell,
      targetCell,
      dashed: fullMatch.includes('dashed=1'),
    });
  }

  return { vertices, edges };
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'drawio-xml', 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'ok', { name: 'drawio-xml', category: 'diagram_export' }),
      (elseP) => {
        elseP = put(elseP, 'export-provider', 'drawio-xml', {
          id: 'drawio-xml',
          name: 'drawio-xml',
          category: 'diagram_export',
          mime_type: 'application/xml',
          supports_import: true,
        });
        return complete(elseP, 'ok', { name: 'drawio-xml', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      const parts: string[] = [];
      parts.push('<mxfile>');
      parts.push('  <diagram name="Page-1">');
      parts.push('    <mxGraphModel>');
      parts.push('      <root>');
      parts.push('        <mxCell id="0" />');
      parts.push('        <mxCell id="1" parent="0" />');

      let cellId = 2;
      const idMap = new Map<string, number>();

      for (const item of items) {
        const id = cellId++;
        idMap.set(item.id as string, id);

        const x = (item.x as number) ?? 0;
        const y = (item.y as number) ?? 0;
        const w = (item.width as number) ?? 120;
        const h = (item.height as number) ?? 60;
        const label = (item.label as string) ?? '';
        const shape = (item.shape as string) ?? 'rectangle';
        const style = mapShapeToDrawioStyle(shape);

        parts.push(`        <mxCell id="${id}" value="${escapeXml(label)}" style="${style}" vertex="1" parent="1">`);
        parts.push(`          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />`);
        parts.push('        </mxCell>');
      }

      for (const conn of connectors) {
        const id = cellId++;
        const sourceId = idMap.get(conn.source as string);
        const targetId = idMap.get(conn.target as string);
        if (sourceId === undefined || targetId === undefined) continue;

        const label = (conn.label as string) ?? '';
        const style = (conn.style as string) === 'dashed'
          ? 'edgeStyle=orthogonalEdgeStyle;dashed=1;'
          : 'edgeStyle=orthogonalEdgeStyle;';

        parts.push(`        <mxCell id="${id}" value="${escapeXml(label)}" style="${style}" edge="1" parent="1" source="${sourceId}" target="${targetId}">`);
        parts.push('          <mxGeometry relative="1" as="geometry" />');
        parts.push('        </mxCell>');
      }

      parts.push('      </root>');
      parts.push('    </mxGraphModel>');
      parts.push('  </diagram>');
      parts.push('</mxfile>');

      const output = parts.join('\n');
      return { data: output, mime_type: 'application/xml' };
    }) as StorageProgram<Result>;
  },

  importData(input: Record<string, unknown>) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    const { vertices, edges } = parseDrawioXml(data);

    let p = createProgram();
    const drawioIdMap = new Map<string, string>();

    let itemsCreated = 0;
    for (const v of vertices) {
      const itemId = `item-${itemsCreated}`;
      drawioIdMap.set(v.cellId, itemId);

      p = put(p, 'canvas-item', itemId, {
        id: itemId,
        canvas: targetCanvas,
        kind: 'node',
        x: v.x,
        y: v.y,
        width: v.w,
        height: v.h,
        label: v.label,
        shape: 'rectangle',
      });
      itemsCreated++;
    }

    let connectorsCreated = 0;
    for (const e of edges) {
      const sourceItem = drawioIdMap.get(e.sourceCell);
      const targetItem = drawioIdMap.get(e.targetCell);
      if (!sourceItem || !targetItem) continue;

      const connId = `conn-${connectorsCreated}`;
      p = put(p, 'canvas-connector', connId, {
        id: connId,
        canvas: targetCanvas,
        source: sourceItem,
        target: targetItem,
        label: e.label || null,
        style: e.dashed ? 'dashed' : 'solid',
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

export const drawioXmlExportHandler = autoInterpret(_handler);

export default drawioXmlExportHandler;
