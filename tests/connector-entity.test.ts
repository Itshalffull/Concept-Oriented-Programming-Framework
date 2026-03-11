// ConnectorEntity Score handler tests -- register, updateKind, listByCanvas, listByKind, getConnectionsBetween actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { connectorEntityHandler, resetConnectorEntityCounter } from '../handlers/ts/score/connector-entity.handler.js';

/** Wrap in-memory storage with a `list` method used by Score entity handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('ConnectorEntity', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetConnectorEntityCounter();
  });

  describe('register', () => {
    it('registers a new connector entity', async () => {
      const result = await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'canvas-1', source_item: 'a', target_item: 'b' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.id).toBe('connector-entity-1');
      expect(result.symbol).toBe('clef/canvas/canvas-1/connector/conn-1');
    });

    it('defaults kind to local', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'canvas-1', source_item: 'a', target_item: 'b' },
        storage,
      );
      const record = await storage.get('canvas-connector-entity', 'connector-entity-1');
      expect(record!.kind).toBe('local');
    });

    it('stores optional fields', async () => {
      await connectorEntityHandler.register(
        {
          connector_id: 'conn-1',
          canvas_id: 'canvas-1',
          source_item: 'a',
          target_item: 'b',
          kind: 'semantic',
          label: 'depends-on',
          type_key: 'dependency',
          source_port: 'port-out',
          target_port: 'port-in',
          reference_id: 'ref-42',
        },
        storage,
      );
      const record = await storage.get('canvas-connector-entity', 'connector-entity-1');
      expect(record!.kind).toBe('semantic');
      expect(record!.label).toBe('depends-on');
      expect(record!.type_key).toBe('dependency');
      expect(record!.source_port).toBe('port-out');
      expect(record!.target_port).toBe('port-in');
      expect(record!.reference_id).toBe('ref-42');
    });

    it('returns alreadyRegistered for duplicate connector_id', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );
      const result = await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });

    it('assigns unique IDs', async () => {
      const r1 = await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );
      const r2 = await connectorEntityHandler.register(
        { connector_id: 'conn-2', canvas_id: 'c1', source_item: 'c', target_item: 'd' },
        storage,
      );
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('updateKind', () => {
    it('updates the kind of an existing connector', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );

      const result = await connectorEntityHandler.updateKind(
        { connector_id: 'conn-1', kind: 'semantic', reference_id: 'ref-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kind).toBe('semantic');

      const record = await storage.get('canvas-connector-entity', 'connector-entity-1');
      expect(record!.kind).toBe('semantic');
      expect(record!.reference_id).toBe('ref-1');
    });

    it('returns notfound for non-existent connector', async () => {
      const result = await connectorEntityHandler.updateKind(
        { connector_id: 'nonexistent', kind: 'semantic' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('listByCanvas', () => {
    it('returns connectors for a given canvas', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );
      await connectorEntityHandler.register(
        { connector_id: 'conn-2', canvas_id: 'c1', source_item: 'b', target_item: 'c' },
        storage,
      );
      await connectorEntityHandler.register(
        { connector_id: 'conn-3', canvas_id: 'c2', source_item: 'x', target_item: 'y' },
        storage,
      );

      const result = await connectorEntityHandler.listByCanvas({ canvas_id: 'c1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.connectors).toHaveLength(2);
    });

    it('returns empty list for canvas with no connectors', async () => {
      const result = await connectorEntityHandler.listByCanvas({ canvas_id: 'empty' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.connectors).toEqual([]);
    });
  });

  describe('listByKind', () => {
    it('returns connectors filtered by kind', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b', kind: 'local' },
        storage,
      );
      await connectorEntityHandler.register(
        { connector_id: 'conn-2', canvas_id: 'c1', source_item: 'b', target_item: 'c', kind: 'semantic' },
        storage,
      );

      const result = await connectorEntityHandler.listByKind({ kind: 'semantic' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.connectors).toHaveLength(1);
      expect(result.connectors[0].kind).toBe('semantic');
    });

    it('filters by canvas_id when provided', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b', kind: 'local' },
        storage,
      );
      await connectorEntityHandler.register(
        { connector_id: 'conn-2', canvas_id: 'c2', source_item: 'x', target_item: 'y', kind: 'local' },
        storage,
      );

      const result = await connectorEntityHandler.listByKind({ kind: 'local', canvas_id: 'c1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.connectors).toHaveLength(1);
      expect(result.connectors[0].canvas_id).toBe('c1');
    });
  });

  describe('getConnectionsBetween', () => {
    it('finds connections between two items in either direction', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );
      await connectorEntityHandler.register(
        { connector_id: 'conn-2', canvas_id: 'c1', source_item: 'b', target_item: 'a', kind: 'semantic' },
        storage,
      );
      await connectorEntityHandler.register(
        { connector_id: 'conn-3', canvas_id: 'c1', source_item: 'a', target_item: 'c' },
        storage,
      );

      const result = await connectorEntityHandler.getConnectionsBetween(
        { item_a: 'a', item_b: 'b' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.connections).toHaveLength(2);
    });

    it('returns empty when no connections exist between items', async () => {
      await connectorEntityHandler.register(
        { connector_id: 'conn-1', canvas_id: 'c1', source_item: 'a', target_item: 'b' },
        storage,
      );

      const result = await connectorEntityHandler.getConnectionsBetween(
        { item_a: 'x', item_b: 'y' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.connections).toEqual([]);
    });
  });
});
