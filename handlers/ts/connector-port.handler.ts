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

    // Self-connection check (no storage needed)
    if (sourcePortId === targetPortId) {
      return complete(createProgram(), 'incompatible', {
        source_port: sourcePortId,
        target_port: targetPortId,
        reason: 'Cannot connect a port to itself',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'connector-port', sourcePortId, 'sourcePort');
    p = get(p, 'connector-port', targetPortId, 'targetPort');

    // When ports don't exist, validate by port direction rules only if known
    p = branch(p,
      (bindings) => !bindings.sourcePort && !bindings.targetPort,
      (b) => complete(b, 'ok', { source_port: sourcePortId, target_port: targetPortId }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const sourcePort = bindings.sourcePort as Record<string, unknown> | null;
          const targetPort = bindings.targetPort as Record<string, unknown> | null;

          if (!sourcePort || !targetPort) {
            return { compatible: true, reason: null };
          }
          if (sourcePort.direction === 'in') {
            return { compatible: false, reason: 'Source port only accepts incoming connections' };
          }
          if (targetPort.direction === 'out') {
            return { compatible: false, reason: 'Target port only allows outgoing connections' };
          }
          if (sourcePort.port_type && targetPort.port_type && sourcePort.port_type !== targetPort.port_type) {
            return { compatible: false, reason: `Type mismatch: '${sourcePort.port_type}' vs '${targetPort.port_type}'` };
          }
          const srcMax = sourcePort.max_connections as number | null;
          const srcCount = sourcePort.connection_count as number;
          if (srcMax !== null && srcCount >= srcMax) {
            return { compatible: false, reason: `Source port at max capacity (${srcMax})` };
          }
          const tgtMax = targetPort.max_connections as number | null;
          const tgtCount = targetPort.connection_count as number;
          if (tgtMax !== null && tgtCount >= tgtMax) {
            return { compatible: false, reason: `Target port at max capacity (${tgtMax})` };
          }
          return { compatible: true, reason: null };
        }, '_compat');

        return branch(b2,
          (bindings) => !(bindings._compat as { compatible: boolean }).compatible,
          (incompP) => completeFrom(incompP, 'incompatible', (bindings) => ({
            source_port: sourcePortId,
            target_port: targetPortId,
            reason: (bindings._compat as { reason: string }).reason,
          })),
          (okP) => complete(okP, 'ok', { source_port: sourcePortId, target_port: targetPortId }),
        );
      },
    ) as StorageProgram<Result>;

    return p as StorageProgram<Result>;
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

    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return all.filter(r => r.owner === owner);
    }, '_ownerPorts');

    return branch(p,
      (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const ownerPorts = bindings._ownerPorts as Record<string, unknown>[];
        // Error if storage has ports but none for this owner
        return all.length > 0 && ownerPorts.length === 0;
      },
      (errP) => complete(errP, 'notfound', { owner }),
      (okP) => completeFrom(okP, 'ok', (bindings) => {
        const ownerPorts = bindings._ownerPorts as Record<string, unknown>[];
        return { ports: ownerPorts.map(r => r.id) };
      }),
    ) as StorageProgram<Result>;
  },
};

export const connectorPortHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConnectorPortCounter(): void {
  idCounter = 0;
}

export default connectorPortHandler;
