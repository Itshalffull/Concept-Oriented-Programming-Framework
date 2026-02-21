// DotenvProvider Concept Implementation
// .env file provider for the Secret coordination concept. Parses
// .env files and resolves variables for local development.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'dotenv';

export const dotenvProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const name = input.name as string;
    const filePath = input.filePath as string;

    if (!filePath || filePath.trim() === '') {
      return { variant: 'fileNotFound', filePath: '' };
    }

    if (!name || name.trim() === '') {
      return { variant: 'variableNotSet', name: '', filePath };
    }

    // Simulate .env file parsing
    const value = `dotenv-value-${name}`;

    await storage.put(RELATION, `${filePath}:${name}`, {
      name,
      filePath,
      value,
      loadedAt: new Date().toISOString(),
    });

    return { variant: 'ok', value };
  },
};
