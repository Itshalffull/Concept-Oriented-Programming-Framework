// @migrated dsl-constructs 2026-03-18
// ============================================================
// CircularLayout Handler
//
// Compute spatial positions by arranging items in a circle.
// Distributes items evenly around a central point with
// configurable radius. Best for peer relationships and rings.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'circular', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Canvas identifier is required' }) as StorageProgram<Result>;
    }

    const radius = 200;
    const positions = items.map((item: string, index: number) => {
      const angle = (2 * Math.PI * index) / Math.max(items.length, 1);
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius);
      return JSON.stringify({ item, x, y });
    });

    const p = createProgram();
    return complete(p, 'ok', { positions }) as StorageProgram<Result>;
  },
};

export const circularLayoutHandler = autoInterpret(_handler);

export default circularLayoutHandler;
