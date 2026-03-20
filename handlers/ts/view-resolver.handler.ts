// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ViewResolver Hub Handler
//
// Coordination concept with pluggable providers for View data resolution.
// Registers resolver providers and dispatches resolve calls. Actual data
// fetching happens through syncs, not through direct kernel invocation.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const resolverType = input.resolver_type as string;
    const provider = input.provider as string;

    if (!resolverType || !provider) {
      const p = createProgram();
      return complete(p, 'error', { message: 'resolver_type and provider are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'provider', {}, 'existing');

    return branch(p,
      (bindings) => {
        const existing = bindings.existing as Record<string, unknown>[];
        return existing.some((e) => e.resolver_type === resolverType);
      },
      (thenP) => complete(thenP, 'already_registered', { resolver_type: resolverType }),
      (elseP) => {
        elseP = put(elseP, 'provider', resolverType, {
          resolver_type: resolverType,
          provider_name: provider,
        });
        return complete(elseP, 'ok', { resolver_type: resolverType });
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const view = input.view as string;
    const dataSource = input.data_source as string;
    const filters = input.filters as string;
    const context = input.context as string;

    if (!view) {
      const p = createProgram();
      return complete(p, 'view_not_found', { view: '' }) as StorageProgram<Result>;
    }

    if (!dataSource) {
      const p = createProgram();
      return complete(p, 'error', { message: 'data_source is required' }) as StorageProgram<Result>;
    }

    // Parse context to determine resolver type
    let resolverType = 'kernel'; // default
    if (context) {
      try {
        const parsed = JSON.parse(context);
        if (parsed.resolver_type) {
          resolverType = parsed.resolver_type as string;
        }
      } catch {
        // Use default
      }
    }

    let p = createProgram();
    p = get(p, 'provider', resolverType, 'provider');

    return branch(p, 'provider',
      (thenP) => complete(thenP, 'ok', {
        data: '[]',
        count: '0',
        view,
        data_source: dataSource,
        filters: filters || '[]',
        resolver_type: resolverType,
      }),
      (elseP) => complete(elseP, 'no_provider', { resolver_type: resolverType }),
    ) as StorageProgram<Result>;
  },
};

export const viewResolverHandler = autoInterpret(_handler);
