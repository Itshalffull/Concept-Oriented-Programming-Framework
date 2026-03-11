import { randomUUID } from 'crypto';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import type { Kernel } from '../../runtime/self-hosted';
import type { ConceptStorage } from '../../runtime/types';

export const AUTH_COOKIE_NAME = 'clef_base_session';
export const ADMIN_PERMISSION = 'admin.access';

export interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
}

export interface RoleDefinition {
  key: string;
  label: string;
  description: string;
  permissions: string[];
}

export interface ResourceActionDefinition {
  key: string;
  label: string;
}

type IdentityStoreName = 'authentication' | 'authorization' | 'access-control' | 'session';

declare global {
  var __clefBaseIdentityStorages: Record<IdentityStoreName, ConceptStorage> | undefined;
  var __clefBaseIdentityBootstrapped: boolean | undefined;
}

function createIdentityStorages(): Record<IdentityStoreName, ConceptStorage> {
  return {
    authentication: createStorageFromEnv('clef-base:authentication') ?? createInMemoryStorage(),
    authorization: createStorageFromEnv('clef-base:authorization') ?? createInMemoryStorage(),
    'access-control': createStorageFromEnv('clef-base:access-control') ?? createInMemoryStorage(),
    session: createStorageFromEnv('clef-base:session') ?? createInMemoryStorage(),
  };
}

const identityStorages =
  globalThis.__clefBaseIdentityStorages ?? (globalThis.__clefBaseIdentityStorages = createIdentityStorages());

export const permissionCatalog: PermissionDefinition[] = [
  {
    key: ADMIN_PERMISSION,
    label: 'Access administration',
    group: 'Administration',
    description: 'Open the Clef Base admin interface and administer users, roles, and permissions.',
  },
  {
    key: 'content.manage',
    label: 'Manage content',
    group: 'Content',
    description: 'Create, edit, and inspect content entities.',
  },
  {
    key: 'schema.manage',
    label: 'Manage schemas',
    group: 'Structure',
    description: 'Create and update schemas and structural metadata.',
  },
  {
    key: 'view.manage',
    label: 'Manage views',
    group: 'Structure',
    description: 'Edit saved views, builders, and layouts.',
  },
  {
    key: 'taxonomy.manage',
    label: 'Manage taxonomy',
    group: 'Structure',
    description: 'Create and maintain vocabularies and terms.',
  },
  {
    key: 'workflow.manage',
    label: 'Manage workflows',
    group: 'Operations',
    description: 'Edit workflow states and transitions.',
  },
  {
    key: 'automation.manage',
    label: 'Manage automations',
    group: 'Operations',
    description: 'Create or modify automation rules.',
  },
  {
    key: 'theme.manage',
    label: 'Manage themes',
    group: 'Surface',
    description: 'Configure design system themes and tokens.',
  },
  {
    key: 'display-mode.manage',
    label: 'Manage display modes',
    group: 'Surface',
    description: 'Adjust display modes and field rendering configuration.',
  },
  {
    key: 'mapping.manage',
    label: 'Manage mappings',
    group: 'Surface',
    description: 'Update component and widget mappings.',
  },
  {
    key: 'score.view',
    label: 'View score panels',
    group: 'Platform',
    description: 'Open score, concept browser, and sync inspection screens.',
  },
  {
    key: 'multiverse.manage',
    label: 'Manage multiverse',
    group: 'Platform',
    description: 'Inspect version spaces and override state.',
  },
];

export const roleDefinitions: RoleDefinition[] = [
  {
    key: 'admin',
    label: 'Administrator',
    description: 'Full control over Clef Base configuration, content, and access.',
    permissions: permissionCatalog.map((permission) => permission.key),
  },
  {
    key: 'editor',
    label: 'Editor',
    description: 'Content and structure editor without full access control administration.',
    permissions: [
      'content.manage',
      'view.manage',
      'taxonomy.manage',
      'workflow.manage',
      'automation.manage',
      'theme.manage',
      'display-mode.manage',
      'mapping.manage',
      'score.view',
    ],
  },
  {
    key: 'viewer',
    label: 'Viewer',
    description: 'Read-only observer for score and administrative dashboards.',
    permissions: ['score.view'],
  },
];

