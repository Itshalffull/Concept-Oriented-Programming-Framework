import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('../clef-base/lib/kernel', () => ({
  ensureSeeded: vi.fn(async () => {}),
  getKernel: vi.fn(() => ({
    invokeConcept: vi.fn(async (concept: string, action: string, input: Record<string, unknown>) => {
      if (concept === 'urn:clef/ContentNode' && action === 'get') {
        return {
          variant: 'ok',
          node: String(input.node ?? ''),
          type: String(input.node ?? '').startsWith('page-') ? 'Page' : 'Article',
        };
      }

      throw new Error(`Unexpected kernel call: ${concept}/${action}`);
    }),
  })),
}));

import {
  canInvokeAdminConcept,
  getContentPermissionAction,
  getSchemaPermissionAction,
} from '../clef-base/lib/auth';
import {
  canAccessSchema,
  getIdentityStorage,
  schemaActionCatalog,
  setNodeActionRoles,
  setSchemaActionRoles,
} from '../clef-base/lib/identity';

async function clearRelation(storeName: 'access-control' | 'authorization' | 'authentication' | 'session', relation: string) {
  const storage = getIdentityStorage(storeName);
  const records = await storage.find(relation);
  for (const record of records) {
    const key = String(record._key ?? '');
    if (key) {
      await storage.del(relation, key);
    }
  }
}

describe('Clef Base auth access', () => {
  beforeEach(async () => {
    await clearRelation('access-control', 'grant');
  });

  it('exposes explicit schema actions instead of a generic manage-schema bucket', () => {
    expect(schemaActionCatalog.map((action) => action.key)).toEqual([
      'view',
      'create',
      'edit',
      'delete',
      'define-schema',
      'add-field',
      'extend-schema',
      'apply-schema',
      'remove-schema',
      'export-schema',
    ]);
  });

  it('maps schema concept actions to the matching schema permission action', () => {
    expect(getSchemaPermissionAction('list')).toBe('view');
    expect(getSchemaPermissionAction('defineSchema')).toBe('define-schema');
    expect(getSchemaPermissionAction('addField')).toBe('add-field');
    expect(getSchemaPermissionAction('extendSchema')).toBe('extend-schema');
    expect(getSchemaPermissionAction('applyTo')).toBe('apply-schema');
    expect(getSchemaPermissionAction('removeFrom')).toBe('remove-schema');
    expect(getSchemaPermissionAction('export')).toBe('export-schema');
  });

  it('maps content actions to schema and node permission actions', () => {
    expect(getContentPermissionAction('create')).toBe('create');
    expect(getContentPermissionAction('update')).toBe('edit');
    expect(getContentPermissionAction('setMetadata')).toBe('edit-metadata');
    expect(getContentPermissionAction('changeType')).toBe('change-type');
  });

  it('uses admin-only defaults for schema definition actions', async () => {
    await expect(canAccessSchema(['viewer'], 'Article', 'add-field')).resolves.toBe(false);
    await expect(canAccessSchema(['editor'], 'Article', 'add-field')).resolves.toBe(false);
    await expect(canAccessSchema(['admin'], 'Article', 'add-field')).resolves.toBe(true);
  });

  it('allows schema-specific overrides for schema definition actions', async () => {
    await setSchemaActionRoles('Article', 'add-field', ['editor']);
    await expect(canAccessSchema(['editor'], 'Article', 'add-field')).resolves.toBe(true);
    await expect(canAccessSchema(['viewer'], 'Article', 'add-field')).resolves.toBe(false);
  });

  it('enforces content create against schema-level create permissions', async () => {
    await expect(
      canInvokeAdminConcept(
        {
          sessionId: 's1',
          user: 'editor-user',
          device: 'test',
          roles: ['editor'],
          permissions: [],
        },
        'ContentNode',
        'create',
        { type: 'Article' },
      ),
    ).resolves.toBe(true);

    await expect(
      canInvokeAdminConcept(
        {
          sessionId: 's2',
          user: 'viewer-user',
          device: 'test',
          roles: ['viewer'],
          permissions: [],
        },
        'ContentNode',
        'create',
        { type: 'Article' },
      ),
    ).resolves.toBe(false);
  });

  it('enforces schema definition actions through the admin invoke gate', async () => {
    await expect(
      canInvokeAdminConcept(
        {
          sessionId: 's3',
          user: 'editor-user',
          device: 'test',
          roles: ['editor'],
          permissions: [],
        },
        'Schema',
        'addField',
        { schema: 'Article' },
      ),
    ).resolves.toBe(false);

    await setSchemaActionRoles('Article', 'add-field', ['editor']);

    await expect(
      canInvokeAdminConcept(
        {
          sessionId: 's4',
          user: 'editor-user',
          device: 'test',
          roles: ['editor'],
          permissions: [],
        },
        'Schema',
        'addField',
        { schema: 'Article' },
      ),
    ).resolves.toBe(true);
  });

  it('lets node overrides narrow content item permissions independently of schema defaults', async () => {
    await setNodeActionRoles('article-1', 'edit', ['admin']);

    await expect(
      canInvokeAdminConcept(
        {
          sessionId: 's5',
          user: 'editor-user',
          device: 'test',
          roles: ['editor'],
          permissions: [],
        },
        'ContentNode',
        'update',
        { node: 'article-1' },
      ),
    ).resolves.toBe(false);

    await expect(
      canInvokeAdminConcept(
        {
          sessionId: 's6',
          user: 'admin-user',
          device: 'test',
          roles: ['admin'],
          permissions: [],
        },
        'ContentNode',
        'update',
        { node: 'article-1' },
      ),
    ).resolves.toBe(true);
  });
});
