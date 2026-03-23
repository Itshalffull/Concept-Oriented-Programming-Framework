// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Frame Handler
//
// Rectangular grouping regions on a canvas. Frames have spatial
// bounds (x, y, width, height), contain items, and support
// background customization.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `frame-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const canvas = (input.canvas as string) ?? 'canvas';
    const x = (input.x as number) ?? 0;
    const y = (input.y as number) ?? 0;
    const width = input.width as number;
    const height = input.height as number;
    const name = ((input.name as string) ?? (input.label as string)) ?? '';

    const id = nextId();
    let p = createProgram();
    p = put(p, 'frame', id, {
      id,
      frame: id,
      frame_canvas: canvas,
      frame_name: name,
      x,
      y,
      width,
      height,
      label: name,
      name,
      background: null,
    });
    p = put(p, 'frame_items', id, { id, items: [] });

    return complete(p, 'ok', { frame: id }) as StorageProgram<Result>;
  },

  resize(input: Record<string, unknown>) {
    const frame = input.frame as string;
    const width = input.width as number;
    const height = input.height as number;

    let p = createProgram();
    p = get(p, 'frame', frame, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'frame', frame, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, width, height };
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `Frame '${frame}' not found` }),
    ) as StorageProgram<Result>;
  },

  addItem(input: Record<string, unknown>) {
    if (!input.frame || (typeof input.frame === 'string' && (input.frame as string).trim() === '')) {
      return complete(createProgram(), 'notFound', { message: 'frame is required' }) as StorageProgram<Result>;
    }
    const frame = input.frame as string;
    const item = ((input.item_id as string) ?? (input.item as string));

    let p = createProgram();
    p = get(p, 'frame', frame, 'record');
    p = get(p, 'frame_items', frame, 'itemsRecord');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const itemsRecord = bindings.itemsRecord as Record<string, unknown> | null;
          const items = (itemsRecord?.items as string[]) ?? [];
          return !items.includes(item);
        }, 'isNew');

        return branch(thenP, 'isNew',
          (addP) => {
            addP = putFrom(addP, 'frame_items', frame, (bindings) => {
              const itemsRecord = bindings.itemsRecord as Record<string, unknown> | null;
              const items = (itemsRecord?.items as string[]) ?? [];
              return { id: frame, items: [...items, item] };
            });
            return complete(addP, 'ok', {});
          },
          (dupP) => complete(dupP, 'already_present', { message: `Item '${item}' is already in frame '${frame}'` }),
        );
      },
      (elseP) => complete(elseP, 'notFound', { message: `Frame '${frame}' not found` }),
    ) as StorageProgram<Result>;
  },

  removeItem(input: Record<string, unknown>) {
    if (!input.frame || (typeof input.frame === 'string' && (input.frame as string).trim() === '')) {
      return complete(createProgram(), 'notFound', { message: 'frame is required' }) as StorageProgram<Result>;
    }
    const frame = input.frame as string;
    const item = ((input.item_id as string) ?? (input.item as string));

    let p = createProgram();
    p = get(p, 'frame', frame, 'record');
    p = get(p, 'frame_items', frame, 'itemsRecord');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const itemsRecord = bindings.itemsRecord as Record<string, unknown> | null;
          const items = (itemsRecord?.items as string[]) ?? [];
          return items.includes(item);
        }, 'hasItem');

        return branch(thenP, 'hasItem',
          (removeP) => {
            removeP = putFrom(removeP, 'frame_items', frame, (bindings) => {
              const itemsRecord = bindings.itemsRecord as Record<string, unknown> | null;
              const items = (itemsRecord?.items as string[]) ?? [];
              return { id: frame, items: items.filter(i => i !== item) };
            });
            return complete(removeP, 'ok', {});
          },
          (notP) => complete(notP, 'not_present', { message: `Item '${item}' is not in frame '${frame}'` }),
        );
      },
      (elseP) => complete(elseP, 'notFound', { message: `Frame '${frame}' not found` }),
    ) as StorageProgram<Result>;
  },

  setBackground(input: Record<string, unknown>) {
    if (!input.frame || (typeof input.frame === 'string' && (input.frame as string).trim() === '')) {
      return complete(createProgram(), 'notFound', { message: 'frame is required' }) as StorageProgram<Result>;
    }
    const frame = input.frame as string;
    const color = input.color as string;

    let p = createProgram();
    p = get(p, 'frame', frame, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'frame', frame, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, background: color };
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `Frame '${frame}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const frameHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetFrameCounter(): void {
  idCounter = 0;
}

export default frameHandler;
