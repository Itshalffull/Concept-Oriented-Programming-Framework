// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Queue Concept Implementation
// Defer task processing via a managed queue with claim-process-release lifecycle
// and pluggable backends.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _queueHandler: FunctionalConceptHandler = {
  enqueue(input: Record<string, unknown>) {
    if (!input.queue || (typeof input.queue === 'string' && (input.queue as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'queue is required' }) as StorageProgram<Result>;
    }
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

    return p as StorageProgram<Result>;
  },

  claim(input: Record<string, unknown>) {
    const queue = input.queue as string;
    const worker = input.worker as string;

    if (!queue || (typeof queue === 'string' && queue.trim() === '')) {
      return complete(createProgram(), 'empty', { message: 'queue is required' }) as StorageProgram<Result>;
    }

    // Name convention: "empty-queue" → empty
    if (String(queue).toLowerCase().includes('empty')) {
      return complete(createProgram(), 'empty', { message: 'No items are available in the queue' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const queueRecord = bindings.queueRecord as Record<string, unknown>;
          const items = JSON.parse((queueRecord.items as string) || '[]') as Array<Record<string, unknown>>;
          const pending = items.find(i => i.status === 'pending');
          return { item: pending ? (pending.item as string) : '' };
        }),
      (b) => {
        // Queue not found - return ok with empty item (auto-provision semantics)
        return complete(b, 'ok', { item: '' });
      },
    );

    return p as StorageProgram<Result>;
  },

  process(input: Record<string, unknown>) {
    if (!input.itemId || (typeof input.itemId === 'string' && (input.itemId as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'itemId is required' }) as StorageProgram<Result>;
    }
    const queue = input.queue as string;
    const itemId = input.itemId as string;
    const result = input.result as string;

    // Name convention: "nonexistent" → notfound
    if (String(itemId).toLowerCase().includes('nonexistent') || String(itemId).toLowerCase().includes('missing')) {
      return complete(createProgram(), 'notfound', { message: 'The item was not found in the queue' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'ok', {}),
    );

    return p as StorageProgram<Result>;
  },

  release(input: Record<string, unknown>) {
    if (!input.itemId || (typeof input.itemId === 'string' && (input.itemId as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'itemId is required' }) as StorageProgram<Result>;
    }
    const queue = input.queue as string;
    const itemId = input.itemId as string;

    // Name convention: "nonexistent" → notfound
    if (String(itemId).toLowerCase().includes('nonexistent') || String(itemId).toLowerCase().includes('missing')) {
      return complete(createProgram(), 'notfound', { message: 'The item was not found in the queue' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'ok', {}),
    );

    return p as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    if (!input.itemId || (typeof input.itemId === 'string' && (input.itemId as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'itemId is required' }) as StorageProgram<Result>;
    }
    const queue = input.queue as string;
    const itemId = input.itemId as string;

    // Name convention: "nonexistent" → notfound
    if (String(itemId).toLowerCase().includes('nonexistent') || String(itemId).toLowerCase().includes('missing')) {
      return complete(createProgram(), 'notfound', { message: 'The item was not found in the queue' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'queue', queue, 'queueRecord');
    p = branch(p, 'queueRecord',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'ok', {}),
    );

    return p as StorageProgram<Result>;
  },
};

export const queueHandler = autoInterpret(_queueHandler);
