// SlotProvider Concept Implementation [P]
// Provider lifecycle for component composition slots with centralized registry.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:slot';

export const slotProviderHandler: ConceptHandler = {
  async initialize(input, storage) {
    const config = input.config as string;

    const existing = await storage.find('slot-provider', { pluginRef: PLUGIN_REF });
    if (existing.length > 0) {
      return { variant: 'ok', provider: (existing[0] as Record<string, unknown>).id as string, pluginRef: PLUGIN_REF };
    }

    try {
      JSON.parse(config || '{}');
    } catch {
      return { variant: 'configError', message: 'Invalid JSON in config' };
    }

    const id = nextId('sp');

    await storage.put('slot-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      slots: '{}',
      fills: '{}',
    });

    await storage.put('plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'slot',
      providerRef: id,
      instanceId: id,
    });

    return { variant: 'ok', provider: id, pluginRef: PLUGIN_REF };
  },

  async define(input, storage) {
    const provider = input.provider as string;
    const name = input.name as string;
    const host = input.host as string;
    const position = input.position as string;
    const fallback = (input.fallback as string) || '';

    const slotKey = `${host}:${name}`;

    // Check for duplicate
    const existingSlot = await storage.get('slot', slotKey);
    if (existingSlot) {
      return { variant: 'duplicate', message: `Slot "${name}" already defined on host "${host}"` };
    }

    const slotId = nextId('slot');
    await storage.put('slot', slotKey, {
      id: slotId,
      name,
      host,
      position,
      fallback,
      content: '',
    });

    // Update provider's slot registry
    const instance = await storage.get('slot-provider', provider);
    if (instance) {
      const slots = JSON.parse((instance.slots as string) || '{}');
      slots[slotKey] = { id: slotId, name, host, position };
      await storage.put('slot-provider', provider, { ...instance, slots: JSON.stringify(slots) });
    }

    return { variant: 'ok', provider, slot: slotId };
  },

  async fill(input, storage) {
    const provider = input.provider as string;
    const slot = input.slot as string;
    const content = input.content as string;

    // Find slot by ID or key
    const allSlots = await storage.find('slot', {});
    const target = allSlots.find(s => {
      const rec = s as Record<string, unknown>;
      return rec.id === slot || rec.name === slot;
    }) as Record<string, unknown> | undefined;

    if (!target) {
      return { variant: 'notfound', message: `Slot "${slot}" not defined` };
    }

    const key = `${target.host}:${target.name}`;
    await storage.put('slot', key, { ...target, content });

    // Update fills map
    const instance = await storage.get('slot-provider', provider);
    if (instance) {
      const fills = JSON.parse((instance.fills as string) || '{}');
      fills[key] = content;
      await storage.put('slot-provider', provider, { ...instance, fills: JSON.stringify(fills) });
    }

    return { variant: 'ok', provider };
  },

  async clear(input, storage) {
    const provider = input.provider as string;
    const slot = input.slot as string;

    const allSlots = await storage.find('slot', {});
    const target = allSlots.find(s => {
      const rec = s as Record<string, unknown>;
      return rec.id === slot || rec.name === slot;
    }) as Record<string, unknown> | undefined;

    if (!target) {
      return { variant: 'notfound', message: `Slot "${slot}" not defined` };
    }

    const key = `${target.host}:${target.name}`;
    await storage.put('slot', key, { ...target, content: '' });

    const instance = await storage.get('slot-provider', provider);
    if (instance) {
      const fills = JSON.parse((instance.fills as string) || '{}');
      delete fills[key];
      await storage.put('slot-provider', provider, { ...instance, fills: JSON.stringify(fills) });
    }

    return { variant: 'ok', provider };
  },

  async getSlots(input, storage) {
    const host = input.host as string;

    const allSlots = await storage.find('slot', {});
    const hostSlots = allSlots.filter(s => (s as Record<string, unknown>).host === host);

    return { variant: 'ok', slots: JSON.stringify(hostSlots) };
  },
};
