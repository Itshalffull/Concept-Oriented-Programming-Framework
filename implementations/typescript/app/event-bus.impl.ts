// EventBus Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const eventBusHandler: ConceptHandler = {
  async registerEventType(input, storage) {
    const name = input.name as string;
    const schema = input.schema as string;

    const existing = await storage.get('eventType', name);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('eventType', name, { name, schema });

    return { variant: 'ok' };
  },

  async subscribe(input, storage) {
    const event = input.event as string;
    const handler = input.handler as string;
    const priority = input.priority as number;

    const subscriptionId = `${event}:${handler}:${Date.now()}`;

    await storage.put('subscription', subscriptionId, {
      subscriptionId,
      event,
      handler,
      priority,
    });

    return { variant: 'ok', subscriptionId };
  },

  async unsubscribe(input, storage) {
    const subscriptionId = input.subscriptionId as string;

    const existing = await storage.get('subscription', subscriptionId);
    if (!existing) {
      return { variant: 'notfound' };
    }

    await storage.delete('subscription', subscriptionId);

    return { variant: 'ok' };
  },

  async dispatch(input, storage) {
    const event = input.event as string;
    const data = input.data as string;

    const allSubscriptions = await storage.find('subscription', { event });

    // Sort subscribers by priority (lower number = higher priority)
    const sorted = allSubscriptions.sort(
      (a, b) => (a.priority as number) - (b.priority as number),
    );

    const results: Array<{ handler: string; status: string }> = [];

    for (const sub of sorted) {
      const handler = sub.handler as string;
      try {
        results.push({ handler, status: 'delivered' });
      } catch {
        // Send to dead-letter queue on failure
        const dlqId = `${event}:${Date.now()}`;
        await storage.put('deadLetter', dlqId, {
          event,
          data,
          handler,
          error: 'delivery failed',
          timestamp: Date.now(),
        });
        return { variant: 'error', message: `Delivery failed for handler: ${handler}` };
      }
    }

    // Record dispatch in history
    const historyId = `${event}:${Date.now()}`;
    await storage.put('eventHistory', historyId, {
      event,
      data,
      results: JSON.stringify(results),
      timestamp: Date.now(),
    });

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async dispatchAsync(input, storage) {
    const event = input.event as string;
    const data = input.data as string;

    const allSubscriptions = await storage.find('subscription', { event });

    if (allSubscriptions.length === 0) {
      return { variant: 'error', message: `No subscribers for event: ${event}` };
    }

    const jobId = `job:${event}:${Date.now()}`;

    await storage.put('asyncJob', jobId, {
      jobId,
      event,
      data,
      status: 'queued',
      subscriberCount: allSubscriptions.length,
      createdAt: Date.now(),
    });

    return { variant: 'ok', jobId };
  },

  async getHistory(input, storage) {
    const event = input.event as string;
    const limit = input.limit as number;

    const allHistory = await storage.find('eventHistory', { event });

    // Sort by timestamp descending and limit
    const sorted = allHistory
      .sort((a, b) => (b.timestamp as number) - (a.timestamp as number))
      .slice(0, limit);

    const entries = sorted.map(entry => ({
      event: entry.event,
      data: entry.data,
      results: entry.results,
      timestamp: entry.timestamp,
    }));

    return { variant: 'ok', entries: JSON.stringify(entries) };
  },
};
