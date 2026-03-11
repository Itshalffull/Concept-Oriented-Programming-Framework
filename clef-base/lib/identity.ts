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

type IdentityStoreName =
  | 'access-catalog'
  | 'authentication'
  | 'authorization'
  | 'access-control'
  | 'resource-grant-policy'
  | 'session';

declare global {
  var __clefBaseIdentityStorages: Record<IdentityStoreName, ConceptStorage> | undefined;
  var __clefBaseIdentityBootstrapped: boolean | undefined;
}

function createIdentityStorages(): Record<IdentityStoreName, ConceptStorage> {
  return {
    'access-catalog': createStorageFromEnv('clef-base:access-catalog') ?? createInMemoryStorage(),
    authentication: createStorageFromEnv('clef-base:authentication') ?? createInMemoryStorage(),
    authorization: createStorageFromEnv('clef-base:authorization') ?? createInMemoryStorage(),
    'access-control': createStorageFromEnv('clef-base:access-control') ?? createInMemoryStorage(),
    'resource-grant-policy': createStorageFromEnv('clef-base:resource-grant-policy') ?? createInMemoryStorage(),
    session: createStorageFromEnv('clef-base:session') ?? createInMemoryStorage(),
  };
}

const identityStorages =
  globalThis.__clefBaseIdentityStorages ?? (globalThis.__clefBaseIdentityStorages = createIdentityStorages());

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

  const roleDefinitions = await getRoleCatalog(kernel);
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

export async function getPermissionCatalog(kernel: Kernel): Promise<PermissionDefinition[]> {
  const result = await kernel.invokeConcept('urn:clef/AccessCatalog', 'listPermissions', {});
  if (result.variant !== 'ok' || !Array.isArray(result.permissions)) {
    return [];
  }
  return result.permissions.map((permission) => ({
    key: String(permission.key ?? ''),
    label: String(permission.label ?? ''),
    group: String(permission.group ?? ''),
    description: String(permission.description ?? ''),
  }));
}

export async function getRoleCatalog(kernel: Kernel): Promise<RoleDefinition[]> {
  const result = await kernel.invokeConcept('urn:clef/AccessCatalog', 'listRoles', {});
  if (result.variant !== 'ok' || !Array.isArray(result.roles)) {
    return [];
  }
  return result.roles.map((role) => ({
    key: String(role.key ?? ''),
    label: String(role.label ?? ''),
    description: String(role.description ?? ''),
    permissions: Array.isArray(role.permissions)
      ? role.permissions.map((permission: unknown) => String(permission))
      : [],
  }));
}

export async function getResourceActionCatalog(
  kernel: Kernel,
  catalog: 'schema' | 'node',
): Promise<ResourceActionDefinition[]> {
  const result = await kernel.invokeConcept('urn:clef/AccessCatalog', 'listResourceActions', {
    catalog,
  });
  if (result.variant !== 'ok' || !Array.isArray(result.actions)) {
    return [];
  }
  return result.actions.map((action) => ({
    key: String(action.key ?? ''),
    label: String(action.label ?? ''),
  }));
}

async function hasResourceAction(
  kernel: Kernel,
  catalog: 'schema' | 'node',
  action: string,
): Promise<boolean> {
  const actions = await getResourceActionCatalog(kernel, catalog);
  return actions.some((entry) => entry.key === action);
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

async function getExactGrantRoles(
  kernel: Kernel,
  scope: 'schema' | 'node',
  resourcePattern: string,
  action: string,
): Promise<string[] | null> {
  const result = await kernel.invokeConcept('urn:clef/ResourceGrantPolicy', 'getGrant', {
    scope,
    resourcePattern,
    actionName: action,
  });
  if (result.variant !== 'ok') {
    return null;
  }
  return Array.isArray(result.roles) ? result.roles.map((role) => String(role)) : [];
}

async function resolveGrantRoles(
  kernel: Kernel,
  scope: 'schema' | 'node',
  resource: string,
  action: string,
): Promise<string[] | null> {
  const result = await kernel.invokeConcept('urn:clef/ResourceGrantPolicy', 'resolve', {
    scope,
    resource,
    actionName: action,
  });
  if (result.variant !== 'ok') {
    return null;
  }
  return Array.isArray(result.roles) ? result.roles.map((role) => String(role)) : [];
}

async function writeGrantRoles(
  kernel: Kernel,
  scope: 'schema' | 'node',
  resourcePattern: string,
  action: string,
  roles: string[],
) {
  await kernel.invokeConcept('urn:clef/ResourceGrantPolicy', 'setGrant', {
    grant: `${scope}:${resourcePattern}:${action}`,
    scope,
    resourcePattern,
    actionName: action,
    roles: uniqueSorted(roles),
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
  const [permissionCatalog, roleDefinitions, schemaActionCatalog, nodeActionCatalog] = await Promise.all([
    getPermissionCatalog(kernel),
    getRoleCatalog(kernel),
    getResourceActionCatalog(kernel, 'schema'),
    getResourceActionCatalog(kernel, 'node'),
  ]);
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
  const schemaActionCatalog = await getResourceActionCatalog(kernel, 'schema');
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
          const explicit = await resolveGrantRoles(kernel, 'schema', schema, key);
          resolved[key] = explicit ?? defaultRolesForSchemaAction(key);
        }
        return { schema, actions: resolved };
      }),
  );
}

export async function getNodeAccessPolicies(kernel: Kernel) {
  const nodeActionCatalog = await getResourceActionCatalog(kernel, 'node');
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
          const exact = await getExactGrantRoles(kernel, 'node', node, key);
          if (exact) {
            actions[key] = exact;
            continue;
          }
          const schemaRoles = await resolveGrantRoles(kernel, 'schema', type, key);
          actions[key] = schemaRoles ?? defaultRolesForNodeAction(key);
        }
        return { node, type, actions };
      }),
  );
}

export async function setSchemaActionRoles(kernel: Kernel, schema: string, action: string, roles: string[]) {
  if (!(await hasResourceAction(kernel, 'schema', action))) {
    throw new Error(`Unknown schema action: ${action}`);
  }
  await writeGrantRoles(kernel, 'schema', schema, action, roles);
}

export async function setNodeActionRoles(kernel: Kernel, node: string, action: string, roles: string[]) {
  if (!(await hasResourceAction(kernel, 'node', action))) {
    throw new Error(`Unknown node action: ${action}`);
  }
  await writeGrantRoles(kernel, 'node', node, action, roles);
}

export async function canAccessSchema(
  kernel: Kernel,
  userRoles: string[],
  schema: string,
  action: string,
) {
  if (!(await hasResourceAction(kernel, 'schema', action))) {
    return false;
  }
  const explicit = await resolveGrantRoles(kernel, 'schema', schema, action);
  const allowedRoles = explicit ?? defaultRolesForSchemaAction(action);
  return userRoles.some((role) => allowedRoles.includes(role));
}

export async function canAccessNode(
  kernel: Kernel,
  userRoles: string[],
  node: string,
  schema: string,
  action: string,
) {
  if (!(await hasResourceAction(kernel, 'node', action))) {
    return false;
  }
  const exactNode = await getExactGrantRoles(kernel, 'node', node, action);
  const nodeAllowed = exactNode ?? null;
  const schemaAllowed = await resolveGrantRoles(kernel, 'schema', schema, action);
  const fallback = schemaAllowed ?? defaultRolesForNodeAction(action);
  const allowedRoles = nodeAllowed ?? fallback;
  return userRoles.some((role) => allowedRoles.includes(role));
}

