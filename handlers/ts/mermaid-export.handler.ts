// @migrated dsl-constructs 2026-03-18
// ============================================================
// MermaidExportProvider Handler
//
// Export provider for Mermaid diagram syntax. Generates Mermaid
// text with graph TD/LR node shapes and arrow connections.
// Supports basic import parsing of Mermaid syntax.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function escapeMermaid(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/[[\]{}()]/g, '');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'mermaid', 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      (bp) => complete(bp, 'ok', { name: 'mermaid', category: 'diagram_export' }),
      (bp) => {
        const bp2 = put(bp, 'export-provider', 'mermaid', {
          id: 'mermaid',
          name: 'mermaid',
          category: 'diagram_export',
          mime_type: 'text/plain',
          supports_import: true,
        });
        return complete(bp2, 'ok', { name: 'mermaid', category: 'diagram_export' });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};
    const direction = (options.direction as string) ?? 'TD';

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      const lines: string[] = [];
      lines.push(`graph ${direction}`);

      const idMap = new Map<string, string>();
      let nodeIndex = 0;
      for (const item of items) {
        const safeId = `n${nodeIndex++}`;
        idMap.set(item.id as string, safeId);
      }

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
      return { data: output, mime_type: 'text/plain' };
    }) as StorageProgram<Result>;
  },

  importData(input: Record<string, unknown>) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    const lines = data.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Empty Mermaid data' }) as StorageProgram<Result>;
    }

    const startIndex = lines[0].startsWith('graph ') || lines[0].startsWith('flowchart ') ? 1 : 0;

    const nodes = new Map<string, string>();
    let p = createProgram();
    let connectorsCreated = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];

      const connMatch = line.match(/^\s*(\w+)\s+(?:--?>|--\s+.+\s+--?>|-\.->|-\.\s+.+\s+\.->)\s+(\w+)\s*$/);
      if (connMatch) {
        const [, source, target] = connMatch;
        if (!nodes.has(source)) nodes.set(source, source);
        if (!nodes.has(target)) nodes.set(target, target);

        const connId = `conn-${connectorsCreated}`;
        p = put(p, 'canvas-connector', connId, {
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

      const nodeMatch = line.match(/^\s*(\w+)\s*[\[({]+(.+?)[\])}]+\s*$/);
      if (nodeMatch) {
        const [, nodeId, label] = nodeMatch;
        nodes.set(nodeId, label);
      }
    }

    let itemsCreated = 0;
    for (const [nodeId, label] of nodes) {
      p = put(p, 'canvas-item', nodeId, {
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

    return complete(p, 'ok', {
      canvas_id: targetCanvas,
      items_created: itemsCreated,
      connectors_created: connectorsCreated,
    }) as StorageProgram<Result>;
  },
};

export const mermaidExportHandler = autoInterpret(_handler);

export default mermaidExportHandler;
