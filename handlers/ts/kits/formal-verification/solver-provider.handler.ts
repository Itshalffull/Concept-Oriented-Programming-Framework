// SolverProvider Concept Implementation — Formal Verification Suite
// Register, dispatch to, health-check, and manage external solver backends
// (SMT solvers, model checkers, proof assistants) as pluggable providers.
//
// Migrated to FunctionalConceptHandler: returns StoragePrograms enabling
// the monadic pipeline to extract properties like "dispatch always selects
// the highest-priority matching provider" and "unregister removes the
// provider from the relation".
// See Architecture doc Section 18.5

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

const RELATION = 'solver-providers';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

type Result = { variant: string; [key: string]: unknown };

export const solverProviderHandler: FunctionalConceptHandler = {
  register(input) {
    const provider_id = input.provider_id as string;
    const name = input.name as string;
    const supported_languages = input.supported_languages as string;
    const supported_kinds = input.supported_kinds as string;
    const endpoint = input.endpoint as string | undefined;
    const priority = input.priority as number | undefined;

    if (!provider_id || !name) {
      return pure(createProgram(), { variant: 'invalid', message: 'provider_id and name are required' }) as StorageProgram<Result>;
    }

    let languages: string[];
    let kinds: string[];
    try {
      languages = JSON.parse(supported_languages);
      kinds = JSON.parse(supported_kinds);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'supported_languages and supported_kinds must be valid JSON arrays' }) as StorageProgram<Result>;
    }

    const id = `sp-${simpleHash(provider_id + ':' + name)}`;
    const now = new Date().toISOString();

    // Check for duplicate via find, then branch
    let p = createProgram();
    p = find(p, RELATION, { provider_id }, 'existing');
    p = branch(
      p,
      (bindings) => {
        const existing = bindings.existing as unknown[];
        return existing && existing.length > 0;
      },
      pure(createProgram(), { variant: 'duplicate', provider_id, message: `Provider "${provider_id}" is already registered` }),
      (() => {
        let inner = createProgram();
        inner = put(inner, RELATION, id, {
          id,
          provider_id,
          name,
          supported_languages: JSON.stringify(languages),
          supported_kinds: JSON.stringify(kinds),
          endpoint: endpoint || '',
          priority: priority ?? 100,
          status: 'active',
          registered_at: now,
        });
        return pure(inner, { variant: 'ok', id, provider_id, name, status: 'active' });
      })(),
    );
    return p as StorageProgram<Result>;
  },

  dispatch(input) {
    const formal_language = input.formal_language as string;
    const kind = input.kind as string;
    const property_ref = input.property_ref as string;

    let p = createProgram();
    p = find(p, RELATION, { status: 'active' }, 'providers');
    // The interpreter filters by language/kind and selects lowest priority.
    return pure(p, {
      variant: 'ok',
      __compute: 'dispatch_provider',
      __filter_language: formal_language,
      __filter_kind: kind,
      property_ref,
    }) as StorageProgram<Result>;
  },

  dispatch_batch(input) {
    const property_refs = input.property_refs as string;

    let refs: string[];
    try {
      refs = JSON.parse(property_refs);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'property_refs must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(refs) || refs.length === 0) {
      return pure(createProgram(), { variant: 'invalid', message: 'property_refs must be a non-empty array' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, RELATION, { status: 'active' }, 'providers');
    return pure(p, {
      variant: 'ok',
      __compute: 'dispatch_batch',
      __property_refs: JSON.stringify(refs),
    }) as StorageProgram<Result>;
  },

  health_check(input) {
    const provider_id = input.provider_id as string;

    let p = createProgram();
    p = find(p, RELATION, { provider_id }, 'matches');
    p = branch(
      p,
      (bindings) => {
        const matches = bindings.matches as unknown[];
        return !matches || matches.length === 0;
      },
      pure(createProgram(), { variant: 'notfound', provider_id }),
      pure(createProgram(), {
        variant: 'ok',
        provider_id,
        __compute: 'health_check',
      }),
    );
    return p as StorageProgram<Result>;
  },

  list(_input) {
    let p = createProgram();
    p = find(p, RELATION, {}, 'items');
    return pure(p, {
      variant: 'ok',
      __compute: 'list',
      __fields: ['id', 'provider_id', 'name', 'supported_languages', 'supported_kinds', 'priority', 'status'],
    }) as StorageProgram<Result>;
  },

  unregister(input) {
    const provider_id = input.provider_id as string;

    let p = createProgram();
    p = find(p, RELATION, { provider_id }, 'matches');
    p = branch(
      p,
      (bindings) => {
        const matches = bindings.matches as unknown[];
        return !matches || matches.length === 0;
      },
      pure(createProgram(), { variant: 'notfound', provider_id }),
      (() => {
        let inner = createProgram();
        // Delete by resolved id from the binding
        inner = del(inner, RELATION, '__binding:matches[0].id');
        return pure(inner, {
          variant: 'ok',
          provider_id,
          __compute: 'unregister_name',
        });
      })(),
    );
    return p as StorageProgram<Result>;
  },
};
