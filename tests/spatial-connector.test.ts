// SpatialConnector concept handler tests -- draw, promote, demote, surface, and hide actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { spatialConnectorHandler, resetSpatialConnectorCounter } from '../handlers/ts/spatial-connector.handler.js';

describe('SpatialConnector', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSpatialConnectorCounter();
  });

  describe('draw', () => {
    it('creates a visual connector by default', async () => {
      const result = await spatialConnectorHandler.draw({ from: 'a', to: 'b' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.connector).toBe('connector-1');

      const record = await storage.get('connector', 'connector-1');
      expect(record!.type).toBe('visual');
      expect(record!.from).toBe('a');
      expect(record!.to).toBe('b');
    });

    it('creates a connector with explicit type', async () => {
      const result = await spatialConnectorHandler.draw({ from: 'a', to: 'b', type: 'semantic' }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('connector', result.connector as string);
      expect(record!.type).toBe('semantic');
    });

    it('assigns unique IDs to multiple connectors', async () => {
      const r1 = await spatialConnectorHandler.draw({ from: 'a', to: 'b' }, storage);
      const r2 = await spatialConnectorHandler.draw({ from: 'c', to: 'd' }, storage);
      expect(r1.connector).not.toBe(r2.connector);
    });
  });

  describe('promote', () => {
    it('promotes a visual connector to semantic', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'a', to: 'b' }, storage);
      const id = created.connector as string;

      const result = await spatialConnectorHandler.promote({ connector: id }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('connector', id);
      expect(record!.type).toBe('semantic');
    });

    it('returns already_semantic if connector is already semantic', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'a', to: 'b', type: 'semantic' }, storage);
      const id = created.connector as string;

      const result = await spatialConnectorHandler.promote({ connector: id }, storage);
      expect(result.variant).toBe('already_semantic');
    });

    it('returns notFound for non-existent connector', async () => {
      const result = await spatialConnectorHandler.promote({ connector: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('demote', () => {
    it('demotes a semantic connector to visual', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'a', to: 'b', type: 'semantic' }, storage);
      const id = created.connector as string;

      const result = await spatialConnectorHandler.demote({ connector: id }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('connector', id);
      expect(record!.type).toBe('visual');
    });

    it('returns already_visual if connector is already visual', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'a', to: 'b' }, storage);
      const id = created.connector as string;

      const result = await spatialConnectorHandler.demote({ connector: id }, storage);
      expect(result.variant).toBe('already_visual');
    });

    it('returns notFound for non-existent connector', async () => {
      const result = await spatialConnectorHandler.demote({ connector: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('surface', () => {
    it('creates a semantic connector from an existing reference', async () => {
      const result = await spatialConnectorHandler.surface({ ref: 'ref-123', from: 'a', to: 'b' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.connector).toBe('connector-1');

      const record = await storage.get('connector', 'connector-1');
      expect(record!.type).toBe('semantic');
      expect(record!.ref).toBe('ref-123');
      expect(record!.from).toBe('a');
      expect(record!.to).toBe('b');
    });
  });

  describe('hide', () => {
    it('deletes an existing connector', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'a', to: 'b' }, storage);
      const id = created.connector as string;

      const result = await spatialConnectorHandler.hide({ connector: id }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('connector', id);
      expect(record).toBeNull();
    });

    it('returns notFound for non-existent connector', async () => {
      const result = await spatialConnectorHandler.hide({ connector: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('multi-step sequences', () => {
    it('draw -> promote -> demote round-trip', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'a', to: 'b' }, storage);
      const id = created.connector as string;

      await spatialConnectorHandler.promote({ connector: id }, storage);
      let record = await storage.get('connector', id);
      expect(record!.type).toBe('semantic');

      await spatialConnectorHandler.demote({ connector: id }, storage);
      record = await storage.get('connector', id);
      expect(record!.type).toBe('visual');
    });

    it('draw -> hide removes the connector', async () => {
      const created = await spatialConnectorHandler.draw({ from: 'x', to: 'y' }, storage);
      const id = created.connector as string;

      await spatialConnectorHandler.hide({ connector: id }, storage);
      const record = await storage.get('connector', id);
      expect(record).toBeNull();
    });
  });
});
