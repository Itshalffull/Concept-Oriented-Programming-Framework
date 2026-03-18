// @migrated dsl-constructs 2026-03-18
// ============================================================
// StaticValueSource Handler
//
// SlotSource provider that returns a hardcoded static value.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `svs-${++idCounter}`;
}

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'static-value-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'static_value' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const value = input.value as string;
    const contentType = input.content_type as string | undefined;
    const context = input.context as string;

    if (value === undefined || value === null) {
      const p = createProgram();
      return complete(p, 'error', { message: 'value is required' }) as StorageProgram<Result>;
    }

    // Validate context JSON if provided
    if (context) {
      try {
        JSON.parse(context);
      } catch {
        const p = createProgram();
        return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
      }
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'static-value-source', id, {
      id,
      value,
      content_type: contentType || 'text/plain',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { data: String(value) }) as StorageProgram<Result>;
  },
};

export const staticValueSourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetStaticValueSource(): void {
  idCounter = 0;
  registered = false;
}
