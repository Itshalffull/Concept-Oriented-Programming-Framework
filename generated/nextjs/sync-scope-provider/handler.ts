// SyncScopeProvider — Provides scoping for sync rule definitions, managing
// visibility of bindings, triggers, guards, and transform functions within
// sync spec blocks and across inherited sync compositions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncScopeProviderStorage,
  SyncScopeProviderInitializeInput,
  SyncScopeProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface SyncScopeProviderError {
  readonly code: string;
  readonly message: string;
}

interface SyncScopeEntry {
  readonly name: string;
  readonly kind: 'binding' | 'trigger' | 'guard' | 'transform' | 'field-ref';
  readonly syncName: string;
  readonly direction: 'source' | 'target' | 'bidirectional' | 'none';
}

interface SyncScope {
  readonly syncName: string;
  readonly parentScope: string | null;
  readonly entries: readonly SyncScopeEntry[];
}

// --- Helpers ---

const storageError = (error: unknown): SyncScopeProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `ssp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract scope entries from a parsed sync spec
const extractSyncScopeEntries = (syncName: string, spec: Record<string, unknown>): readonly SyncScopeEntry[] => {
  const entries: SyncScopeEntry[] = [];

  // Bindings
  const bindings = spec['bindings'];
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      if (typeof binding === 'object' && binding !== null) {
        const b = binding as Record<string, unknown>;
        const name = String(b['name'] ?? b['source'] ?? '');
        if (name !== '') {
          const direction = String(b['direction'] ?? 'bidirectional');
          entries.push({
            name,
            kind: 'binding',
            syncName,
            direction: direction as SyncScopeEntry['direction'],
          });
        }
        // Also register the field references within this binding
        const sourceField = String(b['sourceField'] ?? '');
        const targetField = String(b['targetField'] ?? '');
        if (sourceField !== '') {
          entries.push({ name: sourceField, kind: 'field-ref', syncName, direction: 'source' });
        }
        if (targetField !== '') {
          entries.push({ name: targetField, kind: 'field-ref', syncName, direction: 'target' });
        }
      }
    }
  }

  // Triggers
  const triggers = spec['triggers'];
  if (Array.isArray(triggers)) {
    for (const trigger of triggers) {
      const name = typeof trigger === 'string'
        ? trigger
        : String((trigger as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        entries.push({ name, kind: 'trigger', syncName, direction: 'source' });
      }
    }
  }

  // Guards
  const guards = spec['guards'];
  if (Array.isArray(guards)) {
    for (const guard of guards) {
      const name = typeof guard === 'string'
        ? guard
        : String((guard as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        entries.push({ name, kind: 'guard', syncName, direction: 'none' });
      }
    }
  }

  // Transforms
  const transforms = spec['transforms'];
  if (Array.isArray(transforms)) {
    for (const transform of transforms) {
      const name = typeof transform === 'string'
        ? transform
        : String((transform as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        entries.push({ name, kind: 'transform', syncName, direction: 'none' });
      }
    }
  }

  return entries;
};

// Walk the scope chain upward to resolve a name
const resolveInScopeChain = (
  name: string,
  scopeId: string,
  scopeMap: ReadonlyMap<string, SyncScope>,
): O.Option<SyncScopeEntry> => {
  let currentId: string | null = scopeId;
  const visited = new Set<string>();

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const scope = scopeMap.get(currentId);
    if (scope === undefined) break;

    const match = scope.entries.find((e) => e.name === name);
    if (match !== undefined) return O.some(match);

    currentId = scope.parentScope;
  }

  return O.none;
};

// Collect all visible entries from a scope (walking the chain)
const collectVisible = (
  scopeId: string,
  scopeMap: ReadonlyMap<string, SyncScope>,
): readonly SyncScopeEntry[] => {
  const seen = new Set<string>();
  const result: SyncScopeEntry[] = [];
  let currentId: string | null = scopeId;
  const visited = new Set<string>();

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const scope = scopeMap.get(currentId);
    if (scope === undefined) break;

    for (const entry of scope.entries) {
      if (!seen.has(`${entry.kind}:${entry.name}`)) {
        result.push(entry);
        seen.add(`${entry.kind}:${entry.name}`);
      }
    }

    currentId = scope.parentScope;
  }

  return result;
};

// --- Handler interface ---

export interface SyncScopeProviderHandler {
  readonly initialize: (
    input: SyncScopeProviderInitializeInput,
    storage: SyncScopeProviderStorage,
  ) => TE.TaskEither<SyncScopeProviderError, SyncScopeProviderInitializeOutput>;
  readonly registerScope: (
    input: { readonly syncName: string; readonly specBody: string; readonly parentScope: string | null },
    storage: SyncScopeProviderStorage,
  ) => TE.TaskEither<SyncScopeProviderError, { readonly entryCount: number }>;
  readonly resolve: (
    input: { readonly name: string; readonly scopeId: string },
    storage: SyncScopeProviderStorage,
  ) => TE.TaskEither<SyncScopeProviderError, { readonly found: boolean; readonly entry: SyncScopeEntry | null }>;
  readonly visibleEntries: (
    input: { readonly scopeId: string },
    storage: SyncScopeProviderStorage,
  ) => TE.TaskEither<SyncScopeProviderError, { readonly entries: readonly SyncScopeEntry[] }>;
  readonly getBindings: (
    input: { readonly syncName: string },
    storage: SyncScopeProviderStorage,
  ) => TE.TaskEither<SyncScopeProviderError, { readonly bindings: readonly SyncScopeEntry[] }>;
}

// --- Implementation ---

export const syncScopeProviderHandler: SyncScopeProviderHandler = {
  // Verify storage and create a provider instance.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('sync_scopes');
          await storage.put('sync_scope_instances', instanceId, {
            id: instanceId,
            scopeCount: existing.length,
            createdAt: nowISO(),
          });
          return instanceId;
        },
        storageError,
      ),
      TE.map((instanceId) => initializeOk(instanceId)),
      TE.orElse((err) =>
        TE.right(initializeLoadError(err.message)),
      ),
    ),

  // Parse a sync spec and register its bindings/triggers/guards/transforms.
  registerScope: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          let spec: Record<string, unknown>;
          try {
            spec = JSON.parse(input.specBody);
          } catch {
            spec = {};
          }
          return spec;
        },
        storageError,
      ),
      TE.chain((spec) => {
        const entries = extractSyncScopeEntries(input.syncName, spec);
        return TE.tryCatch(
          async () => {
            await storage.put('sync_scopes', input.syncName, {
              syncName: input.syncName,
              parentScope: input.parentScope,
              entries: JSON.stringify(entries),
              createdAt: nowISO(),
            });
            return { entryCount: entries.length };
          },
          storageError,
        );
      }),
    ),

  // Resolve a name by walking the sync scope chain.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_scopes'),
        storageError,
      ),
      TE.map((records) => {
        const scopeMap = new Map<string, SyncScope>();
        for (const r of records) {
          const name = String(r['syncName'] ?? '');
          scopeMap.set(name, {
            syncName: name,
            parentScope: r['parentScope'] !== null && r['parentScope'] !== undefined
              ? String(r['parentScope'])
              : null,
            entries: JSON.parse(String(r['entries'] ?? '[]')),
          });
        }
        return pipe(
          resolveInScopeChain(input.name, input.scopeId, scopeMap),
          O.fold(
            () => ({ found: false as const, entry: null }),
            (entry) => ({ found: true as const, entry }),
          ),
        );
      }),
    ),

  // List all entries visible from the given sync scope.
  visibleEntries: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_scopes'),
        storageError,
      ),
      TE.map((records) => {
        const scopeMap = new Map<string, SyncScope>();
        for (const r of records) {
          const name = String(r['syncName'] ?? '');
          scopeMap.set(name, {
            syncName: name,
            parentScope: r['parentScope'] !== null && r['parentScope'] !== undefined
              ? String(r['parentScope'])
              : null,
            entries: JSON.parse(String(r['entries'] ?? '[]')),
          });
        }
        return { entries: collectVisible(input.scopeId, scopeMap) };
      }),
    ),

  // Get only binding entries for a specific sync rule.
  getBindings: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_scopes', input.syncName),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => ({ bindings: [] as readonly SyncScopeEntry[] }),
            (r) => {
              const entries: readonly SyncScopeEntry[] = JSON.parse(String(r['entries'] ?? '[]'));
              return { bindings: entries.filter((e) => e.kind === 'binding') };
            },
          ),
        ),
      ),
    ),
};
