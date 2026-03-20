// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConnectorPort Handler
//
// Typed connection points on canvas items. Controls where and
// how connectors attach, with direction and data-type validation.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `port-${++idCounter}`;
}

const VALID_SIDES = ['top', 'right', 'bottom', 'left', 'center'];
const VALID_DIRECTIONS = ['in', 'out', 'bidirectional'];

const _handler: FunctionalConceptHandler = {
  addPort(input: Record<string, unknown>) {
    const owner = input.owner as string;
    const side = input.side as string;
    const offset = (input.offset as number) ?? 0.5;
    const direction = input.direction as string;
    const port_type = (input.port_type as string | undefined) ?? null;
    const label = (input.label as string | undefined) ?? null;
    const max_connections = (input.max_connections as number | undefined) ?? null;

    if (!VALID_SIDES.includes(side)) {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid side '${side}'. Must be one of: ${VALID_SIDES.join(', ')}` }) as StorageProgram<Result>;
    }
    if (!VALID_DIRECTIONS.includes(direction)) {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid direction '${direction}'. Must be one of: ${VALID_DIRECTIONS.join(', ')}` }) as StorageProgram<Result>;
    }
    if (offset < 0 || offset > 1) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Offset must be between 0.0 and 1.0' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'connector-port', id, {
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

    return complete(p, 'ok', { port: id }) as StorageProgram<Result>;
  },

  removePort(input: Record<string, unknown>) {
    const port = input.port as string;

    let p = createProgram();
    p = get(p, 'connector-port', port, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, 'connector-port', port);
        return complete(thenP, 'ok', { port });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Port '${port}' not found` }),
    ) as StorageProgram<Result>;
  },

  movePort(input: Record<string, unknown>) {
    const port = input.port as string;
    const side = input.side as string;
    const offset = (input.offset as number) ?? 0.5;

    let p = createProgram();
    p = get(p, 'connector-port', port, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'connector-port', port, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, position: { side, offset } };
        });
        return complete(thenP, 'ok', { port, side, offset });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Port '${port}' not found` }),
    ) as StorageProgram<Result>;
  },

  validateConnection(input: Record<string, unknown>) {
    const sourcePortId = input.source_port as string;
    const targetPortId = input.target_port as string;

    let p = createProgram();
    p = get(p, 'connector-port', sourcePortId, 'sourcePort');
    p = get(p, 'connector-port', targetPortId, 'targetPort');

    return branch(p,
      (bindings) => !bindings.sourcePort || !bindings.targetPort,
      (thenP) => complete(thenP, 'incompatible', { source_port: sourcePortId, target_port: targetPortId, reason: 'Port not found' }),
      (elseP) => {
        return completeFrom(elseP, 'dynamic', (bindings) => {
          const sourcePort = bindings.sourcePort as Record<string, unknown>;
          const targetPort = bindings.targetPort as Record<string, unknown>;

          if (sourcePort.direction === 'in') {
            return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: 'Source port only accepts incoming connections' };
          }
          if (targetPort.direction === 'out') {
            return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: 'Target port only allows outgoing connections' };
          }
          if (sourcePort.port_type && targetPort.port_type && sourcePort.port_type !== targetPort.port_type) {
            return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: `Type mismatch: '${sourcePort.port_type}' vs '${targetPort.port_type}'` };
          }
          if (sourcePort.max_connections !== null && sourcePort.connection_count >= sourcePort.max_connections) {
            return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: `Source port at max capacity (${sourcePort.max_connections})` };
          }
          if (targetPort.max_connections !== null && targetPort.connection_count >= targetPort.max_connections) {
            return { variant: 'incompatible', source_port: sourcePortId, target_port: targetPortId, reason: `Target port at max capacity (${targetPort.max_connections})` };
          }

          return { variant: 'ok', source_port: sourcePortId, target_port: targetPortId };
        });
      },
    ) as StorageProgram<Result>;
  },

  incrementConnection(input: Record<string, unknown>) {
    const port = input.port as string;

    let p = createProgram();
    p = get(p, 'connector-port', port, 'record');

    return branch(p, 'record',
      (thenP) => {
        return branch(thenP,
          (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            const count = (record.connection_count as number) + 1;
            return record.max_connections !== null && count > (record.max_connections as number);
          },
          (exceededP) => completeFrom(exceededP, 'exceeded', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { port, max: record.max_connections as number };
          }),
          (okP) => {
            okP = putFrom(okP, 'connector-port', port, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, connection_count: (record.connection_count as number) + 1 };
            });
            return completeFrom(okP, 'ok', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { port, count: (record.connection_count as number) + 1 };
            });
          },
        );
      },
      (elseP) => complete(elseP, 'notfound', { message: `Port '${port}' not found` }),
    ) as StorageProgram<Result>;
  },

  decrementConnection(input: Record<string, unknown>) {
    const port = input.port as string;

    let p = createProgram();
    p = get(p, 'connector-port', port, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'connector-port', port, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const count = Math.max(0, (record.connection_count as number) - 1);
          return { ...record, connection_count: count };
        });
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { port, count: Math.max(0, (record.connection_count as number) - 1) };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Port '${port}' not found` }),
    ) as StorageProgram<Result>;
  },

  getPortsForOwner(input: Record<string, unknown>) {
    const owner = input.owner as string;

    let p = createProgram();
    p = find(p, 'connector-port', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const ports = all.filter(p => p.owner === owner);
      return { ports: ports.map(p => p.id) };
    }) as StorageProgram<Result>;
  },
};

export const connectorPortHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConnectorPortCounter(): void {
  idCounter = 0;
}

export default connectorPortHandler;
