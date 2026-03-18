// @migrated dsl-constructs 2026-03-18
// ReactViewResolver Provider Handler
//
// Client-side View data resolver for React environments. Like
// KernelViewResolver, does not need kernel access -- syncs handle
// cross-concept invocation. This provider is selected when the
// context specifies resolver_type: "react".

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'react-view-resolver', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'react' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const view = input.view as string;
    const dataSource = input.data_source as string;
    const filters = input.filters as string;
    const context = input.context as string;

    if (!dataSource) {
      const p = createProgram();
      return complete(p, 'invalid_source', { message: 'data_source is required' }) as StorageProgram<Result>;
    }

    // Validate dataSource JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataSource);
    } catch {
      const p = createProgram();
      return complete(p, 'invalid_source', { message: `Invalid data_source JSON: ${dataSource}` }) as StorageProgram<Result>;
    }

    if (!parsed.concept || !parsed.action) {
      const p = createProgram();
      return complete(p, 'invalid_source', {
        message: 'data_source must contain concept and action fields',
      }) as StorageProgram<Result>;
    }

    // Return ok -- the sync chain dispatches to the concept/action.
    // For React, the API layer bridges the result back to the component.
    const p = createProgram();
    return complete(p, 'ok', {
      data_source: dataSource,
      view,
      filters: filters || '[]',
      context: context || '{}',
    }) as StorageProgram<Result>;
  },
};

export const reactViewResolverHandler = autoInterpret(_handler);

/** Reset internal state for testing. */
export function resetReactViewResolver(): void {
  registered = false;
}
