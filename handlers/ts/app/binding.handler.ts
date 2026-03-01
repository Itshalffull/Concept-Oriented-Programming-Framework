// Binding Concept Implementation [B, C]
// Surface core binding between concepts and UI surfaces with mode-aware synchronization.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_MODES = ['coupled', 'rest', 'graphql', 'static'];

export const bindingHandler: ConceptHandler = {
  async bind(input, storage) {
    const binding = input.binding as string;
    const concept = input.concept as string;
    const mode = input.mode as string;

    if (!VALID_MODES.includes(mode)) {
      return { variant: 'invalid', message: `Invalid mode "${mode}". Valid modes: ${VALID_MODES.join(', ')}` };
    }

    const id = binding || nextId('B');

    await storage.put('binding', id, {
      concept,
      mode,
      endpoint: '',
      lastSync: '',
      status: 'bound',
      signalMap: JSON.stringify({}),
    });

    return { variant: 'ok', binding: id };
  },

  async sync(input, storage) {
    const binding = input.binding as string;

    const existing = await storage.get('binding', binding);
    if (!existing) {
      return { variant: 'error', message: 'Binding not found' };
    }

    const now = new Date().toISOString();

    await storage.put('binding', binding, {
      ...existing,
      lastSync: now,
      status: 'synced',
    });

    return { variant: 'ok', lastSync: now };
  },

  async invoke(input, storage) {
    const binding = input.binding as string;
    const action = input.action as string;
    const actionInput = input.input as string;

    const existing = await storage.get('binding', binding);
    if (!existing) {
      return { variant: 'error', message: 'Binding not found' };
    }

    if (existing.status === 'unbound') {
      return { variant: 'error', message: 'Binding is not active' };
    }

    // Simulate invoking the bound concept action
    const result = `${existing.concept}:${action}(${actionInput})`;

    return { variant: 'ok', result };
  },

  async unbind(input, storage) {
    const binding = input.binding as string;

    const existing = await storage.get('binding', binding);
    if (!existing) {
      return { variant: 'notfound', message: 'Binding not found' };
    }

    await storage.put('binding', binding, {
      ...existing,
      status: 'unbound',
      lastSync: '',
    });

    return { variant: 'ok' };
  },
};
