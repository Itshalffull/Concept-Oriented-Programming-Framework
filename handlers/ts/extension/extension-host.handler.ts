// @clef-handler style=functional
// ExtensionHost Concept Implementation
// Lifecycle coordination for extensions: install, activate, deactivate,
// uninstall, and error recovery. Routes to host-specific providers via
// the hostType discriminator.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ext-host-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ExtensionHost' }) as StorageProgram<Result>;
  },

  install(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const hostType = input.hostType as string;

    if (!manifest || manifest.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'manifest is required' }) as StorageProgram<Result>;
    }
    if (!hostType || hostType.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'hostType is required' }) as StorageProgram<Result>;
    }

    // Parse manifest to check identity
    let parsedManifest: Record<string, unknown> = {};
    try {
      parsedManifest = JSON.parse(manifest);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'Manifest validation failed: invalid JSON.' }) as StorageProgram<Result>;
    }

    const identity = `${parsedManifest.name || 'unknown'}@${parsedManifest.version || '0.0.0'}`;

    let p = createProgram();
    p = find(p, 'extension', { identity }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'An extension with the same identity is already installed.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'extension', id, {
          id, manifest, hostType, identity,
          status: 'installed',
          activationConditions: '[]',
          dependencies: '[]',
          errorState: null,
        });
        return complete(b2, 'ok', { extension: id });
      },
    ) as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const extension = input.extension as string;

    let p = createProgram();
    p = get(p, 'extension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extension', extension, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'active', errorState: null };
        });
        return complete(b2, 'ok', { extension });
      },
      (b) => complete(b, 'notfound', { message: 'No extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  deactivate(input: Record<string, unknown>) {
    const extension = input.extension as string;

    let p = createProgram();
    p = get(p, 'extension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extension', extension, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'deactivated' };
        });
        return complete(b2, 'ok', { extension });
      },
      (b) => complete(b, 'notfound', { message: 'No extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  uninstall(input: Record<string, unknown>) {
    const extension = input.extension as string;

    let p = createProgram();
    p = get(p, 'extension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = del(b, 'extension', extension);
        return complete(b2, 'ok', { extension });
      },
      (b) => complete(b, 'notfound', { message: 'No extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  getStatus(input: Record<string, unknown>) {
    const extension = input.extension as string;

    let p = createProgram();
    p = get(p, 'extension', extension, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          status: record.status as string,
          hostType: record.hostType as string,
          errorState: (record.errorState as string | null) ?? null,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'No extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  listInstalled(input: Record<string, unknown>) {
    const hostType = input.hostType as string | undefined;

    let p = createProgram();
    const criteria: Record<string, unknown> = hostType ? { hostType } : {};
    p = find(p, 'extension', criteria, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all as unknown[]) || [];
      return { extensions: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },

  handleError(input: Record<string, unknown>) {
    const extension = input.extension as string;
    const error = input.error as string;

    if (!error || error.trim() === '') {
      return complete(createProgram(), 'error', { message: 'error is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'extension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        // Determine recovery action based on error
        const recovery = error.toLowerCase().includes('fatal') ? 'uninstall'
          : error.toLowerCase().includes('dependency') ? 'deactivate'
          : 'retry';
        let b2 = putFrom(b, 'extension', extension, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, errorState: error, status: recovery === 'retry' ? record.status : 'error' };
        });
        return complete(b2, 'ok', { extension, recovery });
      },
      (b) => complete(b, 'notfound', { message: 'No extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const extensionHostHandler = autoInterpret(_handler);
