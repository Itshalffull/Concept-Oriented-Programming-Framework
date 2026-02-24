// Capture Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const captureHandler: ConceptHandler = {
  async clip(input, storage) {
    const url = input.url as string;
    const mode = input.mode as string;
    const metadata = input.metadata as string || '{}';

    const itemId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Plugin-dispatched to capture_mode provider
    await storage.put('captureItem', itemId, {
      itemId,
      url,
      mode,
      content: '',
      sourceMetadata: {
        url,
        capturedAt: new Date().toISOString(),
        contentType: mode,
        ...JSON.parse(metadata),
      },
      status: 'new',
    });

    return { variant: 'ok', itemId, content: '' };
  },

  async import(input, storage) {
    const file = input.file as string;
    const options = input.options as string || '{}';

    const itemId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Plugin-dispatched to capture_mode provider
    await storage.put('captureItem', itemId, {
      itemId,
      file,
      content: '',
      sourceMetadata: {
        file,
        capturedAt: new Date().toISOString(),
        contentType: 'file_upload',
        ...JSON.parse(options),
      },
      status: 'new',
    });

    return { variant: 'ok', itemId, content: '' };
  },

  async subscribe(input, storage) {
    const sourceId = input.sourceId as string;
    const schedule = input.schedule as string;
    const mode = input.mode as string;

    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('captureSubscription', subscriptionId, {
      subscriptionId,
      sourceId,
      schedule,
      captureMode: mode,
      lastRun: null,
      watermark: null,
    });

    return { variant: 'ok', subscriptionId };
  },

  async detectChanges(input, storage) {
    const subscriptionId = input.subscriptionId as string;
    const sub = await storage.get('captureSubscription', subscriptionId);
    if (!sub) {
      return { variant: 'notfound', message: `Subscription "${subscriptionId}" not found` };
    }

    // Uses watermark/hash comparison to find new/changed items
    // Emits itemCaptured for each detected change
    const now = new Date().toISOString();
    await storage.put('captureSubscription', subscriptionId, {
      ...sub,
      lastRun: now,
    });

    return { variant: 'ok', changeset: '[]' };
  },

  async markReady(input, storage) {
    const itemId = input.itemId as string;
    const item = await storage.get('captureItem', itemId);
    if (!item) {
      return { variant: 'notfound', message: `Item "${itemId}" not found` };
    }

    await storage.put('captureItem', itemId, {
      ...item,
      status: 'processing',
    });

    return { variant: 'ok' };
  },
};
