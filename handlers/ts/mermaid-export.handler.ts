// ============================================================
// MermaidExportProvider Handler
//
// Export provider for Mermaid diagram syntax. Generates Mermaid
// text with graph TD/LR node shapes and arrow connections.
// Supports basic import parsing of Mermaid syntax.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const mermaidExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'mermaid');
    if (existing) {
      return { variant: 'ok', name: 'mermaid', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'mermaid', {
      id: 'mermaid',
      name: 'mermaid',
      category: 'diagram_export',
      mime_type: 'text/plain',
      supports_import: true,
    });

    return { variant: 'ok', name: 'mermaid', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const direction = (options.direction as string) ?? 'TD';

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const lines: string[] = [];
    lines.push(`graph ${direction}`);

    // Build node-id to safe-identifier map
    const idMap = new Map<string, string>();
    let nodeIndex = 0;
    for (const item of items) {
      const safeId = `n${nodeIndex++}`;
      idMap.set(item.id as string, safeId);
    }

    // Emit node definitions with shape syntax
    for (const item of items) {
      const safeId = idMap.get(item.id as string) ?? (item.id as string);
      const label = (item.label as string) ?? (item.id as string);
      const shape = (item.shape as string) ?? 'rectangle';

      let nodeDef: string;
      switch (shape) {
        case 'circle':
        case 'ellipse':
          nodeDef = `  ${safeId}((${escapeMermaid(label)}))`;
          break;
        case 'diamond':
          nodeDef = `  ${safeId}{${escapeMermaid(label)}}`;
          break;
        case 'rounded':
          nodeDef = `  ${safeId}(${escapeMermaid(label)})`;
          break;
        case 'hexagon':
          nodeDef = `  ${safeId}{{${escapeMermaid(label)}}}`;
          break;
        default:
          nodeDef = `  ${safeId}[${escapeMermaid(label)}]`;
          break;
      }
      lines.push(nodeDef);
    }

    // Emit connections
    for (const conn of connectors) {
      const sourceId = idMap.get(conn.source as string);
      const targetId = idMap.get(conn.target as string);
      if (!sourceId || !targetId) continue;

      const label = conn.label as string | undefined;
      const style = (conn.style as string) ?? 'solid';

      let arrow: string;
      if (style === 'dashed') {
        arrow = label ? `-. ${escapeMermaid(label)} .->` : '-.->';
      } else {
        arrow = label ? `-- ${escapeMermaid(label)} -->` : '-->';
      }

      lines.push(`  ${sourceId} ${arrow} ${targetId}`);
    }

    const output = lines.join('\n');
    return { variant: 'ok', data: output, mime_type: 'text/plain' };
  },

  async importData(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    const lines = data.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      return { variant: 'error', message: 'Empty Mermaid data' };
    }

    // Skip the graph direction header
    const startIndex = lines[0].startsWith('graph ') || lines[0].startsWith('flowchart ') ? 1 : 0;

    const nodes = new Map<string, string>(); // safeId -> label
    let itemsCreated = 0;
    let connectorsCreated = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];

      // Try to match connection: A --> B or A -- label --> B
      const connMatch = line.match(/^\s*(\w+)\s+(?:--?>|--\s+.+\s+--?>|-\.->|-\.\s+.+\s+\.->)\s+(\w+)\s*$/);
      if (connMatch) {
        const [, source, target] = connMatch;
        // Ensure source/target nodes exist
        if (!nodes.has(source)) {
          nodes.set(source, source);
        }
        if (!nodes.has(target)) {
          nodes.set(target, target);
        }

        const connId = `conn-${connectorsCreated}`;
        await storage.put('canvas-connector', connId, {
          id: connId,
          canvas: targetCanvas,
          source,
          target,
          label: null,
          style: line.includes('-.') ? 'dashed' : 'solid',
        });
        connectorsCreated++;
        continue;
      }

      // Try to match node definition: A[Label] or A((Label)) etc.
      const nodeMatch = line.match(/^\s*(\w+)\s*[\[({]+(.+?)[\])}]+\s*$/);
      if (nodeMatch) {
        const [, nodeId, label] = nodeMatch;
        nodes.set(nodeId, label);
      }
    }

    // Create canvas items for all discovered nodes
    for (const [nodeId, label] of nodes) {
      await storage.put('canvas-item', nodeId, {
        id: nodeId,
        canvas: targetCanvas,
        kind: 'node',
        x: itemsCreated * 150,
        y: 0,
        width: 120,
        height: 60,
        label,
        shape: 'rectangle',
      });
      itemsCreated++;
    }

    return {
      variant: 'ok',
      canvas_id: targetCanvas,
      items_created: itemsCreated,
      connectors_created: connectorsCreated,
    };
  },
};

function escapeMermaid(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/[[\]{}()]/g, '');
}

export default mermaidExportHandler;
