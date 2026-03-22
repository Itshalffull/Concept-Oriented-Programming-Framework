// @clef-handler style=imperative
// SolverProvider Concept Implementation — Formal Verification Suite
// Register, dispatch to, health-check, and manage external solver backends
// (SMT solvers, model checkers, proof assistants) as pluggable providers.
//
// Uses the StorageProgram DSL with proper typed instructions (merge,
// mapBindings, pureFrom, delFrom) instead of string-based __compute:,
// __binding:, and __merge conventions.
// See Architecture doc Section 18.5

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, pure,
  merge, mapBindings, pureFrom, delFrom,
  type StorageProgram,
  type Bindings,
  complete,
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
      return complete(createProgram(), 'invalid', { message: 'provider_id and name are required' }) as StorageProgram<Result>;
    }

    let languages: string[];
    let kinds: string[];
    try {
      languages = JSON.parse(supported_languages);
      kinds = JSON.parse(supported_kinds);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'supported_languages and supported_kinds must be valid JSON arrays' }) as StorageProgram<Result>;
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
      complete(createProgram(), 'duplicate', { provider_id, message: `Provider "${provider_id}" is already registered` }),
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
        return complete(inner, 'ok', { id, provider_id, name, status: 'active' });
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
    return pureFrom(p, (bindings: Bindings) => {
      const providers = (bindings.providers as Record<string, unknown>[]) || [];

      // Filter providers whose supported_languages includes the requested
      // formal_language AND whose supported_kinds includes the requested kind
      const matching = providers.filter((prov) => {
        try {
          const langs: string[] = JSON.parse(prov.supported_languages as string);
          const kinds: string[] = JSON.parse(prov.supported_kinds as string);
          return langs.includes(formal_language) && kinds.includes(kind);
        } catch {
          return false;
        }
      });

      if (matching.length === 0) {
        return { variant: 'no_provider', formal_language, kind };
      }

      // Sort by priority ascending (lowest priority number = highest precedence)
      matching.sort((a, b) => (a.priority as number) - (b.priority as number));
      const selected = matching[0];

      return {
        variant: 'ok',
        provider_id: selected.provider_id,
        property_ref,
        run_ref: `run-${simpleHash(property_ref + ':' + Date.now())}`,
      };
    }) as StorageProgram<Result>;
  },

  dispatch_batch(input) {
    const property_refs = input.property_refs as string;

    let refs: string[];
    try {
      refs = JSON.parse(property_refs);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'property_refs must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(refs) || refs.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'property_refs must be a non-empty array' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, RELATION, { status: 'active' }, 'providers');
    return pureFrom(p, (bindings: Bindings) => {
      const providers = (bindings.providers as Record<string, unknown>[]) || [];

      // Find the lowest-priority active provider that supports smtlib + invariant
      // (the default formal verification target)
      const eligible = providers.filter((prov) => {
        try {
          const langs: string[] = JSON.parse(prov.supported_languages as string);
          const kinds: string[] = JSON.parse(prov.supported_kinds as string);
          return langs.includes('smtlib') && kinds.includes('invariant');
        } catch {
          return false;
        }
      });

      eligible.sort((a, b) => (a.priority as number) - (b.priority as number));

      if (eligible.length === 0) {
        // No matching providers — all properties are unassigned
        return {
          variant: 'ok',
          assigned_count: 0,
          unassigned_count: refs.length,
          assignments: JSON.stringify([]),
          unassigned: JSON.stringify(refs),
        };
      }

      const selected = eligible[0];
      const assignments = refs.map((ref) => ({
        property_ref: ref,
        provider_id: selected.provider_id,
        run_ref: `run-${simpleHash(ref + ':' + Date.now())}`,
      }));

      return {
        variant: 'ok',
        assigned_count: refs.length,
        unassigned_count: 0,
        assignments: JSON.stringify(assignments),
        unassigned: JSON.stringify([]),
      };
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
      complete(createProgram(), 'notfound', { provider_id }),
      (() => {
        let inner = createProgram();
        return pureFrom(inner, (bindings: Bindings) => {
          const match = (bindings.matches as Record<string, unknown>[])[0];
          return {
            variant: 'ok',
            provider_id,
            name: match.name,
            status: match.status,
            latency_ms: Math.floor(Math.random() * 50) + 5,
          };
        });
      })(),
    );
    return p as StorageProgram<Result>;
  },

  list(_input) {
    const fields = ['id', 'provider_id', 'name', 'supported_languages', 'supported_kinds', 'priority', 'status'];

    let p = createProgram();
    p = find(p, RELATION, {}, 'items');
    return pureFrom(p, (bindings: Bindings) => {
      const items = (bindings.items as Record<string, unknown>[]) || [];
      const projected = items.map((item) => {
        const obj: Record<string, unknown> = {};
        for (const f of fields) {
          if (f in item) obj[f] = item[f];
        }
        return obj;
      });
      return {
        variant: 'ok',
        count: projected.length,
        items: JSON.stringify(projected),
      };
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
      complete(createProgram(), 'notfound', { provider_id }),
      (() => {
        let inner = createProgram();
        inner = delFrom(inner, RELATION, (bindings: Bindings) => (bindings.matches as any[])[0].id);
        return pureFrom(inner, (bindings: Bindings) => {
          const match = (bindings.matches as Record<string, unknown>[])[0];
          return {
            variant: 'ok',
            provider_id,
            name: match.name,
          };
        });
      })(),
    );
    return p as StorageProgram<Result>;
  },
};
