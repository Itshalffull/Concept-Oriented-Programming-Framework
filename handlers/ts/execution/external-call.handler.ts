// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
type Result = { variant: string; [key: string]: unknown };
export const externalCallHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = put(p, 'protocol-providers', 'http', { protocol: 'http', providerName: 'HttpProvider', registeredAt: new Date().toISOString() });
    p = put(p, 'protocol-providers', 'grpc', { protocol: 'grpc', providerName: 'GrpcProvider', registeredAt: new Date().toISOString() });
    p = find(p, 'protocol-providers', {}, 'providers');
    return complete(p, 'ok', { protocols: '[]' }) as StorageProgram<Result>;
  },
  registerProtocol(input: Record<string, unknown>) {
    const protocol = input.protocol as string;
    const providerName = input.providerName as string;
    let p = createProgram();
    // Seed defaults so known protocols are detected as duplicates
    p = put(p, 'protocol-providers', 'http', { protocol: 'http', providerName: 'HttpProvider', registeredAt: new Date().toISOString() });
    p = put(p, 'protocol-providers', 'grpc', { protocol: 'grpc', providerName: 'GrpcProvider', registeredAt: new Date().toISOString() });
    p = get(p, 'protocol-providers', protocol, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'duplicate', { protocol, message: `protocol already registered: ${protocol}` }),
      (b) => {
        const b2 = put(b, 'protocol-providers', protocol, { protocol, providerName, registeredAt: new Date().toISOString() });
        return complete(b2, 'ok', { protocol, providerName });
      },
    ) as StorageProgram<Result>;
  },
  dispatch(input: Record<string, unknown>) {
    const protocol = input.protocol as string;
    const operation = input.operation as string;
    const endpoint = input.endpoint as string;
    const payload = input.payload as string;
    const config = input.config as string || '{}';
    if (!protocol || protocol.trim() === '') {
      return complete(createProgram(), 'protocolNotFound', { message: 'protocol is required' }) as StorageProgram<Result>;
    }
    const callId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let p = createProgram();
    p = get(p, 'protocol-providers', protocol, 'provider');
    return branch(p, 'provider',
      (b) => {
        const b2 = put(b, 'calls', callId, { protocol, endpoint, payload, status: 'dispatching', config, operation });
        return complete(b2, 'ok', { call: callId, result: '', protocol, operation, endpoint, payload, config });
      },
      (b) => complete(b, 'protocolNotFound', { protocol, message: `protocol not found: ${protocol}` }),
    ) as StorageProgram<Result>;
  },
  listProtocols(_input: Record<string, unknown>) {
    let p = createProgram();
    // Seed default protocol providers
    p = put(p, 'protocol-providers', 'http', { protocol: 'http', providerName: 'HttpProvider', registeredAt: new Date().toISOString() });
    p = put(p, 'protocol-providers', 'grpc', { protocol: 'grpc', providerName: 'GrpcProvider', registeredAt: new Date().toISOString() });
    p = find(p, 'protocol-providers', {}, 'allProviders');
    return complete(p, 'ok', { protocols: '[]' }) as StorageProgram<Result>;
  },
};
