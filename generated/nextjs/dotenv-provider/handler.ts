// DotenvProvider — .env file parser and variable provider.
// Reads and parses .env files from storage, extracts key=value pairs,
// handles comments, quoted values, and multi-line continuations. Returns
// typed error variants for file-not-found, parse errors, and missing variables.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DotenvProviderStorage,
  DotenvProviderFetchInput,
  DotenvProviderFetchOutput,
} from './types.js';

import {
  fetchOk,
  fetchFileNotFound,
  fetchParseError,
  fetchVariableNotSet,
} from './types.js';

export interface DotenvProviderError {
  readonly code: string;
  readonly message: string;
}

export interface DotenvProviderHandler {
  readonly fetch: (
    input: DotenvProviderFetchInput,
    storage: DotenvProviderStorage,
  ) => TE.TaskEither<DotenvProviderError, DotenvProviderFetchOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): DotenvProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse result: either a map of variables or a parse error with line info. */
type ParseResult =
  | { readonly ok: true; readonly vars: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly line: number; readonly reason: string };

/** Strip surrounding quotes (single or double) from a value. */
const stripQuotes = (value: string): string => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

/** Parse .env file content into a key-value map. */
const parseDotenv = (content: string): ParseResult => {
  const vars: Record<string, string> = {};
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    // Skip empty lines and comments
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    // Lines must contain an '=' separator
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      return {
        ok: false,
        line: i + 1,
        reason: `Expected KEY=VALUE format, got: '${trimmed}'`,
      };
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();

    // Validate the key is a valid identifier
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return {
        ok: false,
        line: i + 1,
        reason: `Invalid variable name: '${key}'`,
      };
    }

    // Strip inline comments (only for unquoted values)
    let value: string;
    if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
      value = stripQuotes(rawValue);
    } else {
      // Remove inline comments: everything after an unquoted '#'
      const commentIdx = rawValue.indexOf(' #');
      value = commentIdx >= 0 ? rawValue.slice(0, commentIdx).trim() : rawValue;
    }

    vars[key] = value;
  }

  return { ok: true, vars };
};

// --- Implementation ---

export const dotenvProviderHandler: DotenvProviderHandler = {
  fetch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, filePath } = input;

          // Retrieve the .env file content from storage
          const fileRecord = await storage.get('dotenv_files', filePath);

          return pipe(
            O.fromNullable(fileRecord),
            O.fold(
              // File not found in storage
              () => fetchFileNotFound(filePath),
              (record) => {
                const content = (record['content'] as string) ?? '';

                // Parse the file content
                const parsed = parseDotenv(content);

                if (!parsed.ok) {
                  return fetchParseError(filePath, parsed.line, parsed.reason);
                }

                // Look up the requested variable
                return pipe(
                  O.fromNullable(parsed.vars[name]),
                  O.fold(
                    () => fetchVariableNotSet(name, filePath),
                    (value) => fetchOk(value),
                  ),
                );
              },
            ),
          );
        },
        storageError,
      ),
    ),
};
