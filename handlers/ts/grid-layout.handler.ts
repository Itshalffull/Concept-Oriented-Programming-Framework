// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// GridLayout Handler
//
// Compute spatial positions by arranging items in a uniform grid.
// Distributes items across rows and columns with configurable
// spacing. Best for collections and galleries.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _functionalHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'grid', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Canvas identifier is required' }) as StorageProgram<Result>;
    }

    // Compute grid positions: arrange in rows with uniform cell sizing
    const columns = Math.max(Math.ceil(Math.sqrt(items.length)), 1);
    const cellWidth = 120;
    const cellHeight = 100;
    const positions = items.map((item: string, index: number) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = col * cellWidth;
      const y = row * cellHeight;
      return JSON.stringify({ item, x, y });
    });

    const p = createProgram();
    return complete(p, 'ok', { positions }) as StorageProgram<Result>;
  },
};

export const gridLayoutHandler = autoInterpret(_functionalHandler);
export default gridLayoutHandler;
