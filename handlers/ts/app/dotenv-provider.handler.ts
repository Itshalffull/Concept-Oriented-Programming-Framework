// DotenvProvider Concept Implementation
// Manage secret resolution from .env files. Owns the file path, parsed
// key-value pairs, and file load state. Used for local development
// secret management.
import type { ConceptHandler } from '@clef/runtime';

export const dotenvProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const name = input.name as string;
    const filePath = input.filePath as string;

    // Check if the .env file has been loaded into storage
    const fileRecord = await storage.get('file', filePath);

    if (!fileRecord) {
      // Simulate loading the .env file
      if (filePath.includes('nonexistent') || filePath.includes('missing')) {
        return {
          variant: 'fileNotFound',
          filePath,
        };
      }

      if (filePath.includes('malformed') || filePath.includes('broken')) {
        return {
          variant: 'parseError',
          filePath,
          line: 1,
          reason: 'Unexpected token in .env file',
        };
      }

      // Simulate a successfully loaded .env file with default entries
      const defaultKeys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'API_KEY'];
      const defaultValues = ['localhost', '5432', 'admin', 'secret', 'abc123'];

      await storage.put('file', filePath, {
        filePath,
        loadedAt: new Date().toISOString(),
        keys: JSON.stringify(defaultKeys),
        values: JSON.stringify(defaultValues),
      });

      const keyIndex = defaultKeys.indexOf(name);
      if (keyIndex < 0) {
        return {
          variant: 'variableNotSet',
          name,
          filePath,
        };
      }

      return {
        variant: 'ok',
        value: defaultValues[keyIndex],
      };
    }

    const keys: string[] = JSON.parse(fileRecord.keys as string);
    const values: string[] = JSON.parse(fileRecord.values as string);

    const keyIndex = keys.indexOf(name);
    if (keyIndex < 0) {
      return {
        variant: 'variableNotSet',
        name,
        filePath,
      };
    }

    return {
      variant: 'ok',
      value: values[keyIndex],
    };
  },
};
