// @clef-handler style=functional
// ExtensionPermission Concept Implementation
// Declare and enforce extension permissions at runtime. Maps abstract
// permission identifiers to host-specific capabilities via provider routing.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ext-perm-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ExtensionPermission' }) as StorageProgram<Result>;
  },

  declare(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;
    const permission = input.permission as string;
    const scope = (input.scope as string | undefined) ?? 'default';

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }
    if (!permission || permission.trim() === '') {
      return complete(createProgram(), 'error', { message: 'permission is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'permission', { extensionId, name: permission }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'Permission already declared for this extension.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'permission', id, {
          id, name: permission, extensionId, scope,
          status: 'declared',
          grants: '[]',
        });
        return complete(b2, 'ok', { permission: id });
      },
    ) as StorageProgram<Result>;
  },

  grant(input: Record<string, unknown>) {
    const permission = input.permission as string;

    let p = createProgram();
    p = get(p, 'permission', permission, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'permission', permission, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'granted' };
        });
        return complete(b2, 'ok', { permission });
      },
      (b) => complete(b, 'notfound', { message: 'No permission with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const permission = input.permission as string;

    let p = createProgram();
    p = get(p, 'permission', permission, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'permission', permission, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'revoked' };
        });
        return complete(b2, 'ok', { permission });
      },
      (b) => complete(b, 'notfound', { message: 'No permission with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = find(p, 'permission', { extensionId, name: permission }, 'matches');
    return completeFrom(p, 'ok', (bindings) => {
      const matches = (bindings.matches as unknown[]) || [];
      const granted = matches.some((m) => (m as Record<string, unknown>).status === 'granted');
      return { granted };
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const permission = input.permission as string;
    const hostType = input.hostType as string;

    if (!hostType || hostType.trim() === '') {
      return complete(createProgram(), 'unsupported', { message: 'No provider registered for the given host type.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'permission', permission, 'record');
    return branch(p, 'record',
      (b) => {
        const supportedHosts = ['browser', 'vscode', 'chrome', 'firefox', 'safari', 'edge'];
        if (!supportedHosts.includes(hostType.toLowerCase())) {
          return complete(b, 'unsupported', { message: `No provider registered for host type '${hostType}'.` });
        }
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const hostCapabilities = JSON.stringify({ hostType, permission: record.name, scope: record.scope });
          return { hostCapabilities };
        });
      },
      (b) => complete(b, 'notfound', { message: 'No permission with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  listGrants(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'permission', { extensionId, status: 'granted' }, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all as unknown[]) || [];
      return { grants: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },
};

export const extensionPermissionHandler = autoInterpret(_handler);
