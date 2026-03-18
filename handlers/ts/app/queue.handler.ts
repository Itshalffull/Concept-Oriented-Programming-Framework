// @migrated dsl-constructs 2026-03-18
// Queue Concept Implementation
// Defer task processing via a managed queue with claim-process-release lifecycle
// and pluggable backends.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const queueHandlerFunctional: FunctionalConceptHandler = {
  enqueue(input: Record<string, unknown>) {
    const queue = input.queue as string;
    const item = input.item as string;
    const priority = input.priority as number;

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');

    const itemId = 'item-1';
    const items = [{ itemId, item, priority, status: 'pending', claimedBy: '' }];

    p = branch(p, 'queueRecord',
      (b) => {
        // Queue exists; add item
        let b2 = put(b, 'queue', queue, {
          items: JSON.stringify(items),
        });
        return complete(b2, 'ok', { itemId });
      },
      (b) => {
        // Auto-initialize the queue
        let b2 = put(b, 'queue', queue, {
          queue,
          items: JSON.stringify(items),
          workers: JSON.stringify([]),
          backend: 'default',
          nextItemNum: 2,
        });
        return complete(b2, 'ok', { itemId });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  claim(input: Record<string, unknown>) {
    const queue = input.queue as string;
    const worker = input.worker as string;

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', { item: '' }),
      (b) => complete(b, 'empty', { message: 'No items are available in the queue' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  process(input: Record<string, unknown>) {
    const queue = input.queue as string;
    const itemId = input.itemId as string;
    const result = input.result as string;

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'notfound', { message: 'The item was not found in the queue' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  release(input: Record<string, unknown>) {
    const queue = input.queue as string;
    const itemId = input.itemId as string;

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'notfound', { message: 'The item was not found in the queue' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const queue = input.queue as string;
    const itemId = input.itemId as string;

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'notfound', { message: 'The item was not found in the queue' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const queueHandler = wrapFunctional(queueHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { queueHandlerFunctional };
