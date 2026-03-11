// CanvasEntity Score handler tests -- register, updateStats, getCanvas, listCanvases, getConnectorGraph actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { canvasEntityHandler, resetCanvasEntityCounter } from '../handlers/ts/score/canvas-entity.handler.js';

/** Wrap in-memory storage with a `list` method used by Score entity handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('CanvasEntity', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetCanvasEntityCounter();
  });

  describe('register', () => {
    it('registers a new canvas entity', async () => {
      const result = await canvasEntityHandler.register(
        { canvas_id: 'canvas-1', name: 'Architecture' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.id).toBe('canvas-entity-1');
      expect(result.symbol).toBe('clef/canvas/Architecture');
    });

    it('initializes all stat counters to zero', async () => {
      await canvasEntityHandler.register({ canvas_id: 'canvas-1', name: 'Test' }, storage);

      const record = await storage.get('canvas-entity', 'canvas-entity-1');
      expect(record!.item_count).toBe(0);
      expect(record!.connector_count).toBe(0);
      expect(record!.frame_count).toBe(0);
      expect(record!.group_count).toBe(0);
      expect(record!.notation_id).toBeNull();
    });

    it('returns alreadyRegistered for duplicate canvas_id', async () => {
      await canvasEntityHandler.register({ canvas_id: 'canvas-1', name: 'First' }, storage);
      const result = await canvasEntityHandler.register({ canvas_id: 'canvas-1', name: 'Second' }, storage);
      expect(result.variant).toBe('alreadyRegistered');
      expect(result.existing).toBe('canvas-entity-1');
    });

    it('assigns unique IDs', async () => {
      const r1 = await canvasEntityHandler.register({ canvas_id: 'c1', name: 'A' }, storage);
      const r2 = await canvasEntityHandler.register({ canvas_id: 'c2', name: 'B' }, storage);
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('updateStats', () => {
    it('updates stats for an existing canvas entity', async () => {
      await canvasEntityHandler.register({ canvas_id: 'canvas-1', name: 'Test' }, storage);

      const result = await canvasEntityHandler.updateStats(
        { canvas_id: 'canvas-1', item_count: 5, connector_count: 3 },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas-entity', 'canvas-entity-1');
      expect(record!.item_count).toBe(5);
      expect(record!.connector_count).toBe(3);
    });

    it('returns notfound for unregistered canvas', async () => {
      const result = await canvasEntityHandler.updateStats(
        { canvas_id: 'nonexistent', item_count: 1 },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('preserves unchanged fields', async () => {
      await canvasEntityHandler.register({ canvas_id: 'canvas-1', name: 'Test' }, storage);
      await canvasEntityHandler.updateStats({ canvas_id: 'canvas-1', item_count: 10 }, storage);

      const record = await storage.get('canvas-entity', 'canvas-entity-1');
      expect(record!.item_count).toBe(10);
      expect(record!.connector_count).toBe(0);
      expect(record!.name).toBe('Test');
    });
  });

  describe('getCanvas', () => {
    it('returns the entity for an existing canvas', async () => {
      await canvasEntityHandler.register({ canvas_id: 'canvas-1', name: 'MyCanvas' }, storage);

      const result = await canvasEntityHandler.getCanvas({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect((result.entity as Record<string, unknown>).name).toBe('MyCanvas');
    });

    it('returns notfound for non-existent canvas', async () => {
      const result = await canvasEntityHandler.getCanvas({ canvas_id: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('listCanvases', () => {
    it('returns all registered canvases', async () => {
      await canvasEntityHandler.register({ canvas_id: 'c1', name: 'Alpha' }, storage);
      await canvasEntityHandler.register({ canvas_id: 'c2', name: 'Beta' }, storage);

      const result = await canvasEntityHandler.listCanvases({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.canvases).toHaveLength(2);
    });

    it('returns empty list when no canvases exist', async () => {
      const result = await canvasEntityHandler.listCanvases({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.canvases).toEqual([]);
    });
  });

  describe('getConnectorGraph', () => {
    it('returns edges for connectors on a canvas', async () => {
      // Seed connector entity data directly
      await storage.put('canvas-connector-entity', 'ce-1', {
        id: 'ce-1',
        canvas_id: 'canvas-1',
        source_item: 'item-a',
        target_item: 'item-b',
        kind: 'local',
        label: 'depends-on',
        type_key: 'dependency',
      });

      const result = await canvasEntityHandler.getConnectorGraph({ canvas_id: 'canvas-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({
        source: 'item-a',
        target: 'item-b',
        kind: 'local',
      });
    });

    it('returns empty edges when no connectors exist', async () => {
      const result = await canvasEntityHandler.getConnectorGraph({ canvas_id: 'empty-canvas' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.edges).toEqual([]);
    });
  });
});
