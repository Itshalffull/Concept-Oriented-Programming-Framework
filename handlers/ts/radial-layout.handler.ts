// @migrated dsl-constructs 2026-03-18
// ============================================================
// RadialLayoutProvider Handler
//
// Radial tree layout. BFS from root, concentric circles.
// O(V+E) complexity. Best for radial mind maps and
// network hop visualizations.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _radialLayoutHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'radial', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const items = input.items as string[];
    const config = (input.config as Record<string, unknown>) ?? {};
    const spacingX = (config.spacing_x as number) ?? 120;

    if (!items || items.length === 0) {
      return complete(createProgram(), 'error', { message: 'No items to layout' }) as StorageProgram<Result>;
    }

    const positions: { item_id: string; x: number; y: number }[] = [];
    const root = items[0];
    const children = items.slice(1);

    // Root at center
    positions.push({ item_id: root, x: 0, y: 0 });

    // Children on concentric circle
    if (children.length > 0) {
      const angleStep = (2 * Math.PI) / children.length;
      children.forEach((child, i) => {
        const angle = i * angleStep - Math.PI / 2;
        positions.push({
          item_id: child,
          x: Math.cos(angle) * spacingX,
          y: Math.sin(angle) * spacingX,
        });
      });
    }

    const p = createProgram();
    return complete(p, 'ok', { positions }) as StorageProgram<Result>;
  },
};

export const radialLayoutHandler = autoInterpret(_radialLayoutHandler);

export default radialLayoutHandler;
