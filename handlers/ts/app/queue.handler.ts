// Queue Concept Implementation
// Defer task processing via a managed queue with claim-process-release lifecycle
// and pluggable backends.
import type { ConceptHandler } from '@clef/runtime';

export const queueHandler: ConceptHandler = {
  async enqueue(input, storage) {
    const queue = input.queue as string;
    const item = input.item as string;
    const priority = input.priority as number;

    const queueRecord = await storage.get('queue', queue);
    if (!queueRecord) {
      // Auto-initialize the queue on first enqueue if it does not exist
      const itemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const items = [{ itemId, item, priority, status: 'pending', claimedBy: '' }];
      await storage.put('queue', queue, {
        queue,
        items: JSON.stringify(items),
        workers: JSON.stringify([]),
        backend: 'default',
      });
      return { variant: 'ok', itemId };
    }

    const items: Array<{
      itemId: string;
      item: string;
      priority: number;
      status: string;
      claimedBy: string;
    }> = JSON.parse((queueRecord.items as string) || '[]');

    const itemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    items.push({ itemId, item, priority, status: 'pending', claimedBy: '' });

    // Sort by priority (higher priority first) for FIFO within same priority
    items.sort((a, b) => b.priority - a.priority);

    await storage.put('queue', queue, {
      ...queueRecord,
      items: JSON.stringify(items),
    });

    return { variant: 'ok', itemId };
  },

  async claim(input, storage) {
    const queue = input.queue as string;
    const worker = input.worker as string;

    const queueRecord = await storage.get('queue', queue);
    if (!queueRecord) {
      return { variant: 'empty', message: 'No items are available in the queue' };
    }

    const items: Array<{
      itemId: string;
      item: string;
      priority: number;
      status: string;
      claimedBy: string;
    }> = JSON.parse((queueRecord.items as string) || '[]');

    // Find the first pending item (already sorted by priority)
    const pendingIndex = items.findIndex((i) => i.status === 'pending');
    if (pendingIndex < 0) {
      return { variant: 'empty', message: 'No items are available in the queue' };
    }

    const claimedItem = items[pendingIndex];
    claimedItem.status = 'claimed';
    claimedItem.claimedBy = worker;

    // Track worker
    const workers: string[] = JSON.parse((queueRecord.workers as string) || '[]');
    if (!workers.includes(worker)) {
      workers.push(worker);
    }

    await storage.put('queue', queue, {
      ...queueRecord,
      items: JSON.stringify(items),
      workers: JSON.stringify(workers),
    });

    return { variant: 'ok', item: claimedItem.item };
  },

  async process(input, storage) {
    const queue = input.queue as string;
    const itemId = input.itemId as string;
    const result = input.result as string;

    const queueRecord = await storage.get('queue', queue);
    if (!queueRecord) {
      return { variant: 'notfound', message: 'The item was not found in the queue' };
    }

    const items: Array<{
      itemId: string;
      item: string;
      priority: number;
      status: string;
      claimedBy: string;
      result?: string;
    }> = JSON.parse((queueRecord.items as string) || '[]');

    const itemIndex = items.findIndex((i) => i.itemId === itemId);
    if (itemIndex < 0) {
      return { variant: 'notfound', message: 'The item was not found in the queue' };
    }

    items[itemIndex].status = 'completed';
    items[itemIndex].result = result;

    await storage.put('queue', queue, {
      ...queueRecord,
      items: JSON.stringify(items),
    });

    return { variant: 'ok' };
  },

  async release(input, storage) {
    const queue = input.queue as string;
    const itemId = input.itemId as string;

    const queueRecord = await storage.get('queue', queue);
    if (!queueRecord) {
      return { variant: 'notfound', message: 'The item was not found in the queue' };
    }

    const items: Array<{
      itemId: string;
      item: string;
      priority: number;
      status: string;
      claimedBy: string;
    }> = JSON.parse((queueRecord.items as string) || '[]');

    const itemIndex = items.findIndex((i) => i.itemId === itemId);
    if (itemIndex < 0) {
      return { variant: 'notfound', message: 'The item was not found in the queue' };
    }

    // Release item back to pending status
    items[itemIndex].status = 'pending';
    items[itemIndex].claimedBy = '';

    await storage.put('queue', queue, {
      ...queueRecord,
      items: JSON.stringify(items),
    });

    return { variant: 'ok' };
  },

  async delete(input, storage) {
    const queue = input.queue as string;
    const itemId = input.itemId as string;

    const queueRecord = await storage.get('queue', queue);
    if (!queueRecord) {
      return { variant: 'notfound', message: 'The item was not found in the queue' };
    }

    const items: Array<{
      itemId: string;
      item: string;
      priority: number;
      status: string;
      claimedBy: string;
    }> = JSON.parse((queueRecord.items as string) || '[]');

    const itemIndex = items.findIndex((i) => i.itemId === itemId);
    if (itemIndex < 0) {
      return { variant: 'notfound', message: 'The item was not found in the queue' };
    }

    items.splice(itemIndex, 1);

    await storage.put('queue', queue, {
      ...queueRecord,
      items: JSON.stringify(items),
    });

    return { variant: 'ok' };
  },
};
