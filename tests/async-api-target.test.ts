// ============================================================
// AsyncApiTarget Handler Tests
//
// Generate AsyncAPI 3.0 specification documents for event-driven
// concept interfaces. See Architecture doc Section 2.7.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  asyncApiTargetHandler,
  resetAsyncApiTargetCounter,
} from '../handlers/ts/async-api-target.handler.js';

describe('AsyncApiTarget', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAsyncApiTargetCounter();
  });

  describe('generate', () => {
    it('generates an AsyncAPI 3.0 spec from projections', async () => {
      const result = await asyncApiTargetHandler.generate!(
        {
          projections: ['todo-events', 'user-events'],
          syncSpecs: ['order-payment'],
          config: JSON.stringify({ title: 'My API', version: '2.0.0' }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.spec).toBe('async-api-target-1');
      const doc = JSON.parse(result.content as string);
      expect(doc.asyncapi).toBe('3.0.0');
      expect(doc.info.title).toBe('My API');
      expect(doc.info.version).toBe('2.0.0');
    });

    it('creates channels from projections', async () => {
      const result = await asyncApiTargetHandler.generate!(
        {
          projections: ['notifications'],
          syncSpecs: [],
          config: '{}',
        },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      expect(doc.channels['notifications/events']).toBeDefined();
      expect(doc.channels['notifications/events'].address).toBe('notifications/events');
    });

    it('creates channels from sync specs', async () => {
      const result = await asyncApiTargetHandler.generate!(
        {
          projections: [],
          syncSpecs: ['payment-completed'],
          config: '{}',
        },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      expect(doc.channels['payment-completed/sync']).toBeDefined();
    });

    it('creates operations for each channel', async () => {
      const result = await asyncApiTargetHandler.generate!(
        {
          projections: ['events'],
          syncSpecs: ['sync-a'],
          config: '{}',
        },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      const opKeys = Object.keys(doc.operations);
      expect(opKeys.length).toBe(2);
    });

    it('configures websocket transport by default', async () => {
      const result = await asyncApiTargetHandler.generate!(
        {
          projections: ['test'],
          syncSpecs: [],
          config: '{}',
        },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      expect(doc.servers.default.protocol).toBe('websocket');
    });

    it('configures kafka transport when specified', async () => {
      const result = await asyncApiTargetHandler.generate!(
        {
          projections: ['test'],
          syncSpecs: [],
          config: JSON.stringify({ transport: 'kafka' }),
        },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      expect(doc.servers.default.protocol).toBe('kafka');
    });

    it('stores the generated spec in storage', async () => {
      await asyncApiTargetHandler.generate!(
        { projections: ['test'], syncSpecs: [], config: '{}' },
        storage,
      );
      const stored = await storage.get('async-api-target', 'async-api-target-1');
      expect(stored).not.toBeNull();
      expect(stored!.version).toBe('3.0.0');
    });
  });
});
