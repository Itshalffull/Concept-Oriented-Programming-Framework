// @clef-handler style=imperative concept=grpc-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform, branch,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * GrpcProvider — functional handler.
 *
 * Executes gRPC calls against configured channel instances.
 * Uses perform() for actual network I/O.
 */
export const grpcProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'GrpcProvider',
      kind: 'protocol',
      capabilities: JSON.stringify(['unary', 'server-stream', 'client-stream', 'bidi']) });
    return p as StorageProgram<Result>;
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
    p = complete(p, 'ok', { channel: channelId });
    return p as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const channel = input.channel as string;
    const service = input.service as string;
    const method = input.method as string;
    const payload = input.payload as string;

    let p = createProgram();
    p = get(p, 'channels', `grpc-${channel}`, 'channelConfig');
    return branch(p, 'channelConfig',
      (thenP) => {
        let p2 = perform(thenP, 'grpc', 'invoke', {
          channel, service, method, payload,
        }, 'grpcResponse');
        return complete(p2, 'ok', { response: '' });
      },
      (elseP) => complete(elseP, 'notFound', { message: `channel not found: ${channel}` }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'channels', {}, 'allChannels');
    p = complete(p, 'ok', { channels: '[]' });
    return p as StorageProgram<Result>;
  },
};