export const schemaActionCatalog: ResourceActionDefinition[] = [
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
];

export const nodeActionCatalog: ResourceActionDefinition[] = [
  { key: 'view', label: 'View' },
  { key: 'edit', label: 'Edit content' },
  { key: 'delete', label: 'Delete' },
  { key: 'change-type', label: 'Change type' },
  { key: 'edit-metadata', label: 'Edit metadata' },
];

const schemaActionKeys = new Set(schemaActionCatalog.map((action) => action.key));
const nodeActionKeys = new Set(nodeActionCatalog.map((action) => action.key));

export function getIdentityStorage(name: IdentityStoreName): ConceptStorage {
  return identityStorages[name];
}

export function getConfiguredAdminUser(): string {
  return process.env.CLEF_BASE_ADMIN_USERNAME?.trim() || 'admin';
}

export function getConfiguredAdminPassword(): string {
  return process.env.CLEF_BASE_ADMIN_PASSWORD?.trim() || 'change-me-now';
}

export function getConfiguredAuthProvider(): string {
  return process.env.CLEF_BASE_AUTH_PROVIDER?.trim() || 'local';
}

export function getPublicArticleContent() {
  const adminUser = getConfiguredAdminUser();
  const title = process.env.CLEF_BASE_PUBLIC_TITLE?.trim() || 'Set up Clef Base';
  const body =
    process.env.CLEF_BASE_PUBLIC_BODY?.trim() ||
    [
      'Clef Base starts with a single administrator account defined in environment variables.',
      `Sign in with the username "${adminUser}" and the password from CLEF_BASE_ADMIN_PASSWORD, then open Access to create editors, viewers, and custom permissions.`,
      'For production deployments, move identity storage to Upstash or Vercel KV by setting KV_REST_API_URL and KV_REST_API_TOKEN before first boot.',
    ].join('\n\n');

  return { title, body, adminUser };
}

function isIdentityBootstrapped() {
  return globalThis.__clefBaseIdentityBootstrapped === true;
}

function markIdentityBootstrapped() {
  globalThis.__clefBaseIdentityBootstrapped = true;
}

