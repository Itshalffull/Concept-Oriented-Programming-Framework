// ============================================================
// DrawioXmlExportProvider Handler
//
// Export provider for draw.io (diagrams.net) mxGraphModel XML
// format. Generates mxfile XML with mxCell elements for items
// and connectors. Supports import of mxGraphModel XML.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const drawioXmlExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'drawio-xml');
    if (existing) {
      return { variant: 'ok', name: 'drawio-xml', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'drawio-xml', {
      id: 'drawio-xml',
      name: 'drawio-xml',
      category: 'diagram_export',
      mime_type: 'application/xml',
      supports_import: true,
    });

    return { variant: 'ok', name: 'drawio-xml', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const parts: string[] = [];

    // mxfile root
    parts.push('<mxfile>');
    parts.push('  <diagram name="Page-1">');
    parts.push('    <mxGraphModel>');
    parts.push('      <root>');

    // Root cells (required by draw.io format)
    parts.push('        <mxCell id="0" />');
    parts.push('        <mxCell id="1" parent="0" />');

    // Emit vertex cells for canvas items
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

    // Emit edge cells for connectors
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
    return { variant: 'ok', data: output, mime_type: 'application/xml' };
  },

  async importData(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    let itemsCreated = 0;
    let connectorsCreated = 0;

    // Parse vertex cells (items)
    const vertexPattern = /<mxCell\s+id="(\d+)"\s+value="([^"]*)"[^>]*vertex="1"[^>]*>[\s\S]*?<mxGeometry\s+x="([^"]*)" y="([^"]*)" width="([^"]*)" height="([^"]*)"[^>]*\/>[\s\S]*?<\/mxCell>/g;
    const drawioIdMap = new Map<string, string>(); // drawio cell id -> canvas item id

    let match: RegExpExecArray | null;
    while ((match = vertexPattern.exec(data)) !== null) {
      const [, cellId, label, x, y, w, h] = match;
      const itemId = `item-${itemsCreated}`;
      drawioIdMap.set(cellId, itemId);

      await storage.put('canvas-item', itemId, {
        id: itemId,
        canvas: targetCanvas,
        kind: 'node',
        x: parseFloat(x),
        y: parseFloat(y),
        width: parseFloat(w),
        height: parseFloat(h),
        label: unescapeXml(label),
        shape: 'rectangle',
      });
      itemsCreated++;
    }

    // Parse edge cells (connectors)
    const edgePattern = /<mxCell\s+id="(\d+)"\s+value="([^"]*)"[^>]*edge="1"[^>]*source="(\d+)"[^>]*target="(\d+)"[^>]*/g;

    while ((match = edgePattern.exec(data)) !== null) {
      const [fullMatch, cellId, label, sourceCell, targetCell] = match;
      const sourceItem = drawioIdMap.get(sourceCell);
      const targetItem = drawioIdMap.get(targetCell);
      if (!sourceItem || !targetItem) continue;

      const connId = `conn-${connectorsCreated}`;
      const style = fullMatch.includes('dashed=1') ? 'dashed' : 'solid';

      await storage.put('canvas-connector', connId, {
        id: connId,
        canvas: targetCanvas,
        source: sourceItem,
        target: targetItem,
        label: unescapeXml(label) || null,
        style,
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

export default drawioXmlExportHandler;
