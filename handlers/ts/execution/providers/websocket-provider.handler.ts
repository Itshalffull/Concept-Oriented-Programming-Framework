import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * WebSocketProvider — functional handler.
 *
 * Manages WebSocket connections with send/receive lifecycle.
 * Uses perform() for actual WebSocket I/O.
 */
export const webSocketProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = pure(createProgram(), {
      variant: 'ok',
      name: 'websocket-provider',
      kind: 'protocol',
      capabilities: JSON.stringify(['text', 'binary', 'ping-pong']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configure(input: Record<string, unknown>) {
    const name = input.name as string;
    const url = input.url as string;
    const protocols = input.protocols as string || '[]';

    const connectionId = `ws-${name}`;

    let p = createProgram();
    p = put(p, 'connections', connectionId, {
      name, url, protocols, status: 'configured',
    });
    p = pure(p, { variant: 'ok', connection: connectionId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  send(input: Record<string, unknown>) {
    const connection = input.connection as string;
    const message = input.message as string;

    let p = createProgram();
    p = get(p, 'connections', `ws-${connection}`, 'connConfig');
    p = perform(p, 'ws', 'send', { connection, message }, 'sendResult');
    p = pure(p, { variant: 'ok' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  receive(input: Record<string, unknown>) {
    const connection = input.connection as string;

    let p = createProgram();
    p = get(p, 'connections', `ws-${connection}`, 'connConfig');
    p = perform(p, 'ws', 'receive', { connection }, 'recvResult');
    p = pure(p, { variant: 'ok', message: '' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  close(input: Record<string, unknown>) {
    const connection = input.connection as string;

    let p = createProgram();
    p = get(p, 'connections', `ws-${connection}`, 'connConfig');
    p = perform(p, 'ws', 'close', { connection }, 'closeResult');
    p = pure(p, { variant: 'ok' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'connections', {}, 'allConnections');
    p = pure(p, { variant: 'ok', connections: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
