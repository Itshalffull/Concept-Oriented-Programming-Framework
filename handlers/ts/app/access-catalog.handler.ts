import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

async function listEntries(storage: ConceptStorage, kind?: string) {
  if (kind) {
    return storage.find('entry', { kind });
  }
  return storage.find('entry', {});
}

export const accessCatalogHandler: ConceptHandler = {
  async registerPermission(input: Record<string, unknown>, storage: ConceptStorage) {
    const entry = String(input.entry ?? '');
    await storage.put('entry', entry, {
      id: entry,
      kind: 'permission',
      key: String(input.key ?? ''),
      label: String(input.label ?? ''),
      group: String(input.group ?? ''),
      description: String(input.description ?? ''),
      permissions: JSON.stringify([]),
      catalog: '',
    });
    return { variant: 'ok', entry };
  },

  async registerRole(input: Record<string, unknown>, storage: ConceptStorage) {
    const entry = String(input.entry ?? '');
    const permissions = Array.isArray(input.permissions)
      ? input.permissions.map((permission) => String(permission))
      : typeof input.permissions === 'string'
        ? JSON.parse(String(input.permissions)) as string[]
        : [];

    await storage.put('entry', entry, {
      id: entry,
      kind: 'role',
      key: String(input.key ?? ''),
      label: String(input.label ?? ''),
      group: '',
      description: String(input.description ?? ''),
      permissions: JSON.stringify(permissions),
      catalog: '',
    });
    return { variant: 'ok', entry };
  },

  async registerResourceAction(input: Record<string, unknown>, storage: ConceptStorage) {
    const entry = String(input.entry ?? '');
    await storage.put('entry', entry, {
      id: entry,
      kind: 'resource-action',
      key: String(input.key ?? ''),
      label: String(input.label ?? ''),
      group: '',
      description: '',
      permissions: JSON.stringify([]),
      catalog: String(input.catalog ?? ''),
    });
    return { variant: 'ok', entry };
  },

  async listPermissions(_input: Record<string, unknown>, storage: ConceptStorage) {
    const entries = await listEntries(storage, 'permission');
    return {
      variant: 'ok',
      permissions: entries.map((entry) => ({
        key: String(entry.key ?? ''),
        label: String(entry.label ?? ''),
        group: String(entry.group ?? ''),
        description: String(entry.description ?? ''),
      })),
    };
  },

  async listRoles(_input: Record<string, unknown>, storage: ConceptStorage) {
    const entries = await listEntries(storage, 'role');
    return {
      variant: 'ok',
      roles: entries.map((entry) => ({
        key: String(entry.key ?? ''),
        label: String(entry.label ?? ''),
        description: String(entry.description ?? ''),
        permissions: JSON.parse(String(entry.permissions ?? '[]')) as string[],
      })),
    };
  },

  async listResourceActions(input: Record<string, unknown>, storage: ConceptStorage) {
    const catalog = String(input.catalog ?? '');
    const entries = await storage.find('entry', { kind: 'resource-action', catalog });
    return {
      variant: 'ok',
      actions: entries.map((entry) => ({
        key: String(entry.key ?? ''),
        label: String(entry.label ?? ''),
      })),
    };
  },
};

export default accessCatalogHandler;
