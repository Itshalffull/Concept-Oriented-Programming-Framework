// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// EntityReflector Concept Implementation
//
// Creates ContentNode entries for registered concepts, loaded
// syncs, defined schemas, and other entity types. Uses a
// provider model so new entity type providers can be added.
//
// External kernel dispatch (to RuntimeRegistry, FileCatalog,
// ContentNode, Schema) is modeled via `perform` transport
// effects. The interpreter handles the actual async calls.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, perform,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Maps entity type (ContentNode.type) to the Schema name to apply.
const TYPE_TO_SCHEMA: Record<string, string> = {
  concept: 'Concept',
  sync: 'Sync',
  schema: 'Schema',
  widget: 'Widget',
  theme: 'Theme',
  derived: 'Derived',
  suite: 'Suite',
};

// Provider names for built-in entity types
const PROVIDER_NAMES = ['concept', 'sync', 'schema', 'widget', 'theme', 'derived', 'suite'];

// Permanently built-in providers that cannot be re-registered (always already registered)
const PERMANENT_PROVIDERS = ['concept', 'sync', 'schema'];

// --- Handler ---

const _entityReflectorHandler: FunctionalConceptHandler = {
  registerProvider(input: Record<string, unknown>) {
    const providerName = input.provider_name as string;

    // Built-in providers are always available — treat as idempotent ok
    if (PERMANENT_PROVIDERS.includes(providerName)) {
      return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', providerName, 'existing');

    // If already in storage, return ok (idempotent re-registration)
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', {}) as StorageProgram<Result>,
      (b) => {
        let b2 = put(b, 'provider', providerName, {
          id: providerName,
          provider_name: providerName,
          last_run: null,
          reflected_count: 0,
        });
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;

    return p;
  },

  reflect(_input: Record<string, unknown>) {
    // The reflect action delegates actual reflection to the kernel via
    // transport effects. The interpreter handles the async kernel calls.
    let p = createProgram();

    // Ensure built-in providers are registered
    for (const name of PROVIDER_NAMES) {
      p = get(p, 'provider', name, `provider_check_${name}`);
    }

    for (const name of PROVIDER_NAMES) {
      p = branch(p,
        (bindings) => !bindings[`provider_check_${name}`],
        (b) => put(b, 'provider', name, {
          id: name,
          provider_name: name,
          last_run: null,
          reflected_count: 0,
        }),
        (b) => b,
      );
    }

    p = find(p, 'provider', {}, 'providers');

    // Dispatch reflection to kernel via transport effect.
    // The effect handler iterates providers and calls the kernel.
    p = perform(p, 'kernel', 'reflect', { providers: PROVIDER_NAMES }, 'reflectionResult');

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.reflectionResult as Record<string, unknown> | null;
      return {
        created: result?.created ?? 0,
        skipped: result?.skipped ?? 0,
      };
    }) as StorageProgram<Result>;
  },

  reflectProvider(input: Record<string, unknown>) {
    const providerName = input.provider_name as string;

    let p = createProgram();
    p = get(p, 'provider', providerName, 'provider');

    p = branch(p, 'provider',
      (b) => {
        if (!PROVIDER_NAMES.includes(providerName)) {
          return complete(b, 'notfound', { message: `No implementation for provider: ${providerName}` }) as StorageProgram<Result>;
        }
        // Dispatch single provider reflection via transport effect
        let b2 = perform(b, 'kernel', 'reflectProvider', { provider: providerName }, 'providerResult');
        return completeFrom(b2, 'ok', (bindings) => {
          const result = bindings.providerResult as Record<string, unknown> | null;
          return {
            created: result?.created ?? 0,
            skipped: result?.skipped ?? 0,
            _providerName: providerName,
          };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: `No provider: ${providerName}` }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  status(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'provider', {}, 'providers');

    return completeFrom(p, 'ok', (bindings) => ({
      providers: JSON.stringify(bindings.providers),
    })) as StorageProgram<Result>;
  },
};

export const entityReflectorHandler = autoInterpret(_entityReflectorHandler);

// --- Kernel reference for cross-concept dispatch ---

let _kernel: unknown = null;

/**
 * Wire the kernel reference so EntityReflector can dispatch
 * cross-concept actions (RuntimeRegistry, ContentNode, etc.)
 * via the perform() transport effect pipeline.
 */
export function setEntityReflectorKernel(kernel: unknown): void {
  _kernel = kernel;
}

export function getEntityReflectorKernel(): unknown {
  return _kernel;
}
