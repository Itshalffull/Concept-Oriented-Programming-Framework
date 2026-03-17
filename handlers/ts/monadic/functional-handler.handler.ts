import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const functionalHandlerHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const handler = input.handler as string;
    const concept = input.concept as string;
    const action = input.action as string;
    const purity = input.purity as string;

    const existing = await storage.get('handlers', handler);
    if (existing) return { variant: 'exists' };

    // Also check by concept/action pair
    const byPair = await storage.find('handlers', { concept, action });
    if (byPair.length > 0) return { variant: 'exists' };

    await storage.put('handlers', handler, {
      concept,
      action,
      purity,
      registeredAt: new Date().toISOString(),
    });
    return { variant: 'ok' };
  },

  async build(input: Record<string, unknown>, storage: ConceptStorage) {
    const handler = input.handler as string;
    const handlerInput = input.input as string;

    const h = await storage.get('handlers', handler);
    if (!h) return { variant: 'notfound' };

    // The program is a serialized representation of what the handler would do.
    // In a full implementation, the programFactory reference would be invoked here.
    const program = JSON.stringify({
      handler,
      concept: h.concept,
      action: h.action,
      input: handlerInput,
      builtAt: new Date().toISOString(),
    });

    return { variant: 'ok', program };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;
    const handlers = await storage.find('handlers', { concept });
    return {
      variant: 'ok',
      handlers: JSON.stringify(handlers.map(h => ({
        action: h.action,
        purity: h.purity,
      }))),
    };
  },
};
