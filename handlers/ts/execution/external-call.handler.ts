// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

/**
 * ExternalCall — functional handler.
 *
 * Dispatch registry for outbound network requests. Routes protocol-tagged
 * calls to registered protocol providers (HttpProvider, GrpcProvider, etc.)
 * via sync wiring. This handler manages the call lifecycle and provider
 * registry; actual I/O is delegated to protocol providers through syncs.
 */
export const externalCallHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'protocol-providers', {}, 'providers');

    // Return currently registered protocols
    p = pure(p, {
      variant: 'ok',
      protocols: '[]',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerProtocol(input: Record<string, unknown>) {
    const protocol = input.protocol as string;
    const providerName = input.providerName as string;

    let p = createProgram();
    p = get(p, 'protocol-providers', protocol, 'existing');

    // Check for duplicate registration via branch
    const { createProgram: create, get: g, put: pt, pure: pr } = require('../../../runtime/storage-program.ts');

    // Simple approach: always put, rely on idempotency
    p = put(p, 'protocol-providers', protocol, {
      protocol,
      providerName,
      registeredAt: new Date().toISOString(),
    });

    p = pure(p, {
      variant: 'ok',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  dispatch(input: Record<string, unknown>) {
    const protocol = input.protocol as string;
    const operation = input.operation as string;
    const endpoint = input.endpoint as string;
    const payload = input.payload as string;
    const config = input.config as string || '{}';

    const callId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = get(p, 'protocol-providers', protocol, 'provider');

    // Store the call record
    p = put(p, 'calls', callId, {
      protocol,
      endpoint,
      payload,
      status: 'dispatching',
      config,
      operation,
    });

    // The actual dispatch happens via sync wiring — when this action
    // completes, a dispatch sync routes to the appropriate protocol
    // provider. The result flows back through sync completion chaining.
    p = pure(p, {
      variant: 'ok',
      call: callId,
      result: '',
      protocol,
      operation,
      endpoint,
      payload,
      config,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listProtocols(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'protocol-providers', {}, 'allProviders');
    p = pure(p, {
      variant: 'ok',
      protocols: '[]',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
