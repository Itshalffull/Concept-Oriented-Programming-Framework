// BindingProvider Concept Implementation
// Manages data bindings between source and target elements with one-way and two-way sync.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'bindingprovider';
const META_KEY = '__meta__';
const BINDING_PREFIX = 'bind:';

export const bindingproviderHandler: ConceptHandler = {
  /**
   * initialize(config) -> ok(provider, pluginRef) | configError(message)
   * Idempotent initialization of the binding provider.
   */
  async initialize(input, storage) {
    const config = input.config as Record<string, unknown>;

    if (!config || typeof config !== 'object') {
      return { variant: 'configError', message: 'Config must be a non-null object' };
    }

    const existing = await storage.get(RELATION, META_KEY);
    if (existing) {
      return {
        variant: 'ok',
        provider: existing.provider as string,
        pluginRef: existing.pluginRef as string,
      };
    }

    const provider = `bindingprovider-${Date.now()}`;
    const pluginRef = 'surface-provider:binding';

    await storage.put(RELATION, META_KEY, {
      provider,
      pluginRef,
      config: JSON.stringify(config),
    });

    return { variant: 'ok', provider, pluginRef };
  },

  /**
   * bind(bindingId, source, target, direction) -> ok(bindingId) | duplicate(message) | invalid(message)
   * Creates a new data binding between a source and target.
   */
  async bind(input, storage) {
    const bindingId = input.bindingId as string;
    const source = input.source as string;
    const target = input.target as string;
    const direction = input.direction as string;

    if (!source || !target) {
      return { variant: 'invalid', message: 'Source and target are required' };
    }

    if (direction !== 'oneWay' && direction !== 'twoWay') {
      return { variant: 'invalid', message: `Direction must be "oneWay" or "twoWay", got "${direction}"` };
    }

    if (source === target) {
      return { variant: 'invalid', message: 'Source and target cannot be the same' };
    }

    const key = `${BINDING_PREFIX}${bindingId}`;
    const existing = await storage.get(RELATION, key);
    if (existing) {
      return { variant: 'duplicate', message: `Binding "${bindingId}" already exists` };
    }

    await storage.put(RELATION, key, {
      bindingId,
      source,
      target,
      direction,
      synced: false,
      lastValue: null,
    });

    return { variant: 'ok', bindingId };
  },

  /**
   * sync(bindingId) -> ok(bindingId, synced) | notfound(message)
   * Triggers synchronization of the binding, propagating the current value.
   */
  async sync(input, storage) {
    const bindingId = input.bindingId as string;
    const key = `${BINDING_PREFIX}${bindingId}`;

    const existing = await storage.get(RELATION, key);
    if (!existing) {
      return { variant: 'notfound', message: `Binding "${bindingId}" does not exist` };
    }

    await storage.put(RELATION, key, {
      ...existing,
      synced: true,
    });

    return { variant: 'ok', bindingId, synced: true };
  },

  /**
   * invoke(bindingId, value) -> ok(bindingId, propagated) | notfound(message)
   * Pushes a value through the binding, updating the stored last value.
   */
  async invoke(input, storage) {
    const bindingId = input.bindingId as string;
    const value = input.value;
    const key = `${BINDING_PREFIX}${bindingId}`;

    const existing = await storage.get(RELATION, key);
    if (!existing) {
      return { variant: 'notfound', message: `Binding "${bindingId}" does not exist` };
    }

    await storage.put(RELATION, key, {
      ...existing,
      lastValue: typeof value === 'object' ? JSON.stringify(value) : String(value),
      synced: true,
    });

    return { variant: 'ok', bindingId, propagated: true };
  },

  /**
   * unbind(bindingId) -> ok(bindingId) | notfound(message)
   * Removes a binding after verifying it exists.
   */
  async unbind(input, storage) {
    const bindingId = input.bindingId as string;
    const key = `${BINDING_PREFIX}${bindingId}`;

    const existing = await storage.get(RELATION, key);
    if (!existing) {
      return { variant: 'notfound', message: `Binding "${bindingId}" does not exist` };
    }

    await storage.del(RELATION, key);
    return { variant: 'ok', bindingId };
  },
};
