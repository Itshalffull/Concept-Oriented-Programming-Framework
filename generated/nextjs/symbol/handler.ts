// Symbol — Symbol table management with scope-aware registration and resolution
// Registers symbols with kind/scope metadata, resolves references, and handles shadowing.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SymbolStorage,
  SymbolRegisterInput,
  SymbolRegisterOutput,
  SymbolResolveInput,
  SymbolResolveOutput,
  SymbolFindByKindInput,
  SymbolFindByKindOutput,
  SymbolFindByFileInput,
  SymbolFindByFileOutput,
  SymbolRenameInput,
  SymbolRenameOutput,
  SymbolGetInput,
  SymbolGetOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyExists,
  resolveOk,
  resolveNotfound,
  resolveAmbiguous,
  findByKindOk,
  findByFileOk,
  renameOk,
  renameConflict,
  renameNotfound,
  getOk,
  getNotfound,
} from './types.js';

export interface SymbolError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): SymbolError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Derive namespace from the symbol string (everything before the last segment). */
const deriveNamespace = (symbolString: string): string => {
  const parts = symbolString.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : '';
};

/** Generate a stable unique key for a symbol by its fully-qualified name. */
const symbolKey = (symbolString: string): string =>
  `sym_${symbolString.replace(/[^a-zA-Z0-9_]/g, '_')}`;

export interface SymbolHandler {
  readonly register: (
    input: SymbolRegisterInput,
    storage: SymbolStorage,
  ) => TE.TaskEither<SymbolError, SymbolRegisterOutput>;
  readonly resolve: (
    input: SymbolResolveInput,
    storage: SymbolStorage,
  ) => TE.TaskEither<SymbolError, SymbolResolveOutput>;
  readonly findByKind: (
    input: SymbolFindByKindInput,
    storage: SymbolStorage,
  ) => TE.TaskEither<SymbolError, SymbolFindByKindOutput>;
  readonly findByFile: (
    input: SymbolFindByFileInput,
    storage: SymbolStorage,
  ) => TE.TaskEither<SymbolError, SymbolFindByFileOutput>;
  readonly rename: (
    input: SymbolRenameInput,
    storage: SymbolStorage,
  ) => TE.TaskEither<SymbolError, SymbolRenameOutput>;
  readonly get: (
    input: SymbolGetInput,
    storage: SymbolStorage,
  ) => TE.TaskEither<SymbolError, SymbolGetOutput>;
}

// --- Implementation ---

export const symbolHandler: SymbolHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('symbol', symbolKey(input.symbolString)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const key = symbolKey(input.symbolString);
                  const ns = deriveNamespace(input.symbolString);
                  await storage.put('symbol', key, {
                    id: key,
                    symbolString: input.symbolString,
                    kind: input.kind,
                    displayName: input.displayName,
                    definingFile: input.definingFile,
                    namespace: ns,
                    visibility: 'public',
                    createdAt: new Date().toISOString(),
                  });
                  return registerOk(key);
                },
                storageError,
              ),
            (found) => TE.right(registerAlreadyExists(String(found['id']))),
          ),
        ),
      ),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // First try exact match
          const exact = await storage.get('symbol', symbolKey(input.symbolString));
          if (exact) return [exact];
          // Then search for partial matches (unqualified name)
          const all = await storage.find('symbol', { symbolString: input.symbolString });
          return [...all];
        },
        storageError,
      ),
      TE.chain((candidates) => {
        if (candidates.length === 0) return TE.right(resolveNotfound());
        if (candidates.length === 1) return TE.right(resolveOk(String(candidates[0]['id'])));
        // Multiple candidates -- ambiguous reference
        const ids = candidates.map((c) => String(c['id']));
        return TE.right(resolveAmbiguous(JSON.stringify(ids)));
      }),
    ),

  findByKind: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('symbol', { kind: input.kind });
          const filtered = input.namespace
            ? records.filter((r) => String(r['namespace']) === input.namespace)
            : records;
          const ids = filtered.map((r) => String(r['id']));
          return findByKindOk(JSON.stringify(ids));
        },
        storageError,
      ),
    ),

  findByFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('symbol', { definingFile: input.file });
          const ids = records.map((r) => String(r['id']));
          return findByFileOk(JSON.stringify(ids));
        },
        storageError,
      ),
    ),

  rename: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('symbol', input.symbol),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(renameNotfound()),
            (found) =>
              TE.tryCatch(
                async () => {
                  // Check if new name already exists within the same namespace
                  const ns = String(found['namespace']);
                  const newSymbolString = ns ? `${ns}.${input.newName}` : input.newName;
                  const conflicting = await storage.get('symbol', symbolKey(newSymbolString));
                  if (conflicting) {
                    return renameConflict(String(conflicting['id']));
                  }
                  const oldName = String(found['displayName']);
                  // Update occurrences by scanning for references to this symbol
                  const occurrences = await storage.find('occurrence', { symbol: input.symbol });
                  const occurrencesUpdated = occurrences.length;
                  // Update the symbol record itself
                  await storage.put('symbol', input.symbol, {
                    ...found,
                    displayName: input.newName,
                    symbolString: newSymbolString,
                  });
                  return renameOk(oldName, occurrencesUpdated);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('symbol', input.symbol),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['symbolString']),
                  String(found['kind']),
                  String(found['displayName']),
                  String(found['visibility']),
                  String(found['definingFile']),
                  String(found['namespace']),
                ),
              ),
          ),
        ),
      ),
    ),
};
