import { beforeEach, describe, expect, it, vi } from 'vitest';

const resourceGrantStore = vi.hoisted(() => new Map<string, { scope: string; resourcePattern: string; actionName: string; roles: string[] }>());
const accessCatalog = vi.hoisted(() => ({
  permissions: [
    { key: 'admin.access', label: 'Access administration', group: 'Administration', description: 'Open the Clef Base admin interface and administer users, roles, and permissions.' },
    { key: 'content.manage', label: 'Manage content', group: 'Content', description: 'Create, edit, and inspect content entities.' },
    { key: 'schema.manage', label: 'Manage schemas', group: 'Structure', description: 'Create and update schemas and structural metadata.' },
    { key: 'view.manage', label: 'Manage views', group: 'Structure', description: 'Edit saved views, builders, and layouts.' },
    { key: 'taxonomy.manage', label: 'Manage taxonomy', group: 'Structure', description: 'Create and maintain vocabularies and terms.' },
    { key: 'workflow.manage', label: 'Manage workflows', group: 'Operations', description: 'Edit workflow states and transitions.' },
    { key: 'automation.manage', label: 'Manage automations', group: 'Operations', description: 'Create or modify automation rules.' },
    { key: 'theme.manage', label: 'Manage themes', group: 'Surface', description: 'Configure design system themes and tokens.' },
    { key: 'display-mode.manage', label: 'Manage display modes', group: 'Surface', description: 'Adjust display modes and field rendering configuration.' },
    { key: 'mapping.manage', label: 'Manage mappings', group: 'Surface', description: 'Update component and widget mappings.' },
    { key: 'score.view', label: 'View score panels', group: 'Platform', description: 'Open score, concept browser, and sync inspection screens.' },
    { key: 'multiverse.manage', label: 'Manage multiverse', group: 'Platform', description: 'Inspect version spaces and override state.' },
  ],
  roles: [
    { key: 'admin', label: 'Administrator', description: 'Full control over Clef Base configuration, content, and access.', permissions: ['admin.access','content.manage','schema.manage','view.manage','taxonomy.manage','workflow.manage','automation.manage','theme.manage','display-mode.manage','mapping.manage','score.view','multiverse.manage'] },
    { key: 'editor', label: 'Editor', description: 'Content and structure editor without full access control administration.', permissions: ['content.manage','view.manage','taxonomy.manage','workflow.manage','automation.manage','theme.manage','display-mode.manage','mapping.manage','score.view'] },
    { key: 'viewer', label: 'Viewer', description: 'Read-only observer for score and administrative dashboards.', permissions: ['score.view'] },
  ],
  resourceActions: {
    schema: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create content' },
      { key: 'edit', label: 'Edit content' },
      { key: 'delete', label: 'Delete content' },
      { key: 'define-schema', label: 'Define schema' },
      { key: 'add-field', label: 'Add field' },
      { key: 'extend-schema', label: 'Extend schema' },
      { key: 'apply-schema', label: 'Attach schema' },
      { key: 'remove-schema', label: 'Detach schema' },
      { key: 'export-schema', label: 'Export schema' },
    ],
    node: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit content' },
      { key: 'delete', label: 'Delete' },
      { key: 'change-type', label: 'Change type' },
      { key: 'edit-metadata', label: 'Edit metadata' },
    ],
  },
}));

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
      if (concept === 'urn:clef/ResourceGrantPolicy') {
        const key = `${String(input.scope ?? '')}:${String(input.resourcePattern ?? input.resource ?? '')}:${String(input.actionName ?? '')}`;
        if (action === 'setGrant') {
          resourceGrantStore.set(String(input.grant ?? key), {
            scope: String(input.scope ?? ''),
            resourcePattern: String(input.resourcePattern ?? ''),
            actionName: String(input.actionName ?? ''),
            roles: Array.isArray(input.roles) ? input.roles.map((role) => String(role)) : [],
          });
          return { variant: 'ok', grant: String(input.grant ?? key) };
        }

        if (action === 'getGrant') {
          const exactKey = `${String(input.scope ?? '')}:${String(input.resourcePattern ?? '')}:${String(input.actionName ?? '')}`;
          const record = resourceGrantStore.get(exactKey);
          return record
            ? { variant: 'ok', grant: exactKey, roles: record.roles }
            : { variant: 'notfound', message: 'Grant not found' };
        }

        if (action === 'resolve') {
          const exactKey = `${String(input.scope ?? '')}:${String(input.resource ?? '')}:${String(input.actionName ?? '')}`;
          const exact = resourceGrantStore.get(exactKey);
          if (exact) {
            return { variant: 'ok', grant: exactKey, roles: exact.roles, matchedPattern: String(input.resource ?? '') };
          }

          const wildcardKey = `${String(input.scope ?? '')}:*:${String(input.actionName ?? '')}`;
          const wildcard = resourceGrantStore.get(wildcardKey);
          return wildcard
            ? { variant: 'ok', grant: wildcardKey, roles: wildcard.roles, matchedPattern: '*' }
            : { variant: 'notfound', message: 'Grant not found' };
        }
      }

      if (concept === 'urn:clef/AccessCatalog') {
        if (action === 'listPermissions') {
          return { variant: 'ok', permissions: accessCatalog.permissions };
        }
        if (action === 'listRoles') {
          return { variant: 'ok', roles: accessCatalog.roles };
        }
        if (action === 'listResourceActions') {
          const catalog = String(input.catalog ?? '') as 'schema' | 'node';
          return { variant: 'ok', actions: accessCatalog.resourceActions[catalog] ?? [] };
        }
      }

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
  getResourceActionCatalog,
  setNodeActionRoles,
  setSchemaActionRoles,
} from '../clef-base/lib/identity';

