// EnvProvider Concept Implementation
// Environment variable provider for the Secret coordination concept.
// Fetches secrets from process environment variables.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'env';

export const envProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const name = input.name as string;

    if (!name || name.trim() === '') {
      return { variant: 'variableNotSet', name: '' };
    }

    // Simulate environment variable lookup
    const value = `env-value-${name}`;

    await storage.put(RELATION, name, {
      name,
      value,
      cachedAt: new Date().toISOString(),
    });

    return { variant: 'ok', value };
  },
};
