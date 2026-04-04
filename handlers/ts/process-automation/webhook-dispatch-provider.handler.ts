// @clef-handler style=functional
// WebhookDispatchProvider Concept Implementation
// Route inbound webhook events to the correct registered provider based on
// event type. Providers register for specific event type lists (JSON arrays);
// dispatch finds the matching provider and returns it with its result.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_KINDS = new Set(['step-run', 'concept-action', 'automation', 'forward']);

/** Deterministic storage key from provider name. */
function providerKey(name: string): string {
  return `wdp:${name}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';
    const kind = (input.kind as string | undefined) ?? '';
    const eventTypes = (input.eventTypes as string | undefined) ?? '';
    const config = (input.config as string | undefined) ?? '';

    // Input validation — catches empty_name, invalid_kind, invalid_event_types_json fixtures
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'invalid', {
        message: `kind must be one of: ${[...VALID_KINDS].join(', ')}`,
      }) as StorageProgram<Result>;
    }
    let parsedEventTypes: string[];
    try {
      const parsed = JSON.parse(eventTypes);
      if (!Array.isArray(parsed)) {
        return complete(createProgram(), 'invalid', { message: 'eventTypes must be a JSON array' }) as StorageProgram<Result>;
      }
      parsedEventTypes = parsed as string[];
    } catch {
      return complete(createProgram(), 'invalid', { message: 'eventTypes must be valid JSON' }) as StorageProgram<Result>;
    }

    // Uniqueness check — catches duplicate_name fixture
    const key = providerKey(name);
    let p = createProgram();
    p = get(p, 'provider', key, 'existing');
    return branch(p,
      'existing',
      (b) => complete(b, 'duplicate', { name }) as StorageProgram<Result>,
      (b) => {
        const now = new Date().toISOString();
        const record = {
          provider: key,
          name,
          kind,
          eventTypes, // store the raw JSON string
          providerConfig: config,
          registeredAt: now,
        };
        let b2 = put(b, 'provider', key, record);
        return complete(b2, 'ok', { provider: key }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  dispatch(input: Record<string, unknown>) {
    const eventType = (input.eventType as string | undefined) ?? '';
    const payload = (input.payload as string | undefined) ?? '';

    // Find all registered providers
    let p = createProgram();
    p = find(p, 'provider', {}, 'allProviders');

    // Find the first provider whose eventTypes JSON array contains eventType
    p = mapBindings(p, (bindings) => {
      const providers = (bindings.allProviders as Array<Record<string, unknown>>) || [];
      for (const prov of providers) {
        try {
          const types = JSON.parse(prov.eventTypes as string) as string[];
          if (Array.isArray(types) && types.includes(eventType)) {
            return prov;
          }
        } catch {
          // skip malformed entries
        }
      }
      return null;
    }, 'matched');

    return branch(p,
      (bindings) => bindings.matched != null,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const prov = bindings.matched as Record<string, unknown>;
        // Simulate provider invocation result
        const result = JSON.stringify({
          providerKind: prov.kind,
          eventType,
          payload,
          dispatched: true,
          timestamp: new Date().toISOString(),
        });
        return { provider: prov.provider as string, result };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {
        message: `No provider registered for event type: ${eventType}`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const eventType = (input.eventType as string | undefined) ?? '';

    let p = createProgram();
    p = find(p, 'provider', {}, 'allProviders');

    p = mapBindings(p, (bindings) => {
      const providers = (bindings.allProviders as Array<Record<string, unknown>>) || [];
      for (const prov of providers) {
        try {
          const types = JSON.parse(prov.eventTypes as string) as string[];
          if (Array.isArray(types) && types.includes(eventType)) {
            return prov;
          }
        } catch {
          // skip malformed entries
        }
      }
      return null;
    }, 'matched');

    return branch(p,
      (bindings) => bindings.matched != null,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const prov = bindings.matched as Record<string, unknown>;
        return {
          provider: prov.provider as string,
          kind: prov.kind as string,
          config: prov.providerConfig as string,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {
        message: `No provider registered for event type: ${eventType}`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';
    const key = providerKey(name);

    let p = createProgram();
    p = get(p, 'provider', key, 'existing');

    return branch(p,
      'existing',
      (b) => {
        let b2 = del(b, 'provider', key);
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {
        message: `No provider registered with name: ${name}`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const providerId = (input.provider as string | undefined) ?? '';

    let p = createProgram();
    p = get(p, 'provider', providerId, 'record');

    return branch(p,
      'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          provider: rec.provider as string,
          name: rec.name as string,
          kind: rec.kind as string,
          eventTypes: rec.eventTypes as string,
          config: rec.providerConfig as string,
          registeredAt: rec.registeredAt as string,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {
        message: `No provider found with identifier: ${providerId}`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'provider', {}, 'allProviders');
    return completeFrom(p, 'ok', (bindings) => {
      const providers = (bindings.allProviders as Array<Record<string, unknown>>) || [];
      return { providers: providers.map(rec => rec.provider as string) };
    }) as StorageProgram<Result>;
  },
};

export const webhookDispatchProviderHandler = autoInterpret(_handler);
