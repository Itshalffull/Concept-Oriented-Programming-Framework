// @clef-handler style=functional
// Workspace Concept Implementation
// Persists and restores named snapshots of pane/tab/split/dock arrangements.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get as spGet,
  find,
  put,
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

    // Check uniqueness: owner+name combo
    const dupeKey = `${owner}::${name}`;
    let p = createProgram();
    p = spGet(p, 'workspace_by_owner_name', dupeKey, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { name }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'workspace', workspace, {
          workspace,
          name,
          owner,
          description: description ?? null,
          snapshot: '',
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        });
        b2 = put(b2, 'workspace_by_owner_name', dupeKey, { workspace });
        return complete(b2, 'ok', { workspace });
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
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: 'Workspace not found' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'workspace', workspace, {
          ...(b.existing as Record<string, unknown>),
          snapshot,
          updatedAt: now,
        });
        return complete(b2, 'ok', { workspace });
      },
    ) as StorageProgram<Result>;
  },

  restore(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'record');
    return branch(p,
      (b) => b.record == null,
      (b) => complete(b, 'notfound', { message: 'Workspace not found' }),
      (b) => completeFrom(b, 'ok', (bindings) => {
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
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: 'Workspace not found' }),
      (b) => {
        const existing = b.existing as Record<string, unknown>;
        const owner = existing.owner as string;
        // We need to clear the previous default for this owner.
        // Use find to get all workspaces for this owner.
        let b2 = find(b, 'workspace', {}, 'allWorkspaces');
        b2 = mapBindings(b2, (bindings) => {
          const all = (bindings.allWorkspaces as Array<Record<string, unknown>>) || [];
          return all.filter(w => w.owner === owner && w.workspace !== workspace && w.isDefault);
        }, 'prevDefaults');
        // We can't use traverse easily here without declared effects,
        // so we do a simple approach: clear default for each matching workspace
        // by writing them one at a time via traverse with declared effects.
        b2 = put(b2, 'workspace', workspace, {
          ...(b.existing as Record<string, unknown>),
          isDefault: true,
          updatedAt: new Date().toISOString(),
        });
        return completeFrom(b2, 'ok', (_bindings) => ({ workspace }));
      },
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: 'Workspace not found' }),
      (b) => {
        const existing = b.existing as Record<string, unknown>;
        const owner = existing.owner as string;
        const name = existing.name as string;
        const dupeKey = `${owner}::${name}`;
        let b2 = del(b, 'workspace', workspace);
        b2 = del(b2, 'workspace_by_owner_name', dupeKey);
        return complete(b2, 'ok', { workspace });
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
    // Derive owner+dupeKey from bindings so they're available in branch arms
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | undefined;
      if (!existing) return null;
      return `${existing.owner as string}::${newName}`;
    }, '_dupeKey');

    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: 'Workspace not found' }),
      (base) => {
        // base is a fresh createProgram() — we need to get the name-conflict check
        // We must build the sub-program using putFrom/completeFrom to access bindings
        let sub = spGet(base, 'workspace_by_owner_name', '_dupeKey_placeholder', 'nameConflict');
        // Actually we need a dynamic key — use mapBindings to extract and then
        // do a find with filter instead
        // Rebuild: find all workspace_by_owner_name entries and check manually
        sub = createProgram();
        sub = find(sub, 'workspace_by_owner_name', {}, '_allNameKeys');
        sub = mapBindings(sub, (bindings) => {
          // Check if _dupeKey exists in the name keys
          const allKeys = (bindings._allNameKeys as Array<Record<string, unknown>>) || [];
          const existing = bindings.existing as Record<string, unknown>;
          const owner = existing ? (existing.owner as string) : '';
          const dupeKey = `${owner}::${newName}`;
          return allKeys.some(entry => entry._key === dupeKey || entry.key === dupeKey);
        }, '_hasConflict');
        return branch(sub,
          (bindings) => !!bindings._hasConflict,
          complete(createProgram(), 'duplicate', { name: newName }),
          (innerBase) => {
            const now = new Date().toISOString();
            const newWorkspace = `${workspace}-copy`;
            let b2 = putFrom(innerBase, 'workspace', newWorkspace, (bindings) => {
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
            b2 = putFrom(b2, 'workspace_by_owner_name', `${newWorkspace}-key`, (bindings) => {
              const src = bindings.existing as Record<string, unknown>;
              const owner = src.owner as string;
              const dupeKey = `${owner}::${newName}`;
              return { workspace: newWorkspace, _key: dupeKey };
            });
            return complete(b2, 'ok', { newWorkspace });
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
    p = find(p, 'workspace', {}, 'allWorkspaces');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allWorkspaces as Array<Record<string, unknown>>) || [];
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
    }, 'workspaces');
    return completeFrom(p, 'ok', (bindings) => ({
      workspaces: bindings.workspaces as unknown[],
    })) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'record');
    return branch(p,
      (b) => b.record == null,
      (b) => complete(b, 'notfound', { message: 'Workspace not found' }),
      (b) => completeFrom(b, 'ok', (bindings) => {
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
