// @clef-handler style=imperative concept=grpc-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * GrpcProvider — functional handler.
 *
 * Executes gRPC calls against configured channel instances.
 * Uses perform() for actual network I/O.
 */
export const grpcProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = pure(createProgram(), {
      variant: 'ok',
      name: 'grpc-provider',
      kind: 'protocol',
      capabilities: JSON.stringify(['unary', 'server-stream', 'client-stream', 'bidi']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configure(input: Record<string, unknown>) {
    const name = input.name as string;
    const target = input.target as string;
    const protoRef = input.protoRef as string;
    const options = input.options as string || '{}';

    const channelId = `grpc-${name}`;

    let p = createProgram();
    p = put(p, 'channels', channelId, {
      name, target, protoRef, options, status: 'ready',
    });
    p = pure(p, { variant: 'ok', channel: channelId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const channel = input.channel as string;
    const service = input.service as string;
    const method = input.method as string;
    const payload = input.payload as string;

    let p = createProgram();
    p = get(p, 'channels', `grpc-${channel}`, 'channelConfig');
    p = perform(p, 'grpc', 'invoke', {
      channel, service, method, payload,
    }, 'grpcResponse');
    p = pure(p, { variant: 'ok', response: '' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'channels', {}, 'allChannels');
    p = pure(p, { variant: 'ok', channels: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
