// DesignToken — handler.ts
// Design token management: define tokens with categories, resolve alias references,
// detect reference cycles, update values, and export to platform-specific formats.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DesignTokenStorage,
  DesignTokenDefineInput,
  DesignTokenDefineOutput,
  DesignTokenAliasInput,
  DesignTokenAliasOutput,
  DesignTokenResolveInput,
  DesignTokenResolveOutput,
  DesignTokenUpdateInput,
  DesignTokenUpdateOutput,
  DesignTokenRemoveInput,
  DesignTokenRemoveOutput,
  DesignTokenExportInput,
  DesignTokenExportOutput,
} from './types.js';

import {
  defineOk,
  defineDuplicate,
  aliasOk,
  aliasNotfound,
  aliasCycle,
  resolveOk,
  resolveNotfound,
  resolveBroken,
  updateOk,
  updateNotfound,
  removeOk,
  removeNotfound,
  exportOk,
  exportUnsupported,
} from './types.js';

export interface DesignTokenError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): DesignTokenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface DesignTokenHandler {
  readonly define: (
    input: DesignTokenDefineInput,
    storage: DesignTokenStorage,
  ) => TE.TaskEither<DesignTokenError, DesignTokenDefineOutput>;
  readonly alias: (
    input: DesignTokenAliasInput,
    storage: DesignTokenStorage,
  ) => TE.TaskEither<DesignTokenError, DesignTokenAliasOutput>;
  readonly resolve: (
    input: DesignTokenResolveInput,
    storage: DesignTokenStorage,
  ) => TE.TaskEither<DesignTokenError, DesignTokenResolveOutput>;
  readonly update: (
    input: DesignTokenUpdateInput,
    storage: DesignTokenStorage,
  ) => TE.TaskEither<DesignTokenError, DesignTokenUpdateOutput>;
  readonly remove: (
    input: DesignTokenRemoveInput,
    storage: DesignTokenStorage,
  ) => TE.TaskEither<DesignTokenError, DesignTokenRemoveOutput>;
  readonly export: (
    input: DesignTokenExportInput,
    storage: DesignTokenStorage,
  ) => TE.TaskEither<DesignTokenError, DesignTokenExportOutput>;
}

// Walk the alias chain to find the concrete value. Tracks visited set to detect cycles.
const walkAliasChain = async (
  tokenId: string,
  storage: DesignTokenStorage,
  visited: ReadonlySet<string> = new Set(),
): Promise<
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'notfound'; readonly at: string }
  | { readonly ok: false; readonly reason: 'cycle'; readonly at: string }
> => {
  if (visited.has(tokenId)) {
    return { ok: false, reason: 'cycle', at: tokenId };
  }
  const record = await storage.get('token', tokenId);
  if (!record) {
    return { ok: false, reason: 'notfound', at: tokenId };
  }
  const ref = record['reference'] as string | undefined;
  if (ref) {
    const next = new Set(visited);
    next.add(tokenId);
    return walkAliasChain(ref, storage, next);
  }
  return { ok: true, value: record['value'] as string };
};

const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(['css', 'scss', 'json', 'js']);

// --- Implementation ---

export const designTokenHandler: DesignTokenHandler = {
  // Register a new concrete design token. Rejects if token id already exists.
  define: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('token', input.token), storageErr),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(async () => {
                await storage.put('token', input.token, {
                  token: input.token,
                  name: input.name,
                  value: input.value,
                  type: input.type,
                  tier: input.tier,
                });
                return defineOk(input.token);
              }, storageErr),
            () =>
              TE.right(defineDuplicate(`Token '${input.token}' already exists`)),
          ),
        ),
      ),
    ),

  // Create an alias token pointing at another token. Validates that the reference
  // target exists and that following the chain would not create a cycle.
  alias: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('token', input.reference), storageErr),
      TE.chain((refRecord) =>
        pipe(
          O.fromNullable(refRecord),
          O.fold(
            () =>
              TE.right(aliasNotfound(`Referenced token '${input.reference}' not found`)),
            () =>
              TE.tryCatch(async () => {
                // Check that walking from reference does not revisit `input.token`
                const check = await walkAliasChain(input.reference, storage, new Set([input.token]));
                if (!check.ok && check.reason === 'cycle') {
                  return aliasCycle(
                    `Alias '${input.token}' -> '${input.reference}' would create a reference cycle`,
                  );
                }
                await storage.put('token', input.token, {
                  token: input.token,
                  name: input.name,
                  reference: input.reference,
                  tier: input.tier,
                  isAlias: true,
                });
                return aliasOk(input.token);
              }, storageErr),
          ),
        ),
      ),
    ),

  // Resolve a token to its final concrete value by following alias references.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const result = await walkAliasChain(input.token, storage);
        if (result.ok) {
          return resolveOk(input.token, result.value);
        }
        if (result.reason === 'notfound' && result.at === input.token) {
          return resolveNotfound(`Token '${input.token}' not found`);
        }
        return resolveBroken(
          `Reference chain broken at '${result.at}'`,
          result.at,
        );
      }, storageErr),
    ),

  // Update a token's value. Uses Option to distinguish between "change the value"
  // and "touch without changing".
  update: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('token', input.token), storageErr),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(updateNotfound(`Token '${input.token}' not found`)),
            (existing) =>
              pipe(
                input.value,
                O.fold(
                  () => TE.right(updateOk(input.token)),
                  (newValue) =>
                    TE.tryCatch(async () => {
                      await storage.put('token', input.token, { ...existing, value: newValue });
                      return updateOk(input.token);
                    }, storageErr),
                ),
              ),
          ),
        ),
      ),
    ),

  // Remove a token by id. Returns notfound when the token does not exist.
  remove: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('token', input.token), storageErr),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(removeNotfound(`Token '${input.token}' not found`)),
            () =>
              TE.tryCatch(async () => {
                await storage.delete('token', input.token);
                return removeOk(input.token);
              }, storageErr),
          ),
        ),
      ),
    ),

  // Export all tokens in a platform-specific format.
  // Supported: css (custom properties), scss (variables), json, js (ES module export).
  export: (input, storage) => {
    if (!SUPPORTED_FORMATS.has(input.format)) {
      return TE.right(
        exportUnsupported(
          `Format '${input.format}' is not supported. Use one of: ${[...SUPPORTED_FORMATS].join(', ')}`,
        ),
      );
    }
    return pipe(
      TE.tryCatch(async () => {
        const tokens = await storage.find('token');
        const pairs: readonly { readonly name: string; readonly value: string }[] =
          await Promise.all(
            tokens.map(async (t) => {
              const name = t['name'] as string;
              const result = await walkAliasChain(t['token'] as string, storage);
              const value = result.ok ? result.value : `unresolved(${t['token']})`;
              return { name, value } as const;
            }),
          );

        switch (input.format) {
          case 'css':
            return exportOk(
              `:root {\n${pairs.map((p) => `  --${p.name}: ${p.value};`).join('\n')}\n}`,
            );
          case 'scss':
            return exportOk(
              pairs.map((p) => `$${p.name}: ${p.value};`).join('\n'),
            );
          case 'json':
            return exportOk(
              JSON.stringify(
                Object.fromEntries(pairs.map((p) => [p.name, p.value])),
                null,
                2,
              ),
            );
          case 'js':
          default:
            return exportOk(
              `export const tokens = ${JSON.stringify(
                Object.fromEntries(pairs.map((p) => [p.name, p.value])),
                null,
                2,
              )};`,
            );
        }
      }, storageErr),
    );
  },
};
