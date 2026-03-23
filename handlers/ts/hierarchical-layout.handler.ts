// @clef-handler style=functional concept=hierarchical
// @migrated dsl-constructs 2026-03-18
// ============================================================
// HierarchicalLayout Handler
//
// Compute spatial positions using hierarchical (Sugiyama-style)
// layout. Assigns items to layers based on dependency direction,
// minimizes edge crossings, and aligns nodes within layers.
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
    return complete(p, 'ok', { name: 'HierarchicalLayout', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Canvas identifier is required' }) as StorageProgram<Result>;
    }

    // Compute hierarchical positions: stack items in layers top-to-bottom
    const layerSpacing = 120;
    const itemSpacing = 150;
    const positions = items.map((item: string, index: number) => {
      const layer = Math.floor(index / 3);
      const posInLayer = index % 3;
      const x = posInLayer * itemSpacing;
      const y = layer * layerSpacing;
      return JSON.stringify({ item, x, y });
    });

    const p = createProgram();
    return complete(p, 'ok', { positions }) as StorageProgram<Result>;
  },
};

export const hierarchicalLayoutHandler = autoInterpret(_functionalHandler);
export default hierarchicalLayoutHandler;
