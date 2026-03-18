// @migrated dsl-constructs 2026-03-18
// SlotProvider Concept Implementation [P]
// Provider lifecycle for component composition slots with centralized registry.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:slot';

export const slotProviderHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = find(p, 'slot-provider', { pluginRef: PLUGIN_REF }, 'existing');
    p = mapBindings(p, (bindings) => {
      const existing = (bindings.existing as Array<Record<string, unknown>>) || [];
      return existing.length > 0 ? (existing[0] as Record<string, unknown>).id as string : null;
    }, 'existingId');
    p = branch(p, 'existingId',
      (b) => complete(b, 'ok', { provider: '', pluginRef: PLUGIN_REF }),
      (b) => {
        try { JSON.parse(config || '{}'); } catch {
          return complete(b, 'configError', { message: 'Invalid JSON in config' });
        }
        const id = nextId('sp');
        let b2 = put(b, 'slot-provider', id, { id, pluginRef: PLUGIN_REF, status: 'active', slots: '{}', fills: '{}' });
        b2 = put(b2, 'plugin-registry', PLUGIN_REF, { pluginKind: 'surface-provider', domain: 'slot', providerRef: id, instanceId: id });
        return complete(b2, 'ok', { provider: id, pluginRef: PLUGIN_REF });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  define(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const name = input.name as string;
    const host = input.host as string;
    const position = input.position as string;
    const fallback = (input.fallback as string) || '';
    const slotKey = `${host}:${name}`;

    let p = createProgram();
    p = spGet(p, 'slot', slotKey, 'existingSlot');
    p = branch(p, 'existingSlot',
      (b) => complete(b, 'duplicate', { message: `Slot "${name}" already defined on host "${host}"` }),
      (b) => {
        const slotId = nextId('slot');
        let b2 = put(b, 'slot', slotKey, { id: slotId, name, host, position, fallback, content: '' });
        return complete(b2, 'ok', { provider, slot: slotId });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  fill(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const slot = input.slot as string;
    const content = input.content as string;

    let p = createProgram();
    p = find(p, 'slot', {}, 'allSlots');
    p = mapBindings(p, (bindings) => {
      const allSlots = (bindings.allSlots as Array<Record<string, unknown>>) || [];
      return allSlots.find(s => (s as Record<string, unknown>).id === slot || (s as Record<string, unknown>).name === slot) || null;
    }, 'target');
    p = branch(p, 'target',
      (b) => {
        let b2 = putFrom(b, 'slot', '', (bindings) => {
          const target = bindings.target as Record<string, unknown>;
          return { ...target, content };
        });
        return complete(b2, 'ok', { provider });
      },
      (b) => complete(b, 'notfound', { message: `Slot "${slot}" not defined` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clear(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const slot = input.slot as string;

    let p = createProgram();
    p = find(p, 'slot', {}, 'allSlots');
    p = mapBindings(p, (bindings) => {
      const allSlots = (bindings.allSlots as Array<Record<string, unknown>>) || [];
      return allSlots.find(s => (s as Record<string, unknown>).id === slot || (s as Record<string, unknown>).name === slot) || null;
    }, 'target');
    p = branch(p, 'target',
      (b) => {
        let b2 = putFrom(b, 'slot', '', (bindings) => {
          const target = bindings.target as Record<string, unknown>;
          return { ...target, content: '' };
        });
        return complete(b2, 'ok', { provider });
      },
      (b) => complete(b, 'notfound', { message: `Slot "${slot}" not defined` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getSlots(input: Record<string, unknown>) {
    const host = input.host as string;

    let p = createProgram();
    p = find(p, 'slot', {}, 'allSlots');
    p = mapBindings(p, (bindings) => {
      const allSlots = (bindings.allSlots as Array<Record<string, unknown>>) || [];
      return JSON.stringify(allSlots.filter(s => (s as Record<string, unknown>).host === host));
    }, 'slotsJson');
    return complete(p, 'ok', { slots: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
