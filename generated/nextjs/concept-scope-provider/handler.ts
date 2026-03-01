// ConceptScopeProvider — Provides scoping for concept definitions, managing
// the visibility of state fields, actions, and types within nested concept
// scopes and across composition boundaries.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConceptScopeProviderStorage,
  ConceptScopeProviderInitializeInput,
  ConceptScopeProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface ConceptScopeProviderError {
  readonly code: string;
  readonly message: string;
}

interface ScopeEntry {
  readonly name: string;
  readonly kind: 'state' | 'action' | 'type' | 'event';
  readonly conceptName: string;
  readonly exported: boolean;
}

interface ConceptScope {
  readonly conceptName: string;
  readonly parentScope: string | null;
  readonly entries: readonly ScopeEntry[];
}

// --- Helpers ---

const storageError = (error: unknown): ConceptScopeProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `csp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract scope entries from a parsed concept spec
const extractScopeEntries = (conceptName: string, spec: Record<string, unknown>): readonly ScopeEntry[] => {
  const entries: ScopeEntry[] = [];

  // State fields
  const state = spec['state'];
  if (state !== null && typeof state === 'object' && !Array.isArray(state)) {
    for (const [fieldName, fieldDef] of Object.entries(state as Record<string, unknown>)) {
      const exported = typeof fieldDef === 'object' && fieldDef !== null
        ? Boolean((fieldDef as Record<string, unknown>)['exported'] ?? true)
        : true;
      entries.push({ name: fieldName, kind: 'state', conceptName, exported });
    }
  }

  // Actions
  const actions = spec['actions'];
  if (Array.isArray(actions)) {
    for (const action of actions) {
      if (typeof action === 'string') {
        entries.push({ name: action, kind: 'action', conceptName, exported: true });
      } else if (typeof action === 'object' && action !== null) {
        const actionName = String((action as Record<string, unknown>)['name'] ?? '');
        if (actionName !== '') {
          const exported = Boolean((action as Record<string, unknown>)['exported'] ?? true);
          entries.push({ name: actionName, kind: 'action', conceptName, exported });
        }
      }
    }
  }

  // Types
  const types = spec['types'];
  if (Array.isArray(types)) {
    for (const t of types) {
      const typeName = typeof t === 'string' ? t : String((t as Record<string, unknown>)?.['name'] ?? '');
      if (typeName !== '') {
        entries.push({ name: typeName, kind: 'type', conceptName, exported: true });
      }
    }
  }

  // Events
  const events = spec['events'];
  if (Array.isArray(events)) {
    for (const e of events) {
      const eventName = typeof e === 'string' ? e : String((e as Record<string, unknown>)?.['name'] ?? '');
      if (eventName !== '') {
        entries.push({ name: eventName, kind: 'event', conceptName, exported: true });
      }
    }
  }

  return entries;
};

// Walk the scope chain upward to resolve a name
const resolveInScopeChain = (
  name: string,
  scopeId: string,
  scopeMap: ReadonlyMap<string, ConceptScope>,
): O.Option<ScopeEntry> => {
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

// Collect all visible entries from a scope (walking upward)
const collectVisible = (
  scopeId: string,
  scopeMap: ReadonlyMap<string, ConceptScope>,
): readonly ScopeEntry[] => {
  const seen = new Set<string>();
  const result: ScopeEntry[] = [];
  let currentId: string | null = scopeId;
  const visited = new Set<string>();

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const scope = scopeMap.get(currentId);
    if (scope === undefined) break;

    for (const entry of scope.entries) {
      // Inner scope shadows outer; only include exported entries from outer scopes
      if (!seen.has(entry.name)) {
        if (currentId === scopeId || entry.exported) {
          result.push(entry);
          seen.add(entry.name);
        }
      }
    }

    currentId = scope.parentScope;
  }

  return result;
};

// --- Handler interface ---

export interface ConceptScopeProviderHandler {
  readonly initialize: (
    input: ConceptScopeProviderInitializeInput,
    storage: ConceptScopeProviderStorage,
  ) => TE.TaskEither<ConceptScopeProviderError, ConceptScopeProviderInitializeOutput>;
  readonly registerScope: (
    input: { readonly conceptName: string; readonly specBody: string; readonly parentScope: string | null },
    storage: ConceptScopeProviderStorage,
  ) => TE.TaskEither<ConceptScopeProviderError, { readonly entryCount: number }>;
  readonly resolve: (
    input: { readonly name: string; readonly scopeId: string },
    storage: ConceptScopeProviderStorage,
  ) => TE.TaskEither<ConceptScopeProviderError, { readonly found: boolean; readonly entry: ScopeEntry | null }>;
  readonly visibleEntries: (
    input: { readonly scopeId: string },
    storage: ConceptScopeProviderStorage,
  ) => TE.TaskEither<ConceptScopeProviderError, { readonly entries: readonly ScopeEntry[] }>;
}

// --- Implementation ---

export const conceptScopeProviderHandler: ConceptScopeProviderHandler = {
  // Verify storage and create a provider instance.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('concept_scopes');
          await storage.put('scope_provider_instances', instanceId, {
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

  // Parse a concept spec and register its state/actions/types/events as scope entries.
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
        const entries = extractScopeEntries(input.conceptName, spec);
        const scope: ConceptScope = {
          conceptName: input.conceptName,
          parentScope: input.parentScope,
          entries,
        };
        return TE.tryCatch(
          async () => {
            await storage.put('concept_scopes', input.conceptName, {
              conceptName: scope.conceptName,
              parentScope: scope.parentScope,
              entries: JSON.stringify(scope.entries),
              createdAt: nowISO(),
            });
            return { entryCount: entries.length };
          },
          storageError,
        );
      }),
    ),

  // Resolve a name by walking the scope chain from the given scope upward.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_scopes'),
        storageError,
      ),
      TE.map((records) => {
        const scopeMap = new Map<string, ConceptScope>();
        for (const r of records) {
          const name = String(r['conceptName'] ?? '');
          scopeMap.set(name, {
            conceptName: name,
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

  // List all entries visible from the given scope, respecting shadowing and export rules.
  visibleEntries: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_scopes'),
        storageError,
      ),
      TE.map((records) => {
        const scopeMap = new Map<string, ConceptScope>();
        for (const r of records) {
          const name = String(r['conceptName'] ?? '');
          scopeMap.set(name, {
            conceptName: name,
            parentScope: r['parentScope'] !== null && r['parentScope'] !== undefined
              ? String(r['parentScope'])
              : null,
            entries: JSON.parse(String(r['entries'] ?? '[]')),
          });
        }
        return { entries: collectVisible(input.scopeId, scopeMap) };
      }),
    ),
};
