import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toBinding(record: Record<string, unknown>) {
  return {
    binding: String(record.id ?? ''),
    platform: String(record.platform ?? ''),
    destinationPattern: String(record.destinationPattern ?? ''),
    bindingKind: String(record.bindingKind ?? ''),
    payload: String(record.payload ?? ''),
  };
}

export const platformBindingCatalogHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const binding = String(input.binding ?? '');
    await storage.put('binding', binding, {
      id: binding,
      platform: String(input.platform ?? ''),
      destinationPattern: String(input.destinationPattern ?? ''),
      bindingKind: String(input.bindingKind ?? ''),
      payload: String(input.payload ?? ''),
    });
    return { variant: 'ok', binding };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const platform = String(input.platform ?? '');
    const destination = String(input.destination ?? '');
    const bindingKind = String(input.bindingKind ?? '');
    const all = await storage.find('binding', { platform, bindingKind });
    const exact = all.find((record) => String(record.destinationPattern ?? '') === destination);
    const wildcard = all.find((record) => String(record.destinationPattern ?? '') === '*');
    const match = exact ?? wildcard;
    if (!match) {
      return { variant: 'notfound', message: `No binding for ${platform}:${destination}:${bindingKind}` };
    }
    return {
      variant: 'ok',
      binding: String(match.id ?? ''),
      payload: String(match.payload ?? ''),
      matchedPattern: exact ? destination : '*',
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const platform = typeof input.platform === 'string' && input.platform.trim() ? String(input.platform) : undefined;
    const bindings = platform ? await storage.find('binding', { platform }) : await storage.find('binding', {});
    return { variant: 'ok', bindings: bindings.map((record) => toBinding(record)) };
  },
};

export default platformBindingCatalogHandler;
