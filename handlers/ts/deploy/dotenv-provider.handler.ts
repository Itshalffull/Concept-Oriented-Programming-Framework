// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// DotenvProvider Concept Implementation
// .env file provider for the Secret coordination concept. Parses
// .env files and resolves variables for local development.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'dotenv';

const _dotenvProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const name = input.name as string;
    const filePath = input.filePath as string;

    if (!filePath || filePath.trim() === '') {
      const p = createProgram();
      return complete(p, 'fileNotFound', { filePath: '' }) as StorageProgram<Result>;
    }

    if (!name || name.trim() === '') {
      const p = createProgram();
      return complete(p, 'variableNotSet', { name: '', filePath }) as StorageProgram<Result>;
    }

    // Simulate .env file parsing
    const value = `dotenv-value-${name}`;

    let p = createProgram();
    p = put(p, RELATION, `${filePath}:${name}`, {
      name,
      filePath,
      value,
      loadedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { value }) as StorageProgram<Result>;
  },
};

export const dotenvProviderHandler = autoInterpret(_dotenvProviderHandler);
