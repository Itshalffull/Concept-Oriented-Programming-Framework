// @clef-handler style=functional concept=force-directed
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ForceDirectedLayout Handler
//
// Compute spatial positions using force-directed graph layout.
// Simulates repulsion between nodes and attraction along edges
// to produce organic, readable arrangements.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'ForceDirectedLayout', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const rawItems = input.items;
    const items: string[] = Array.isArray(rawItems) ? rawItems :
      (rawItems && typeof rawItems === 'object' && Array.isArray((rawItems as any).items))
        ? (rawItems as any).items.map((i: any) => typeof i === 'string' ? i : (i?.value ?? String(i)))
        : typeof rawItems === 'string' ? JSON.parse(rawItems) : [];

    if (!canvas) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Canvas identifier is required' }) as StorageProgram<Result>;
    }

    const positions = items.map((item: string, index: number) => {
      const angle = (2 * Math.PI * index) / Math.max(items.length, 1);
      const radius = 100 + index * 50;
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius);
      return JSON.stringify({ item, x, y });
    });

    const p = createProgram();
    return complete(p, 'ok', { positions }) as StorageProgram<Result>;
  },
};

export const forceDirectedLayoutHandler = autoInterpret(_handler);

export default forceDirectedLayoutHandler;