export async function bootstrapIdentity(kernel: Kernel) {
  if (isIdentityBootstrapped()) return;

  for (const role of roleDefinitions) {
    for (const permission of role.permissions) {
      await kernel.invokeConcept('urn:clef/Authorization', 'grantPermission', {
        role: role.key,
        permission,
      });
    }
  }

  const user = getConfiguredAdminUser();
  const provider = getConfiguredAuthProvider();
  const credentials = getConfiguredAdminPassword();
  const registerResult = await kernel.invokeConcept('urn:clef/Authentication', 'register', {
    user,
    provider,
    credentials,
  });

  if (registerResult.variant === 'exists') {
    await kernel.invokeConcept('urn:clef/Authentication', 'resetPassword', {
      user,
      newCredentials: credentials,
    });
  }

  await kernel.invokeConcept('urn:clef/Authorization', 'assignRole', {
    user,
    role: 'admin',
  });

  markIdentityBootstrapped();
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function defaultRolesForSchemaAction(action: string) {
  switch (action) {
    case 'view':
      return ['admin', 'editor', 'viewer'];
    case 'create':
    case 'edit':
    case 'delete':
      return ['admin', 'editor'];
    case 'define-schema':
    case 'add-field':
    case 'extend-schema':
    case 'apply-schema':
    case 'remove-schema':
    case 'export-schema':
    default:
      return ['admin'];
  }
}

function defaultRolesForNodeAction(action: string) {
  switch (action) {
    case 'view':
      return ['admin', 'editor', 'viewer'];
    case 'edit':
    case 'delete':
    case 'change-type':
    case 'edit-metadata':
      return ['admin', 'editor'];
    default:
      return ['admin'];
  }
}

function schemaGrantKey(schema: string, action: string) {
  return `schema:${schema}:${action}`;
}

function nodeGrantKey(node: string, action: string) {
  return `node:${node}:${action}`;
}

async function readGrantRoles(kind: 'schema' | 'node', resource: string, action: string) {
  const key = kind === 'schema' ? schemaGrantKey(resource, action) : nodeGrantKey(resource, action);
  const record = await getIdentityStorage('access-control').get('grant', key);
  return record ? parseJsonArray(record.roles) : [];
}

async function writeGrantRoles(
  kind: 'schema' | 'node',
  resource: string,
  action: string,
  roles: string[],
) {
  const key = kind === 'schema' ? schemaGrantKey(resource, action) : nodeGrantKey(resource, action);
  await getIdentityStorage('access-control').put('grant', key, {
    key,
    kind,
    resource,
    action,
    roles: JSON.stringify(uniqueSorted(roles)),
  });
}

export async function readUserRoles(user: string): Promise<string[]> {
  const record = await getIdentityStorage('authorization').get('userRole', user);
  return record ? parseJsonArray(record.roles) : [];
}

export async function readRolePermissions(role: string): Promise<string[]> {
  const record = await getIdentityStorage('authorization').get('role', role);
  return record ? parseJsonArray(record.permissions) : [];
}

export async function readUserPermissions(user: string): Promise<string[]> {
  const roles = await readUserRoles(user);
  const permissions = new Set<string>();

  for (const role of roles) {
    for (const permission of await readRolePermissions(role)) {
      permissions.add(permission);
    }
  }

  return [...permissions].sort();
}

export async function buildAccessSnapshot(kernel: Kernel) {
  const [accounts, roleRecords, sessions] = await Promise.all([
    getIdentityStorage('authentication').find('account'),
    getIdentityStorage('authorization').find('role'),
    getIdentityStorage('session').find('session'),
  ]);
  const [schemas, nodes] = await Promise.all([
    getSchemaAccessPolicies(kernel),
    getNodeAccessPolicies(kernel),
  ]);

  const users = await Promise.all(
    accounts
      .map((account) => String(account.user ?? ''))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map(async (user) => ({
        user,
        provider: String(
          accounts.find((account) => String(account.user ?? '') === user)?.provider ?? 'local',
        ),
        roles: await readUserRoles(user),
        permissions: await readUserPermissions(user),
        sessionCount: sessions.filter((session) => String(session.userId ?? '') === user).length,
      })),
  );

  const roles = roleRecords
    .map((role) => ({
      role: String(role.role ?? ''),
      permissions: parseJsonArray(role.permissions),
    }))
    .filter((role) => role.role)
    .sort((left, right) => left.role.localeCompare(right.role));

  return {
    users,
    roles,
    permissionCatalog,
    roleDefinitions,
    schemas,
    nodes,
    schemaActionCatalog,
    nodeActionCatalog,
  };
}

export async function createManagedUser(options: {
  kernel: Kernel;
  user: string;
  password: string;
  provider?: string;
  roles?: string[];
}) {
  const provider = options.provider?.trim() || 'local';
  const registerResult = await options.kernel.invokeConcept('urn:clef/Authentication', 'register', {
    user: options.user,
    provider,
    credentials: options.password,
  });

  if (registerResult.variant === 'exists') {
    await options.kernel.invokeConcept('urn:clef/Authentication', 'resetPassword', {
      user: options.user,
      newCredentials: options.password,
    });
  }

  for (const role of options.roles ?? []) {
    await options.kernel.invokeConcept('urn:clef/Authorization', 'assignRole', {
      user: options.user,
      role,
    });
  }
}

export async function revokeManagedRole(user: string, role: string) {
  const storage = getIdentityStorage('authorization');
  const currentRoles = await readUserRoles(user);
  const nextRoles = currentRoles.filter((entry) => entry !== role);
  await storage.put('userRole', user, {
    user,
    roles: JSON.stringify(nextRoles),
  });
}

export async function createManagedRole(role: string) {
  const storage = getIdentityStorage('authorization');
  const existing = await storage.get('role', role);
  if (existing) return;
  await storage.put('role', role, { role, permissions: JSON.stringify([]) });
}

export async function getSchemaAccessPolicies(kernel: Kernel) {
  const result = await kernel.invokeConcept('urn:clef/Schema', 'list', {});
  const items =
    result.variant === 'ok' && typeof result.items === 'string'
      ? (JSON.parse(result.items) as Array<Record<string, unknown>>)
      : [];

  return Promise.all(
    items
      .map((item) => String(item.schema ?? ''))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map(async (schema) => {
        const resolved: Record<string, string[]> = {};
        for (const { key } of schemaActionCatalog) {
          const explicit = await readGrantRoles('schema', schema, key);
          resolved[key] = explicit.length > 0 ? explicit : defaultRolesForSchemaAction(key);
        }
        return { schema, actions: resolved };
      }),
  );
}

export async function getNodeAccessPolicies(kernel: Kernel) {
  const result = await kernel.invokeConcept('urn:clef/ContentNode', 'list', {});
  const items =
    result.variant === 'ok' && typeof result.items === 'string'
      ? (JSON.parse(result.items) as Array<Record<string, unknown>>)
      : [];

  return Promise.all(
    items
      .slice(0, 50)
      .map(async (item) => {
        const node = String(item.node ?? '');
        const type = String(item.type ?? '');
        const actions: Record<string, string[]> = {};
        for (const { key } of nodeActionCatalog) {
          const explicit = await readGrantRoles('node', node, key);
          actions[key] = explicit.length > 0 ? explicit : defaultRolesForNodeAction(key);
        }
        return { node, type, actions };
      }),
  );
}

export async function setSchemaActionRoles(schema: string, action: string, roles: string[]) {
  if (!schemaActionKeys.has(action)) {
    throw new Error(`Unknown schema action: ${action}`);
  }
  await writeGrantRoles('schema', schema, action, roles);
}

export async function setNodeActionRoles(node: string, action: string, roles: string[]) {
  if (!nodeActionKeys.has(action)) {
    throw new Error(`Unknown node action: ${action}`);
  }
  await writeGrantRoles('node', node, action, roles);
}

export async function canAccessSchema(userRoles: string[], schema: string, action: string) {
  if (!schemaActionKeys.has(action)) {
    return false;
  }
  const explicit = await readGrantRoles('schema', schema, action);
  const allowedRoles = explicit.length > 0 ? explicit : defaultRolesForSchemaAction(action);
  return userRoles.some((role) => allowedRoles.includes(role));
}

export async function canAccessNode(
  userRoles: string[],
  node: string,
  schema: string,
  action: string,
) {
  if (!nodeActionKeys.has(action)) {
    return false;
  }
  const explicit = await readGrantRoles('node', node, action);
  const nodeAllowed = explicit.length > 0 ? explicit : null;
  const schemaAllowed = await readGrantRoles('schema', schema, action);
  const fallback = schemaAllowed.length > 0 ? schemaAllowed : defaultRolesForNodeAction(action);
  const allowedRoles = nodeAllowed ?? fallback;
  return userRoles.some((role) => allowedRoles.includes(role));
}

export async function createSessionForUser(kernel: Kernel, user: string, device: string) {
  const sessionId = randomUUID();
  await kernel.invokeConcept('urn:clef/Session', 'create', {
    session: sessionId,
    userId: user,
    device,
  });
  return sessionId;
}