describe('Clef Base auth access', () => {
  beforeEach(async () => {
    resourceGrantStore.clear();
    resourceGrantStore.set('schema:*:view', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'view',
      roles: ['admin', 'editor', 'viewer'],
    });
    resourceGrantStore.set('schema:*:create', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'create',
      roles: ['admin', 'editor'],
    });
    resourceGrantStore.set('schema:*:edit', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'edit',
      roles: ['admin', 'editor'],
    });
    resourceGrantStore.set('schema:*:delete', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'delete',
      roles: ['admin', 'editor'],
    });
    resourceGrantStore.set('schema:*:define-schema', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'define-schema',
      roles: ['admin'],
    });
    resourceGrantStore.set('schema:*:add-field', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'add-field',
      roles: ['admin'],
    });
    resourceGrantStore.set('schema:*:extend-schema', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'extend-schema',
      roles: ['admin'],
    });
    resourceGrantStore.set('schema:*:apply-schema', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'apply-schema',
      roles: ['admin'],
    });
    resourceGrantStore.set('schema:*:remove-schema', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'remove-schema',
      roles: ['admin'],
    });
    resourceGrantStore.set('schema:*:export-schema', {
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'export-schema',
      roles: ['admin'],
    });
    resourceGrantStore.set('node:*:view', {
      scope: 'node',
      resourcePattern: '*',
      actionName: 'view',
      roles: ['admin', 'editor', 'viewer'],
    });
    resourceGrantStore.set('node:*:edit', {
      scope: 'node',
      resourcePattern: '*',
      actionName: 'edit',
      roles: ['admin', 'editor'],
    });
    resourceGrantStore.set('node:*:delete', {
      scope: 'node',
      resourcePattern: '*',
      actionName: 'delete',
      roles: ['admin', 'editor'],
    });
    resourceGrantStore.set('node:*:change-type', {
      scope: 'node',
      resourcePattern: '*',
      actionName: 'change-type',
      roles: ['admin', 'editor'],
    });
    resourceGrantStore.set('node:*:edit-metadata', {
      scope: 'node',
      resourcePattern: '*',
      actionName: 'edit-metadata',
      roles: ['admin', 'editor'],
    });
  });

  it('exposes explicit schema actions instead of a generic manage-schema bucket', () => {
    return import('../clef-base/lib/kernel').then(async ({ getKernel }) => {
      const actions = await getResourceActionCatalog(getKernel(), 'schema');
      expect(actions.map((action) => action.key)).toEqual([
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
    expect(getContentPermissionAction('delete')).toBe('delete');
  });

  it('uses admin-only defaults for schema definition actions', async () => {
    const kernel = (await import('../clef-base/lib/kernel')).getKernel();
    await expect(canAccessSchema(kernel, ['viewer'], 'Article', 'add-field')).resolves.toBe(false);
    await expect(canAccessSchema(kernel, ['editor'], 'Article', 'add-field')).resolves.toBe(false);
    await expect(canAccessSchema(kernel, ['admin'], 'Article', 'add-field')).resolves.toBe(true);
  });

  it('allows schema-specific overrides for schema definition actions', async () => {
    const kernel = (await import('../clef-base/lib/kernel')).getKernel();
    await setSchemaActionRoles(kernel, 'Article', 'add-field', ['editor']);
    await expect(canAccessSchema(kernel, ['editor'], 'Article', 'add-field')).resolves.toBe(true);
    await expect(canAccessSchema(kernel, ['viewer'], 'Article', 'add-field')).resolves.toBe(false);
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

    const kernel = (await import('../clef-base/lib/kernel')).getKernel();
    await setSchemaActionRoles(kernel, 'Article', 'add-field', ['editor']);

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
    const kernel = (await import('../clef-base/lib/kernel')).getKernel();
    await setNodeActionRoles(kernel, 'article-1', 'edit', ['admin']);

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
