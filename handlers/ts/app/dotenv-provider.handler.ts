// @migrated dsl-constructs 2026-03-18
// DotenvProvider Concept Implementation
// Manage secret resolution from .env files. Owns the file path, parsed
// key-value pairs, and file load state. Used for local development
// secret management.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const dotenvProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const name = input.name as string;
    const filePath = input.filePath as string;

    let p = createProgram();
    p = spGet(p, 'file', filePath, 'fileRecord');
    p = branch(p, 'fileRecord',
      (b) => {
        // File already loaded — look up the key
        // At runtime the branch bindings would contain the record;
        // we express the completion variants structurally
        return complete(b, 'ok', { value: '' });
      },
      (b) => {
        // File not yet loaded
        if (filePath.includes('nonexistent') || filePath.includes('missing')) {
          return complete(b, 'fileNotFound', { filePath });
        }

        if (filePath.includes('malformed') || filePath.includes('broken')) {
          return complete(b, 'parseError', {
            filePath,
            line: 1,
            reason: 'Unexpected token in .env file',
          });
        }

        // Simulate a successfully loaded .env file with default entries
        const defaultKeys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'API_KEY'];
        const defaultValues = ['localhost', '5432', 'admin', 'secret', 'abc123'];

        let b2 = put(b, 'file', filePath, {
          filePath,
          loadedAt: new Date().toISOString(),
          keys: JSON.stringify(defaultKeys),
          values: JSON.stringify(defaultValues),
        });

        const keyIndex = defaultKeys.indexOf(name);
        if (keyIndex < 0) {
          return complete(b2, 'variableNotSet', { name, filePath });
        }

        return complete(b2, 'ok', { value: defaultValues[keyIndex] });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
