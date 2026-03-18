// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, find, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _accessCatalogHandler: FunctionalConceptHandler = {
  registerPermission(input: Record<string, unknown>) {
    const entry = String(input.entry ?? '');
    let p = createProgram();
    p = put(p, 'entry', entry, {
      id: entry,
      kind: 'permission',
      key: String(input.key ?? ''),
      label: String(input.label ?? ''),
      group: String(input.group ?? ''),
      description: String(input.description ?? ''),
      permissions: JSON.stringify([]),
      catalog: '',
    });
    return complete(p, 'ok', { entry }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerRole(input: Record<string, unknown>) {
    const entry = String(input.entry ?? '');
    const permissions = Array.isArray(input.permissions)
      ? input.permissions.map((permission) => String(permission))
      : typeof input.permissions === 'string'
        ? JSON.parse(String(input.permissions)) as string[]
        : [];

    let p = createProgram();
    p = put(p, 'entry', entry, {
      id: entry,
      kind: 'role',
      key: String(input.key ?? ''),
      label: String(input.label ?? ''),
      group: '',
      description: String(input.description ?? ''),
      permissions: JSON.stringify(permissions),
      catalog: '',
    });
    return complete(p, 'ok', { entry }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerResourceAction(input: Record<string, unknown>) {
    const entry = String(input.entry ?? '');
    let p = createProgram();
    p = put(p, 'entry', entry, {
      id: entry,
      kind: 'resource-action',
      key: String(input.key ?? ''),
      label: String(input.label ?? ''),
      group: '',
      description: '',
      permissions: JSON.stringify([]),
      catalog: String(input.catalog ?? ''),
    });
    return complete(p, 'ok', { entry }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listPermissions(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entry', { kind: 'permission' }, 'entries');
    return complete(p, 'ok', { permissions: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listRoles(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entry', { kind: 'role' }, 'entries');
    return complete(p, 'ok', { roles: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listResourceActions(input: Record<string, unknown>) {
    const catalog = String(input.catalog ?? '');
    let p = createProgram();
    p = find(p, 'entry', { kind: 'resource-action', catalog }, 'entries');
    return complete(p, 'ok', { actions: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const accessCatalogHandler = autoInterpret(_accessCatalogHandler);


export default accessCatalogHandler;
