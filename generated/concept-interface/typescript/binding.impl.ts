// Binding Concept Implementation
// Bridges backend concepts to frontend signals with mode-based connectivity.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'binding';

const VALID_MODES = ['coupled', 'rest', 'graphql', 'static'] as const;

export const bindingHandler: ConceptHandler = {
  /**
   * bind(binding, concept, mode) -> ok(binding) | invalid(message)
   * Creates a new binding between a concept and frontend, validating the mode.
   */
  async bind(input, storage) {
    const binding = input.binding as string;
    const concept = input.concept as string;
    const mode = input.mode as string;

    if (!VALID_MODES.includes(mode as typeof VALID_MODES[number])) {
      return {
        variant: 'invalid',
        message: `Invalid binding mode "${mode}". Valid modes: ${VALID_MODES.join(', ')}`,
      };
    }

    await storage.put(RELATION, binding, {
      binding,
      concept,
      mode,
      endpoint: mode === 'static' ? null : `/${concept}`,
      lastSync: null,
      status: 'bound',
      signalMap: '{}',
    });

    return { variant: 'ok', binding };
  },

  /**
   * sync(binding) -> ok(binding) | error(message)
   * Performs a synchronization, updating the lastSync timestamp.
   */
  async sync(input, storage) {
    const binding = input.binding as string;

    const existing = await storage.get(RELATION, binding);
    if (!existing) {
      return { variant: 'error', message: `Binding "${binding}" does not exist` };
    }

    if (existing.status === 'unbound') {
      return { variant: 'error', message: `Binding "${binding}" has been unbound` };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, binding, {
      ...existing,
      lastSync: now,
      status: 'synced',
    });

    return { variant: 'ok', binding };
  },

  /**
   * invoke(binding, action, input) -> ok(binding, result) | error(message)
   * Invokes an action through the binding, returning a serialized result.
   */
  async invoke(input, storage) {
    const binding = input.binding as string;
    const action = input.action as string;
    const actionInput = input.input as string;

    const existing = await storage.get(RELATION, binding);
    if (!existing) {
      return { variant: 'error', message: `Binding "${binding}" does not exist` };
    }

    if (existing.status === 'unbound') {
      return { variant: 'error', message: `Binding "${binding}" has been unbound and cannot invoke actions` };
    }

    // Validate input is parseable JSON
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(actionInput);
    } catch {
      return { variant: 'error', message: `Invalid input JSON for action "${action}"` };
    }

    // Simulate invocation result based on mode
    const mode = existing.mode as string;
    const result = JSON.stringify({
      concept: existing.concept,
      action,
      mode,
      input: parsedInput,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    // Update last sync
    await storage.put(RELATION, binding, {
      ...existing,
      lastSync: new Date().toISOString(),
    });

    return { variant: 'ok', binding, result };
  },

  /**
   * unbind(binding) -> ok(binding) | notfound(message)
   * Disconnects a binding, marking it as unbound.
   */
  async unbind(input, storage) {
    const binding = input.binding as string;

    const existing = await storage.get(RELATION, binding);
    if (!existing) {
      return { variant: 'notfound', message: `Binding "${binding}" does not exist` };
    }

    await storage.put(RELATION, binding, {
      ...existing,
      status: 'unbound',
      endpoint: null,
    });

    return { variant: 'ok', binding };
  },
};
