// @migrated dsl-constructs 2026-03-18
// Connector Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _connectorHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const sourceId = input.sourceId as string;
    const protocolId = input.protocolId as string;
    const config = input.config as string;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Invalid JSON configuration' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const connectorId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = put(p, 'connector', connectorId, {
      connectorId,
      sourceId,
      protocolId,
      config: parsedConfig,
      status: 'idle',
    });
    return complete(p, 'ok', { connectorId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  read(input: Record<string, unknown>) {
    const connectorId = input.connectorId as string;
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'connector', connectorId, 'connector');
    p = branch(p, 'connector',
      (b) => {
        let b2 = put(b, 'connector', connectorId, { status: 'reading' });
        const readId = `read-${Date.now()}`;
        b2 = put(b2, 'connectorRead', readId, {
          connectorId,
          query,
          options: input.options || '{}',
          timestamp: new Date().toISOString(),
        });
        b2 = put(b2, 'connector', connectorId, { status: 'idle' });
        return complete(b2, 'ok', { data: '[]' });
      },
      (b) => complete(b, 'notfound', { message: `Connector "${connectorId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  write(input: Record<string, unknown>) {
    const connectorId = input.connectorId as string;
    const data = input.data as string;

    let p = createProgram();
    p = spGet(p, 'connector', connectorId, 'connector');
    p = branch(p, 'connector',
      (b) => {
        let b2 = put(b, 'connector', connectorId, { status: 'writing' });
        const writeId = `write-${Date.now()}`;
        b2 = put(b2, 'connectorWrite', writeId, {
          connectorId,
          data,
          options: input.options || '{}',
          timestamp: new Date().toISOString(),
        });
        b2 = put(b2, 'connector', connectorId, { status: 'idle' });
        return complete(b2, 'ok', { created: 0, updated: 0, skipped: 0, errors: 0 });
      },
      (b) => complete(b, 'notfound', { message: `Connector "${connectorId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  test(input: Record<string, unknown>) {
    const connectorId = input.connectorId as string;

    let p = createProgram();
    p = spGet(p, 'connector', connectorId, 'connector');
    p = branch(p, 'connector',
      (b) => complete(b, 'ok', { message: 'connected' }),
      (b) => complete(b, 'notfound', { message: `Connector "${connectorId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  discover(input: Record<string, unknown>) {
    const connectorId = input.connectorId as string;

    let p = createProgram();
    p = spGet(p, 'connector', connectorId, 'connector');
    p = branch(p, 'connector',
      (b) => complete(b, 'ok', { streams: '[]' }),
      (b) => complete(b, 'notfound', { message: `Connector "${connectorId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const connectorHandler = autoInterpret(_connectorHandler);

