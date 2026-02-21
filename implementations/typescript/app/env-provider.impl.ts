// EnvProvider Concept Implementation
// Manage secret resolution from process environment variables. Owns the
// environment variable cache, tracks which variables have been accessed,
// and validates variable existence.
import type { ConceptHandler } from '@copf/kernel';

export const envProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const name = input.name as string;

    // Check the cache first
    const cached = await storage.get('variable', name);
    if (cached && cached.value !== null && cached.value !== undefined) {
      return {
        variant: 'ok',
        value: cached.value as string,
      };
    }

    // Resolve from process environment
    const value = process.env[name];
    if (value === undefined || value === null) {
      return {
        variant: 'variableNotSet',
        name,
      };
    }

    // Cache the resolved value
    await storage.put('variable', name, {
      name,
      value,
      cachedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      value,
    };
  },
};
