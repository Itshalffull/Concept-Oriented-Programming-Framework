// @migrated dsl-constructs 2026-03-18
// ============================================================
// SvgExportProvider Handler
//
// Export provider for SVG format. Generates SVG markup with
// items rendered as rect/circle/polygon groups and connectors
// as path elements. Supports optional data embedding.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
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

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'export-provider', 'svg', 'existing');

    return branch(p,
      (b) => !!b.existing,
      (() => {
        const t = createProgram();
        return complete(t, 'ok', { name: 'svg', category: 'diagram_export' }) as StorageProgram<Result>;
      })(),
      (() => {
        let e = createProgram();
        e = put(e, 'export-provider', 'svg', {
          id: 'svg',
          name: 'svg',
          category: 'diagram_export',
          mime_type: 'image/svg+xml',
          supports_import: false,
        });
        return complete(e, 'ok', { name: 'svg', category: 'diagram_export' }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const width = (options.width as number) ?? 800;
    const height = (options.height as number) ?? 600;
    const background = (options.background as string) ?? 'white';
    const embedData = (options.embed_data as boolean) ?? false;

    let p = createProgram();
    p = find(p, 'canvas-item', { canvas: canvasId }, 'items');
    p = find(p, 'canvas-connector', { canvas: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const connectors = bindings.connectors as Record<string, unknown>[];

      const parts: string[] = [];

      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
      parts.push(`  <rect width="100%" height="100%" fill="${escapeXml(background)}" />`);

      if (embedData) {
        const payload = JSON.stringify({ canvas: canvasId, items, connectors });
        parts.push(`  <!-- clef-data: ${escapeXml(payload)} -->`);
      }

      for (const conn of connectors) {
        const sourceItem = items.find((i) => i.id === conn.source);
        const targetItem = items.find((i) => i.id === conn.target);

        if (sourceItem && targetItem) {
          const sx = ((sourceItem.x as number) ?? 0) + (((sourceItem.width as number) ?? 100) / 2);
          const sy = ((sourceItem.y as number) ?? 0) + (((sourceItem.height as number) ?? 60) / 2);
          const tx = ((targetItem.x as number) ?? 0) + (((targetItem.width as number) ?? 100) / 2);
          const ty = ((targetItem.y as number) ?? 0) + (((targetItem.height as number) ?? 60) / 2);

          const style = (conn.style as string) ?? 'solid';
          const strokeDash = style === 'dashed' ? ' stroke-dasharray="5,5"' : '';
          parts.push(`  <path d="M${sx},${sy} L${tx},${ty}" stroke="#333" stroke-width="1.5" fill="none"${strokeDash} />`);

          if (conn.label) {
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2;
            parts.push(`  <text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#666">${escapeXml(conn.label as string)}</text>`);
          }
        }
      }

      for (const item of items) {
        const x = (item.x as number) ?? 0;
        const y = (item.y as number) ?? 0;
        const w = (item.width as number) ?? 100;
        const h = (item.height as number) ?? 60;
        const label = (item.label as string) ?? '';
        const shape = (item.shape as string) ?? 'rectangle';

        parts.push(`  <g transform="translate(${x},${y})">`);

        switch (shape) {
          case 'ellipse':
          case 'circle':
            parts.push(`    <ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#e3f2fd" stroke="#1976d2" stroke-width="1.5" />`);
            break;
          case 'diamond':
            parts.push(`    <polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="#fff3e0" stroke="#e65100" stroke-width="1.5" />`);
            break;
          case 'triangle':
            parts.push(`    <polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="#f3e5f5" stroke="#7b1fa2" stroke-width="1.5" />`);
            break;
          default:
            parts.push(`    <rect width="${w}" height="${h}" rx="4" fill="#e8f5e9" stroke="#388e3c" stroke-width="1.5" />`);
            break;
        }

        if (label) {
          parts.push(`    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#212121">${escapeXml(label)}</text>`);
        }

        parts.push('  </g>');
      }

      parts.push('</svg>');

      const output = parts.join('\n');
      return { data: output, mime_type: 'image/svg+xml' };
    }) as StorageProgram<Result>;
  },
};

export const svgExportHandler = autoInterpret(_handler);

export default svgExportHandler;
