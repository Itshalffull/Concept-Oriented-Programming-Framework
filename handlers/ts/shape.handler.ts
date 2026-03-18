// @migrated dsl-constructs 2026-03-18
// ============================================================
// Shape Handler
//
// Geometric primitives on a canvas. Each shape has a kind
// (rectangle, ellipse, triangle, etc.), fill color, stroke
// color, and optional text label.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `shape-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const fill = (input.fill as string) ?? null;
    const stroke = (input.stroke as string) ?? null;
    const text = (input.text as string) ?? null;

    const id = nextId();
    let p = createProgram();
    p = put(p, 'shape', id, {
      id,
      kind,
      fill,
      stroke,
      text,
    });

    return complete(p, 'ok', { shape: id }) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const shape = input.shape as string;

    let p = createProgram();
    p = get(p, 'shape', shape, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', {}),
      (elseP) => complete(elseP, 'notFound', { message: `Shape '${shape}' not found` }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const shape = input.shape as string;

    let p = createProgram();
    p = get(p, 'shape', shape, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, 'shape', shape);
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `Shape '${shape}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const shapeHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetShapeCounter(): void {
  idCounter = 0;
}

export default shapeHandler;
