// SlotProvider Concept Implementation
// Manages named content slots with type-checking and fill/clear lifecycle.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'slotprovider';
const META_KEY = '__meta__';
const SLOT_PREFIX = 'slot:';

export const slotproviderHandler: ConceptHandler = {
  /**
   * initialize(config) -> ok(provider, pluginRef) | configError(message)
   * Idempotent initialization of the slot provider.
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

    const provider = `slotprovider-${Date.now()}`;
    const pluginRef = 'surface-provider:slot';

    await storage.put(RELATION, META_KEY, {
      provider,
      pluginRef,
      config: JSON.stringify(config),
    });

    return { variant: 'ok', provider, pluginRef };
  },

  /**
   * define(slotId, name, accepts, required) -> ok(slotId) | duplicate(message)
   * Registers a new named slot with accepted content types.
   */
  async define(input, storage) {
    const slotId = input.slotId as string;
    const name = input.name as string;
    const accepts = input.accepts as string[];
    const required = input.required as boolean;

    const key = `${SLOT_PREFIX}${slotId}`;
    const existing = await storage.get(RELATION, key);
    if (existing) {
      return { variant: 'duplicate', message: `Slot "${slotId}" already exists` };
    }

    await storage.put(RELATION, key, {
      slotId,
      name,
      accepts: JSON.stringify(accepts),
      required,
      filled: false,
      contentId: null,
      contentType: null,
      content: null,
    });

    return { variant: 'ok', slotId };
  },

  /**
   * fill(slotId, contentId, contentType, content) -> ok(slotId, contentId) | notfound(message) | rejected(message)
   * Fills a slot with content, validating that the content type is accepted.
   */
  async fill(input, storage) {
    const slotId = input.slotId as string;
    const contentId = input.contentId as string;
    const contentType = input.contentType as string;
    const content = input.content;

    const key = `${SLOT_PREFIX}${slotId}`;
    const slot = await storage.get(RELATION, key);
    if (!slot) {
      return { variant: 'notfound', message: `Slot "${slotId}" does not exist` };
    }

    const accepts = JSON.parse(slot.accepts as string) as string[];
    if (accepts.length > 0 && !accepts.includes(contentType)) {
      return {
        variant: 'rejected',
        message: `Content type "${contentType}" is not accepted by slot "${slotId}". Accepted: ${accepts.join(', ')}`,
      };
    }

    await storage.put(RELATION, key, {
      ...slot,
      filled: true,
      contentId,
      contentType,
      content: typeof content === 'object' ? JSON.stringify(content) : String(content),
    });

    return { variant: 'ok', slotId, contentId };
  },

  /**
   * clear(slotId) -> ok(slotId) | notfound(message)
   * Clears the content from a slot, resetting it to empty.
   */
  async clear(input, storage) {
    const slotId = input.slotId as string;
    const key = `${SLOT_PREFIX}${slotId}`;

    const slot = await storage.get(RELATION, key);
    if (!slot) {
      return { variant: 'notfound', message: `Slot "${slotId}" does not exist` };
    }

    await storage.put(RELATION, key, {
      ...slot,
      filled: false,
      contentId: null,
      contentType: null,
      content: null,
    });

    return { variant: 'ok', slotId };
  },

  /**
   * getSlots(filter?) -> ok(slots)
   * Lists all registered slots with their fill status.
   */
  async getSlots(input, storage) {
    const filter = (input.filter as Record<string, string>) ?? {};
    const allEntries = await storage.find(RELATION, filter);

    const slots = allEntries
      .filter((e) => (e._key as string).startsWith(SLOT_PREFIX))
      .map((e) => ({
        slotId: e.slotId as string,
        name: e.name as string,
        filled: e.filled as boolean,
        contentType: (e.contentType as string | null) ?? null,
      }));

    return { variant: 'ok', slots };
  },
};
