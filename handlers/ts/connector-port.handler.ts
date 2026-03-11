// ============================================================
// ConnectorPort Handler
//
// Typed connection points on canvas items. Controls where and
// how connectors attach, with direction and data-type validation.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `port-${++idCounter}`;
}

const VALID_SIDES = ['top', 'right', 'bottom', 'left', 'center'];
const VALID_DIRECTIONS = ['in', 'out', 'bidirectional'];

export const connectorPortHandler: ConceptHandler = {
  async addPort(input: Record<string, unknown>, storage: ConceptStorage) {
    const owner = input.owner as string;
    const side = input.side as string;
    const offset = (input.offset as number) ?? 0.5;
    const direction = input.direction as string;
    const port_type = (input.port_type as string | undefined) ?? null;
    const label = (input.label as string | undefined) ?? null;
    const max_connections = (input.max_connections as number | undefined) ?? null;

    if (!VALID_SIDES.includes(side)) {
      return { variant: 'error', message: `Invalid side '${side}'. Must be one of: ${VALID_SIDES.join(', ')}` };
    }
    if (!VALID_DIRECTIONS.includes(direction)) {
      return { variant: 'error', message: `Invalid direction '${direction}'. Must be one of: ${VALID_DIRECTIONS.join(', ')}` };
    }
    if (offset < 0 || offset > 1) {
      return { variant: 'error', message: 'Offset must be between 0.0 and 1.0' };
    }

    const id = nextId();
    await storage.put('connector-port', id, {
      id,
      port: id,
      owner,
      position: { side, offset },
      direction,
      port_type,
      label,
      max_connections,
      connection_count: 0,
    });

    return { variant: 'ok', port: id };
  },

  async removePort(input: Record<string, unknown>, storage: ConceptStorage) {
    const port = input.port as string;
    const record = await storage.get('connector-port', port);
    if (!record) {
      return { variant: 'notfound', message: `Port '${port}' not found` };
    }
    await storage.del('connector-port', port);
    return { variant: 'ok', port };
  },

  async movePort(input: Record<string, unknown>, storage: ConceptStorage) {
    const port = input.port as string;
    const side = input.side as string;
    const offset = (input.offset as number) ?? 0.5;

    const record = await storage.get('connector-port', port);
    if (!record) {
      return { variant: 'notfound', message: `Port '${port}' not found` };
    }

    await storage.put('connector-port', port, {
      ...record,
      position: { side, offset },
    });

    return { variant: 'ok', port, side, offset };
  },

  async validateConnection(input: Record<string, unknown>, storage: ConceptStorage) {
    const sourcePortId = input.source_port as string;
    const targetPortId = input.target_port as string;

    const sourcePort = await storage.get('connector-port', sourcePortId);
    const targetPort = await storage.get('connector-port', targetPortId);

    if (!sourcePort || !targetPort) {
      return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: 'Port not found' };
    }

    // Direction validation
    if (sourcePort.direction === 'in') {
      return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: 'Source port only accepts incoming connections' };
    }
    if (targetPort.direction === 'out') {
      return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: 'Target port only allows outgoing connections' };
    }

    // Type compatibility
    if (sourcePort.port_type && targetPort.port_type && sourcePort.port_type !== targetPort.port_type) {
      return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: `Type mismatch: '${sourcePort.port_type}' vs '${targetPort.port_type}'` };
    }

    // Capacity check
    if (sourcePort.max_connections !== null && sourcePort.connection_count >= sourcePort.max_connections) {
      return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: `Source port at max capacity (${sourcePort.max_connections})` };
    }
    if (targetPort.max_connections !== null && targetPort.connection_count >= targetPort.max_connections) {
      return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: `Target port at max capacity (${targetPort.max_connections})` };
    }

    return { variant: 'ok', source_port: sourcePortId, target_port: targetPortId };
  },

  async incrementConnection(input: Record<string, unknown>, storage: ConceptStorage) {
    const port = input.port as string;
    const record = await storage.get('connector-port', port);
    if (!record) {
      return { variant: 'notfound', message: `Port '${port}' not found` };
    }

    const count = (record.connection_count as number) + 1;
    if (record.max_connections !== null && count > (record.max_connections as number)) {
      return { variant: 'exceeded', port, max: record.max_connections as number };
    }

    await storage.put('connector-port', port, { ...record, connection_count: count });
    return { variant: 'ok', port, count };
  },

  async decrementConnection(input: Record<string, unknown>, storage: ConceptStorage) {
    const port = input.port as string;
    const record = await storage.get('connector-port', port);
    if (!record) {
      return { variant: 'notfound', message: `Port '${port}' not found` };
    }

    const count = Math.max(0, (record.connection_count as number) - 1);
    await storage.put('connector-port', port, { ...record, connection_count: count });
    return { variant: 'ok', port, count };
  },

  async getPortsForOwner(input: Record<string, unknown>, storage: ConceptStorage) {
    const owner = input.owner as string;
    const all = await storage.list('connector-port');
    const ports = all.filter((p: Record<string, unknown>) => p.owner === owner);
    return { variant: 'ok', ports: ports.map((p: Record<string, unknown>) => p.id) };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConnectorPortCounter(): void {
  idCounter = 0;
}

export default connectorPortHandler;
