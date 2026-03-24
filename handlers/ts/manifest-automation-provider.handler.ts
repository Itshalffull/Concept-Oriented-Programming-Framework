// @clef-handler style=functional
// ============================================================
// ManifestAutomationProvider Handler
//
// Build-time automation provider backed by a generated action
// manifest. The manifest enumerates every concept action with
// input/output JSON schemas, enabling validated dispatch without
// runtime discovery. Loaded from automation-manifest.json.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ma-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'manifest-automation-provider', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'ok', { provider_name: 'manifest' }) as StorageProgram<Result>,
      (b) => {
        let b2 = put(b, 'manifest-automation-provider', '__registered', { value: true });
        return complete(b2, 'ok', { provider_name: 'manifest' }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  load(input: Record<string, unknown>) {
    const manifestPath = (input.manifest_path as string) || '';

    if (!manifestPath || manifestPath.trim() === '') {
      return complete(createProgram(), 'error', {
        manifest_path: manifestPath,
        message: 'manifest_path is required',
      }) as StorageProgram<Result>;
    }

    // Simulate loading a manifest — production would use perform() to read the file.
    const version = '1.0.0';
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'manifest-automation-provider', '__manifest', {
      manifest_path: manifestPath,
      version,
      loaded_at: now,
      entries: [],
    });

    return complete(p, 'ok', { entry_count: 0, version }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionRef = (input.action_ref as string) || '';
    const inputPayload = (input.input as string) || '{}';

    if (!actionRef || actionRef.trim() === '') {
      return complete(createProgram(), 'error', {
        action_ref: actionRef,
        message: 'action_ref is required',
      }) as StorageProgram<Result>;
    }

    // Validate input JSON
    try {
      JSON.parse(inputPayload);
    } catch {
      return complete(createProgram(), 'invalid', {
        action_ref: actionRef,
        message: 'input must be valid JSON',
      }) as StorageProgram<Result>;
    }

    // Look up the action entry in the manifest
    let p = createProgram();
    p = get(p, 'manifest-automation-entry', actionRef, 'entry');

    return branch(p, 'entry',
      (b) => {
        const id = nextId();
        const result = JSON.stringify({
          action_ref: actionRef,
          input: inputPayload,
          executed_at: new Date().toISOString(),
          status: 'ok',
        });
        let b2 = put(b, 'manifest-automation-execution', id, {
          id,
          action_ref: actionRef,
          input: inputPayload,
          result,
          executed_at: new Date().toISOString(),
        });
        return complete(b2, 'ok', { result }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { action_ref: actionRef }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  lookup(input: Record<string, unknown>) {
    const actionRef = (input.action_ref as string) || '';

    if (!actionRef || actionRef.trim() === '') {
      return complete(createProgram(), 'notfound', { action_ref: actionRef }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'manifest-automation-entry', actionRef, 'entry');

    return branch(p, 'entry',
      (b) => completeFrom(b, 'ok', (bindings) => ({ entry: bindings.entry })) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { action_ref: actionRef }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const manifestAutomationProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetManifestAutomationProvider(): void {
  idCounter = 0;
}
