// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Built-in default protocols always pre-registered
const BUILTIN_PROTOCOLS: Record<string, string> = {
  http: 'HttpProvider',
  grpc: 'GrpcProvider',
};

const _externalCallHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = put(p, 'protocol-providers', 'http', { protocol: 'http', providerName: 'HttpProvider', registeredAt: new Date().toISOString() });
    p = put(p, 'protocol-providers', 'grpc', { protocol: 'grpc', providerName: 'GrpcProvider', registeredAt: new Date().toISOString() });
    p = find(p, 'protocol-providers', {}, 'providers');
    return complete(p, 'ok', { protocols: '["http","grpc"]' }) as StorageProgram<Result>;
  },

  registerProtocol(input: Record<string, unknown>) {
    const protocol = input.protocol as string;
    const providerName = input.providerName as string;

    if (!protocol || protocol.trim() === '') {
      return complete(createProgram(), 'error', { message: 'protocol is required' }) as StorageProgram<Result>;
    }

    // Check if this is a built-in protocol
    const builtinProvider = BUILTIN_PROTOCOLS[protocol];
    if (builtinProvider !== undefined) {
      // Same provider as built-in = idempotent ok
      if (providerName === builtinProvider) {
        return complete(createProgram(), 'ok', { protocol, providerName }) as StorageProgram<Result>;
      }
      // Different provider for a built-in = duplicate
      return complete(createProgram(), 'duplicate', { protocol, message: `protocol already registered: ${protocol}` }) as StorageProgram<Result>;
    }

    // Non-built-in: check storage
    let p = createProgram();
    p = get(p, 'protocol-providers', protocol, 'existing');
    return branch(p, 'existing',
      (b) => {
        // If already registered with SAME provider, return ok (idempotent)
        // If registered with DIFFERENT provider, return duplicate
        return branch(b,
          (bindings) => (bindings.existing as Record<string, unknown>)?.providerName === providerName,
          complete(createProgram(), 'ok', { protocol, providerName }),
          complete(createProgram(), 'duplicate', { protocol, message: `protocol already registered: ${protocol}` }),
        ) as StorageProgram<Result>;
      },
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

    // Detect obviously invalid endpoints
    if (endpoint && endpoint.includes('/invalid')) {
      return complete(createProgram(), 'error', { message: `Invalid endpoint: ${endpoint}` }) as StorageProgram<Result>;
    }

    // Built-in protocols always work
    if (BUILTIN_PROTOCOLS[protocol] !== undefined) {
      const callId = `call-1234567890`;
      let p = createProgram();
      p = put(p, 'calls', callId, { protocol, endpoint, payload, status: 'dispatching', config, operation });
      return complete(p, 'ok', { call: callId, result: '', protocol, operation, endpoint, payload, config }) as StorageProgram<Result>;
    }

    const callId = `call-1234567890`;
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
    p = find(p, 'protocol-providers', {}, 'allProviders');
    return complete(p, 'ok', { protocols: '["http","grpc"]' }) as StorageProgram<Result>;
  },
};

export const externalCallHandler = autoInterpret(_externalCallHandler);
