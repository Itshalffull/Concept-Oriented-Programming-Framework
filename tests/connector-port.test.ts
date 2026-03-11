// ConnectorPort concept handler tests -- addPort, removePort, movePort, validateConnection,
// incrementConnection, decrementConnection, and getPortsForOwner actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { connectorPortHandler, resetConnectorPortCounter } from '../handlers/ts/connector-port.handler.js';

/** Wrap in-memory storage with a `list` method used by diagramming handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('ConnectorPort', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetConnectorPortCounter();
  });

  describe('addPort', () => {
    it('creates a port with correct fields', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', offset: 0.5, direction: 'out' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.port).toBe('port-1');

      const record = await storage.get('connector-port', 'port-1');
      expect(record!.owner).toBe('node-1');
      expect(record!.position).toEqual({ side: 'right', offset: 0.5 });
      expect(record!.direction).toBe('out');
      expect(record!.connection_count).toBe(0);
    });

    it('defaults offset to 0.5 when omitted', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'top', direction: 'in' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('connector-port', result.port as string);
      expect(record!.position).toEqual({ side: 'top', offset: 0.5 });
    });

    it('stores optional port_type and label', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'left', direction: 'in', port_type: 'data', label: 'Input' },
        storage,
      );
      const record = await storage.get('connector-port', result.port as string);
      expect(record!.port_type).toBe('data');
      expect(record!.label).toBe('Input');
    });

    it('stores max_connections when provided', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out', max_connections: 3 },
        storage,
      );
      const record = await storage.get('connector-port', result.port as string);
      expect(record!.max_connections).toBe(3);
    });

    it('defaults port_type, label, max_connections to null', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'bottom', direction: 'bidirectional' },
        storage,
      );
      const record = await storage.get('connector-port', result.port as string);
      expect(record!.port_type).toBeNull();
      expect(record!.label).toBeNull();
      expect(record!.max_connections).toBeNull();
    });

    it('returns error for invalid side', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'diagonal', direction: 'in' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid side');
    });

    it('returns error for invalid direction', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'top', direction: 'sideways' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid direction');
    });

    it('returns error for offset below 0', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'top', direction: 'in', offset: -0.1 },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Offset');
    });

    it('returns error for offset above 1', async () => {
      const result = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'top', direction: 'in', offset: 1.5 },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Offset');
    });

    it('accepts all valid sides', async () => {
      for (const side of ['top', 'right', 'bottom', 'left', 'center']) {
        const result = await connectorPortHandler.addPort(
          { owner: 'node-1', side, direction: 'in' },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    });

    it('accepts all valid directions', async () => {
      for (const direction of ['in', 'out', 'bidirectional']) {
        const result = await connectorPortHandler.addPort(
          { owner: 'node-1', side: 'top', direction },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    });

    it('assigns unique IDs', async () => {
      const r1 = await connectorPortHandler.addPort({ owner: 'n1', side: 'top', direction: 'in' }, storage);
      const r2 = await connectorPortHandler.addPort({ owner: 'n2', side: 'bottom', direction: 'out' }, storage);
      expect(r1.port).not.toBe(r2.port);
    });
  });

  describe('removePort', () => {
    it('removes an existing port', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      const id = created.port as string;

      const result = await connectorPortHandler.removePort({ port: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.port).toBe(id);

      const record = await storage.get('connector-port', id);
      expect(record).toBeNull();
    });

    it('returns notfound for missing port', async () => {
      const result = await connectorPortHandler.removePort({ port: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('movePort', () => {
    it('repositions a port', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', offset: 0.5, direction: 'out' },
        storage,
      );
      const id = created.port as string;

      const result = await connectorPortHandler.movePort({ port: id, side: 'left', offset: 0.3 }, storage);
      expect(result.variant).toBe('ok');
      expect(result.side).toBe('left');
      expect(result.offset).toBe(0.3);

      const record = await storage.get('connector-port', id);
      expect(record!.position).toEqual({ side: 'left', offset: 0.3 });
    });

    it('defaults offset to 0.5 on move', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', offset: 0.2, direction: 'out' },
        storage,
      );
      const id = created.port as string;

      await connectorPortHandler.movePort({ port: id, side: 'bottom' }, storage);
      const record = await storage.get('connector-port', id);
      expect(record!.position).toEqual({ side: 'bottom', offset: 0.5 });
    });

    it('returns notfound for missing port', async () => {
      const result = await connectorPortHandler.movePort({ port: 'nonexistent', side: 'top' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('validateConnection', () => {
    it('validates out->in as compatible', async () => {
      const src = await connectorPortHandler.addPort({ owner: 'n1', side: 'right', direction: 'out' }, storage);
      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'in' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('validates bidirectional->in as compatible', async () => {
      const src = await connectorPortHandler.addPort({ owner: 'n1', side: 'right', direction: 'bidirectional' }, storage);
      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'in' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('validates out->bidirectional as compatible', async () => {
      const src = await connectorPortHandler.addPort({ owner: 'n1', side: 'right', direction: 'out' }, storage);
      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'bidirectional' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects in->in as incompatible (source is in)', async () => {
      const src = await connectorPortHandler.addPort({ owner: 'n1', side: 'right', direction: 'in' }, storage);
      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'in' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('incoming');
    });

    it('rejects out->out as incompatible (target is out)', async () => {
      const src = await connectorPortHandler.addPort({ owner: 'n1', side: 'right', direction: 'out' }, storage);
      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'out' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('outgoing');
    });

    it('rejects incompatible port types', async () => {
      const src = await connectorPortHandler.addPort(
        { owner: 'n1', side: 'right', direction: 'out', port_type: 'data' },
        storage,
      );
      const tgt = await connectorPortHandler.addPort(
        { owner: 'n2', side: 'left', direction: 'in', port_type: 'control' },
        storage,
      );

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('Type mismatch');
    });

    it('allows matching port types', async () => {
      const src = await connectorPortHandler.addPort(
        { owner: 'n1', side: 'right', direction: 'out', port_type: 'data' },
        storage,
      );
      const tgt = await connectorPortHandler.addPort(
        { owner: 'n2', side: 'left', direction: 'in', port_type: 'data' },
        storage,
      );

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('allows connection when one port has no type', async () => {
      const src = await connectorPortHandler.addPort(
        { owner: 'n1', side: 'right', direction: 'out', port_type: 'data' },
        storage,
      );
      const tgt = await connectorPortHandler.addPort(
        { owner: 'n2', side: 'left', direction: 'in' },
        storage,
      );

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects when source port is at max capacity', async () => {
      const src = await connectorPortHandler.addPort(
        { owner: 'n1', side: 'right', direction: 'out', max_connections: 1 },
        storage,
      );
      await connectorPortHandler.incrementConnection({ port: src.port }, storage);

      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'in' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('max capacity');
    });

    it('rejects when target port is at max capacity', async () => {
      const src = await connectorPortHandler.addPort({ owner: 'n1', side: 'right', direction: 'out' }, storage);
      const tgt = await connectorPortHandler.addPort(
        { owner: 'n2', side: 'left', direction: 'in', max_connections: 1 },
        storage,
      );
      await connectorPortHandler.incrementConnection({ port: tgt.port }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('max capacity');
    });

    it('returns incompatible when source port not found', async () => {
      const tgt = await connectorPortHandler.addPort({ owner: 'n2', side: 'left', direction: 'in' }, storage);

      const result = await connectorPortHandler.validateConnection(
        { source_port: 'nonexistent', target_port: tgt.port },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('not found');
    });
  });

  describe('incrementConnection', () => {
    it('increments connection count', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      const id = created.port as string;

      const result = await connectorPortHandler.incrementConnection({ port: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);

      const record = await storage.get('connector-port', id);
      expect(record!.connection_count).toBe(1);
    });

    it('increments multiple times', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      const id = created.port as string;

      await connectorPortHandler.incrementConnection({ port: id }, storage);
      const r2 = await connectorPortHandler.incrementConnection({ port: id }, storage);
      expect(r2.count).toBe(2);
    });

    it('returns exceeded when at max connections', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out', max_connections: 1 },
        storage,
      );
      const id = created.port as string;

      await connectorPortHandler.incrementConnection({ port: id }, storage);
      const result = await connectorPortHandler.incrementConnection({ port: id }, storage);
      expect(result.variant).toBe('exceeded');
      expect(result.max).toBe(1);
    });

    it('returns notfound for missing port', async () => {
      const result = await connectorPortHandler.incrementConnection({ port: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });

    it('allows unlimited increments when max_connections is null', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      const id = created.port as string;

      for (let i = 0; i < 10; i++) {
        const result = await connectorPortHandler.incrementConnection({ port: id }, storage);
        expect(result.variant).toBe('ok');
      }
    });
  });

  describe('decrementConnection', () => {
    it('decrements connection count', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      const id = created.port as string;

      await connectorPortHandler.incrementConnection({ port: id }, storage);
      await connectorPortHandler.incrementConnection({ port: id }, storage);

      const result = await connectorPortHandler.decrementConnection({ port: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);
    });

    it('does not go below 0', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      const id = created.port as string;

      const result = await connectorPortHandler.decrementConnection({ port: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);

      const record = await storage.get('connector-port', id);
      expect(record!.connection_count).toBe(0);
    });

    it('returns notfound for missing port', async () => {
      const result = await connectorPortHandler.decrementConnection({ port: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('getPortsForOwner', () => {
    it('returns ports for a given owner', async () => {
      await connectorPortHandler.addPort({ owner: 'node-1', side: 'right', direction: 'out' }, storage);
      await connectorPortHandler.addPort({ owner: 'node-1', side: 'left', direction: 'in' }, storage);
      await connectorPortHandler.addPort({ owner: 'node-2', side: 'top', direction: 'in' }, storage);

      const result = await connectorPortHandler.getPortsForOwner({ owner: 'node-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.ports).toEqual(['port-1', 'port-2']);
    });

    it('returns empty array for unknown owner', async () => {
      const result = await connectorPortHandler.getPortsForOwner({ owner: 'unknown' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.ports).toEqual([]);
    });

    it('does not include removed ports', async () => {
      const p1 = await connectorPortHandler.addPort({ owner: 'node-1', side: 'right', direction: 'out' }, storage);
      await connectorPortHandler.addPort({ owner: 'node-1', side: 'left', direction: 'in' }, storage);
      await connectorPortHandler.removePort({ port: p1.port }, storage);

      const result = await connectorPortHandler.getPortsForOwner({ owner: 'node-1' }, storage);
      expect(result.ports).toEqual(['port-2']);
    });
  });

  describe('multi-step sequences', () => {
    it('addPort -> incrementConnection -> validateConnection -> decrementConnection', async () => {
      const src = await connectorPortHandler.addPort(
        { owner: 'n1', side: 'right', direction: 'out', max_connections: 2 },
        storage,
      );
      const tgt = await connectorPortHandler.addPort(
        { owner: 'n2', side: 'left', direction: 'in' },
        storage,
      );

      // Increment source once
      const inc = await connectorPortHandler.incrementConnection({ port: src.port }, storage);
      expect(inc.variant).toBe('ok');
      expect(inc.count).toBe(1);

      // Validate should still allow (1 < 2 max)
      const val = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(val.variant).toBe('ok');

      // Increment again to max
      await connectorPortHandler.incrementConnection({ port: src.port }, storage);

      // Now should reject
      const val2 = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(val2.variant).toBe('incompatible');

      // Decrement and validate again
      await connectorPortHandler.decrementConnection({ port: src.port }, storage);
      const val3 = await connectorPortHandler.validateConnection(
        { source_port: src.port, target_port: tgt.port },
        storage,
      );
      expect(val3.variant).toBe('ok');
    });

    it('addPort -> movePort -> verify position updated', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'top', offset: 0.2, direction: 'in' },
        storage,
      );
      const id = created.port as string;

      await connectorPortHandler.movePort({ port: id, side: 'bottom', offset: 0.8 }, storage);

      const record = await storage.get('connector-port', id);
      expect(record!.position).toEqual({ side: 'bottom', offset: 0.8 });
      expect(record!.direction).toBe('in'); // direction preserved
    });

    it('addPort -> removePort -> getPortsForOwner shows empty', async () => {
      const created = await connectorPortHandler.addPort(
        { owner: 'node-1', side: 'right', direction: 'out' },
        storage,
      );
      await connectorPortHandler.removePort({ port: created.port }, storage);

      const result = await connectorPortHandler.getPortsForOwner({ owner: 'node-1' }, storage);
      expect(result.ports).toEqual([]);
    });
  });
});
