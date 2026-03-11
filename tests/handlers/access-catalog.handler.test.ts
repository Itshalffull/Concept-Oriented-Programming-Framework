import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { accessCatalogHandler } from '../../handlers/ts/app/access-catalog.handler.js';

describe('accessCatalogHandler', () => {
  it('stores and lists permissions and roles', async () => {
    const storage = createInMemoryStorage();

    await accessCatalogHandler.registerPermission({
      entry: 'permission:admin.access',
      key: 'admin.access',
      label: 'Access administration',
      group: 'Administration',
      description: 'Open the admin shell.',
    }, storage);

    await accessCatalogHandler.registerRole({
      entry: 'role:admin',
      key: 'admin',
      label: 'Administrator',
      description: 'Full control.',
      permissions: ['admin.access'],
    }, storage);

    const permissions = await accessCatalogHandler.listPermissions({}, storage);
    const roles = await accessCatalogHandler.listRoles({}, storage);

    expect(permissions.permissions).toEqual([
      expect.objectContaining({ key: 'admin.access', group: 'Administration' }),
    ]);
    expect(roles.roles).toEqual([
      expect.objectContaining({ key: 'admin', permissions: ['admin.access'] }),
    ]);
  });

  it('stores and lists resource action catalogs', async () => {
    const storage = createInMemoryStorage();

    await accessCatalogHandler.registerResourceAction({
      entry: 'resource-action:schema:view',
      catalog: 'schema',
      key: 'view',
      label: 'View',
    }, storage);

    const actions = await accessCatalogHandler.listResourceActions({
      catalog: 'schema',
    }, storage);

    expect(actions.actions).toEqual([
      expect.objectContaining({ key: 'view', label: 'View' }),
    ]);
  });
});
