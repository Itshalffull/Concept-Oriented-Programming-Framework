// @clef-handler style=functional
// Workspace Concept Implementation
// Persists and restores named snapshots of pane/tab/split/dock arrangements.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get as spGet,
  find,
  put,
  putFrom,
  del,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register() {
    return complete(createProgram(), 'ok', { name: 'Workspace' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const workspace = input.workspace as string;
    const name = input.name as string;
    const owner = input.owner as string;
    const description = (input.description as string | null | undefined) ?? null;

    // Input validation
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!owner || owner.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'owner is required' }) as StorageProgram<Result>;
    }

    // Check uniqueness by scanning all workspaces for owner+name combo
    let p = createProgram();
    p = find(p, 'workspace', {}, '_allWorkspaces');
    p = mapBindings(p, (bindings) => {
      const all = (bindings._allWorkspaces as Array<Record<string, unknown>>) || [];
      return all.some(w => w.owner === owner && w.name === name);
    }, '_isDuplicate');
    return branch(p,
      (bindings) => !!bindings._isDuplicate,
      complete(createProgram(), 'duplicate', { name }),
      (base) => {
        const now = new Date().toISOString();
        let b = put(base, 'workspace', workspace, {
          workspace,
          name,
          owner,
          description,
          snapshot: '',
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        });
        return complete(b, 'ok', { workspace });
      },
    ) as StorageProgram<Result>;
  },

  save(input: Record<string, unknown>) {
    const workspace = input.workspace as string;
    const snapshot = input.snapshot as string;

    // Input validation
    if (!snapshot || snapshot.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'snapshot is required' }) as StorageProgram<Result>;
    }

    // Validate JSON
    try {
      JSON.parse(snapshot);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'snapshot must be valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'existing');
    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => {
        const now = new Date().toISOString();
        let b = putFrom(base, 'workspace', workspace, (bindings) => ({
          ...(bindings.existing as Record<string, unknown>),
          snapshot,
          updatedAt: now,
        }));
        return complete(b, 'ok', { workspace });
      },
    ) as StorageProgram<Result>;
  },

  restore(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'record');
    return branch(p,
      (bindings) => bindings.record == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => completeFrom(base, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { workspace: record.workspace as string, snapshot: (record.snapshot as string) ?? '' };
      }),
    ) as StorageProgram<Result>;
  },

  setDefault(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'existing');
    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => {
        const now = new Date().toISOString();
        let b = putFrom(base, 'workspace', workspace, (bindings) => ({
          ...(bindings.existing as Record<string, unknown>),
          isDefault: true,
          updatedAt: now,
        }));
        return complete(b, 'ok', { workspace });
      },
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'existing');
    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => {
        let b = del(base, 'workspace', workspace);
        return complete(b, 'ok', { workspace });
      },
    ) as StorageProgram<Result>;
  },

  duplicate(input: Record<string, unknown>) {
    const workspace = input.workspace as string;
    const newName = input.newName as string;

    // Input validation
    if (!newName || newName.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'newName is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'existing');
    p = find(p, 'workspace', {}, '_allWorkspaces');
    // Check for name conflict using the source workspace's owner
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | undefined;
      if (!existing) return false;
      const owner = existing.owner as string;
      const all = (bindings._allWorkspaces as Array<Record<string, unknown>>) || [];
      return all.some(w => w.owner === owner && w.name === newName);
    }, '_hasConflict');

    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => {
        return branch(base,
          (bindings) => !!bindings._hasConflict,
          complete(createProgram(), 'duplicate', { name: newName }),
          (innerBase) => {
            const now = new Date().toISOString();
            const newWorkspace = `${workspace}-copy`;
            let b = putFrom(innerBase, 'workspace', newWorkspace, (bindings) => {
              const src = bindings.existing as Record<string, unknown>;
              return {
                workspace: newWorkspace,
                name: newName,
                owner: src.owner as string,
                description: (src.description as string | null) ?? null,
                snapshot: (src.snapshot as string) ?? '',
                isDefault: false,
                createdAt: now,
                updatedAt: now,
              };
            });
            return complete(b, 'ok', { newWorkspace });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const owner = input.owner as string;

    // Input validation
    if (!owner || owner.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'owner is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'workspace', {}, '_allWorkspaces');
    p = mapBindings(p, (bindings) => {
      const all = (bindings._allWorkspaces as Array<Record<string, unknown>>) || [];
      return all
        .filter(w => w.owner === owner)
        .sort((a, b) => (a.name as string).localeCompare(b.name as string))
        .map(w => ({
          workspace: w.workspace as string,
          name: w.name as string,
          description: (w.description as string | null) ?? null,
          isDefault: (w.isDefault as boolean) ?? false,
          updatedAt: w.updatedAt as string,
        }));
    }, '_workspaces');
    return completeFrom(p, 'ok', (bindings) => ({
      workspaces: bindings._workspaces as unknown[],
    })) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'record');
    return branch(p,
      (bindings) => bindings.record == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => completeFrom(base, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          workspace: record.workspace as string,
          name: record.name as string,
          owner: record.owner as string,
          description: (record.description as string | null) ?? null,
          snapshot: (record.snapshot as string) ?? '',
          isDefault: (record.isDefault as boolean) ?? false,
          createdAt: record.createdAt as string,
          updatedAt: record.updatedAt as string,
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const workspaceHandler = autoInterpret(_handler);
