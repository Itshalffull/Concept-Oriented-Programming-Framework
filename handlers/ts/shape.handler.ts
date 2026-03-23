// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Shape Handler
//
// Encode the edge, corner, and clipping philosophy that gives
// a theme its geometric character. Configure shape profiles and
// resolve element-specific values.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `shape-${++idCounter}`;
}

/** Elements that support clip paths. */
const CLIP_SUPPORTED_ELEMENTS = new Set(['avatar', 'thumbnail', 'icon', 'image', 'media']);

/** Compute a border-radius value string for an element given a corner radius. */
function radiusForElement(element: string, cornerRadius: number): string {
  // Dialogs get a slightly smaller radius
  if (element === 'dialog' || element === 'modal') {
    return `${Math.max(0, cornerRadius - 2)}px`;
  }
  // Chips are more rounded
  if (element === 'chip' || element === 'badge' || element === 'tag') {
    return `${cornerRadius * 2}px`;
  }
  return `${cornerRadius}px`;
}

const _handler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const name = input.name as string;
    const config = input.config as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'shape', id, {
      id,
      name,
      config,
    });

    return complete(p, 'ok', { shapeId: id }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const shapeId = input.shapeId as string;
    const element = input.element as string;

    if (!element || element.trim() === '') {
      return complete(createProgram(), 'error', { message: 'element is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'shape', shapeId, '_shape');

    return branch(p,
      (b) => !b._shape,
      (b) => complete(b, 'notFound', { message: `Shape not found` }),
      (b) => {
        const shape = (b._shape ?? {}) as Record<string, unknown>;
        const configStr = (shape.config as string) ?? '{}';
        let cornerRadius = 4;
        try {
          const parsed = JSON.parse(configStr);
          if (typeof parsed.cornerRadius === 'number') cornerRadius = parsed.cornerRadius;
        } catch {
          // ignore parse errors, use default
        }
        const value = radiusForElement(element, cornerRadius);
        return complete(b, 'ok', { value }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  computeRadius(input: Record<string, unknown>) {
    const shapeId = input.shapeId as string;
    const element = input.element as string;

    if (!element || element.trim() === '') {
      return complete(createProgram(), 'error', { message: 'element is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'shape', shapeId, '_shape');

    return branch(p,
      (b) => !b._shape,
      (b) => {
        // Even without a stored shape, compute a default radius
        const radius = radiusForElement(element, 4);
        return complete(b, 'ok', { radius }) as StorageProgram<Result>;
      },
      (b) => {
        const shape = (b._shape ?? {}) as Record<string, unknown>;
        const configStr = (shape.config as string) ?? '{}';
        let cornerRadius = 4;
        try {
          const parsed = JSON.parse(configStr);
          if (typeof parsed.cornerRadius === 'number') cornerRadius = parsed.cornerRadius;
        } catch {
          // ignore parse errors, use default
        }
        const radius = radiusForElement(element, cornerRadius);
        return complete(b, 'ok', { radius }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  computeClipPath(input: Record<string, unknown>) {
    const shapeId = input.shapeId as string;
    const element = input.element as string;

    if (!element || element.trim() === '') {
      return complete(createProgram(), 'error', { message: 'element is required' }) as StorageProgram<Result>;
    }

    // Only certain elements support clip paths
    if (!CLIP_SUPPORTED_ELEMENTS.has(element)) {
      return complete(createProgram(), 'error', { message: `Element '${element}' does not support clip paths` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'shape', shapeId, '_shape');

    return branch(p,
      (b) => !b._shape,
      (b) => {
        // Default circle clip path
        const clipPath = 'circle(50%)';
        return complete(b, 'ok', { clipPath }) as StorageProgram<Result>;
      },
      (b) => {
        const shape = (b._shape ?? {}) as Record<string, unknown>;
        const configStr = (shape.config as string) ?? '{}';
        let cornerRadius = 4;
        try {
          const parsed = JSON.parse(configStr);
          if (typeof parsed.cornerRadius === 'number') cornerRadius = parsed.cornerRadius;
        } catch {
          // ignore parse errors
        }
        const clipPath = element === 'avatar'
          ? `circle(50%)`
          : `inset(0 round ${cornerRadius}px)`;
        return complete(b, 'ok', { clipPath }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const shapeHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetShapeCounter(): void {
  idCounter = 0;
}

export default shapeHandler;
