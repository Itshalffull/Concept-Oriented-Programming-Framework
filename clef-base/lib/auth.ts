import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { ensureSeeded, getKernel } from './kernel';
import {
  ADMIN_PERMISSION,
  AUTH_COOKIE_NAME,
  buildAccessSnapshot,
  canAccessNode,
  canAccessSchema,
  createManagedUser,
  createManagedRole,
  readUserPermissions,
  readUserRoles,
  revokeManagedRole,
  setNodeActionRoles,
  setSchemaActionRoles,
} from './identity';

export interface AdminSession {
  sessionId: string;
  user: string;
  device: string;
  roles: string[];
  permissions: string[];
}

interface SessionCookiePayload {
  sessionId: string;
  user: string;
  device: string;
  roles: string[];
  permissions: string[];
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSessionCookieSecret() {
  return (
    process.env.CLEF_BASE_SESSION_SECRET?.trim() ||
    process.env.CLEF_BASE_ADMIN_PASSWORD?.trim() ||
    'clef-base-dev-session-secret'
  );
}

function signSessionPayload(encodedPayload: string) {
  return createHmac('sha256', getSessionCookieSecret()).update(encodedPayload).digest('base64url');
}

function parseSessionCookie(value: string | undefined): AdminSession | null {
  if (!value?.startsWith('v1.')) return null;

  const [, encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signSessionPayload(encodedPayload);
  const actual = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionCookiePayload;
    return {
      sessionId: String(payload.sessionId ?? ''),
      user: String(payload.user ?? ''),
      device: String(payload.device ?? 'browser'),
      roles: Array.isArray(payload.roles) ? payload.roles.map((role) => String(role)) : [],
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map((permission) => String(permission))
        : [],
    };
  } catch {
    return null;
  }
}

export function createSessionCookieValue(session: AdminSession) {
  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      sessionId: session.sessionId,
      user: session.user,
      device: session.device,
      roles: session.roles,
      permissions: session.permissions,
    } satisfies SessionCookiePayload),
  );
  return `v1.${encodedPayload}.${signSessionPayload(encodedPayload)}`;
}

export function getSessionIdFromCookie(value: string | undefined) {
  return parseSessionCookie(value)?.sessionId ?? value;
}

async function loadSession(sessionId: string | undefined): Promise<AdminSession | null> {
  if (!sessionId) return null;

  const cookieSession = parseSessionCookie(sessionId);
  if (cookieSession) {
    return cookieSession;
  }

  await ensureSeeded();
  const kernel = getKernel();
  const validation = await kernel.invokeConcept('urn:clef/Session', 'validate', {
    session: sessionId,
  });

  if (validation.variant !== 'ok' || validation.valid !== true) {
    return null;
  }

  const context = await kernel.invokeConcept('urn:clef/Session', 'getContext', {
    session: sessionId,
  });

  if (context.variant !== 'ok') {
    return null;
  }

  const user = String(context.userId);
  const [roles, permissions] = await Promise.all([readUserRoles(user), readUserPermissions(user)]);

  return {
    sessionId,
    user,
    device: String(context.device),
    roles,
    permissions,
  };
}

export async function getCurrentAdminSession() {
  const cookieStore = await cookies();
  return loadSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function requireAdminSession() {
  const session = await getCurrentAdminSession();
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    redirect('/?login=required');
  }
  return session;
}

export async function getAdminSessionFromRequest(request: NextRequest) {
  return loadSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export async function loginAsAdmin(options: {
  user: string;
  password: string;
  device: string;
}) {
  await ensureSeeded();
  const kernel = getKernel();
  const loginResult = await kernel.invokeConcept('urn:clef/Authentication', 'login', {
    user: options.user,
    credentials: options.password,
  });

  if (loginResult.variant !== 'ok') {
    return { ok: false as const, message: 'Invalid username or password.' };
  }

  const sessionResult = await kernel.invokeConcept('urn:clef/Session', 'create', {
    userId: options.user,
    device: options.device,
  });

  if (sessionResult.variant !== 'ok') {
    return { ok: false as const, message: 'Unable to create an authenticated session.' };
  }

  const [roles, permissions] = await Promise.all([
    readUserRoles(options.user),
    readUserPermissions(options.user),
  ]);
  return {
    ok: true as const,
    sessionId: String(sessionResult.session),
    roles,
    permissions,
    user: options.user,
    device: options.device,
  };
}

export async function logoutCurrentSession(sessionId: string | undefined) {
  if (!sessionId) return;
  await ensureSeeded();
  const kernel = getKernel();
  await kernel.invokeConcept('urn:clef/Session', 'destroy', {
    session: sessionId,
  });
}

export async function getAccessSnapshot() {
  await ensureSeeded();
  return buildAccessSnapshot(getKernel());
}

export async function createAccessUser(input: {
  user: string;
  password: string;
  provider?: string;
  roles?: string[];
}) {
  await ensureSeeded();
  return createManagedUser({ kernel: getKernel(), ...input });
}

export async function createAccessRole(role: string) {
  await ensureSeeded();
  await createManagedRole(role);
}

export async function assignAccessRole(user: string, role: string) {
  await ensureSeeded();
  await getKernel().invokeConcept('urn:clef/Authorization', 'assignRole', { user, role });
}

export async function revokeAccessRole(user: string, role: string) {
  await ensureSeeded();
  await revokeManagedRole(user, role);
}

export async function grantAccessPermission(role: string, permission: string) {
  await ensureSeeded();
  await getKernel().invokeConcept('urn:clef/Authorization', 'grantPermission', {
    role,
    permission,
  });
}

export async function revokeAccessPermission(role: string, permission: string) {
  await ensureSeeded();
  await getKernel().invokeConcept('urn:clef/Authorization', 'revokePermission', {
    role,
    permission,
  });
}

export async function resetAccessPassword(user: string, password: string) {
  await ensureSeeded();
  await getKernel().invokeConcept('urn:clef/Authentication', 'resetPassword', {
    user,
    newCredentials: password,
  });
}

export async function updateSchemaAccess(input: {
  schema: string;
  action: string;
  roles: string[];
}) {
  await ensureSeeded();
  await setSchemaActionRoles(getKernel(), input.schema, input.action, input.roles);
}

export async function updateNodeAccess(input: {
  node: string;
  action: string;
  roles: string[];
}) {
  await ensureSeeded();
  await setNodeActionRoles(getKernel(), input.node, input.action, input.roles);
}

export function getSchemaPermissionAction(action: string) {
  const schemaActionMap: Record<string, string> = {
    list: 'view',
    getAssociations: 'view',
    defineSchema: 'define-schema',
    addField: 'add-field',
    extendSchema: 'extend-schema',
    applyTo: 'apply-schema',
    removeFrom: 'remove-schema',
    export: 'export-schema',
  };
  return schemaActionMap[action];
}

export function getContentPermissionAction(action: string) {
  const nodeActionMap: Record<string, string> = {
    get: 'view',
    list: 'view',
    stats: 'view',
    create: 'create',
    update: 'edit',
    delete: 'delete',
    setMetadata: 'edit-metadata',
  };
  return nodeActionMap[action];
}

export async function canInvokeAdminConcept(
  session: AdminSession,
  concept: string,
  action: string,
  input: Record<string, unknown>,
) {
  if (concept === 'Schema') {
    const permissionAction = getSchemaPermissionAction(action);
    if (!permissionAction) {
      return session.permissions.includes(ADMIN_PERMISSION);
    }
    const schema =
      String(input.schema ?? input.type ?? '').trim() ||
      (action === 'list' ? 'ContentNode' : '');
    return canAccessSchema(getKernel(), session.roles, schema, permissionAction);
  }

  if (concept === 'ContentNode') {
    const contentStorage = getKernel();
    const permissionAction = getContentPermissionAction(action);
    if (!permissionAction) {
      return session.permissions.includes(ADMIN_PERMISSION);
    }

    if (action === 'create') {
      const schema = String(input.type ?? '').trim();
      return canAccessSchema(getKernel(), session.roles, schema, 'create');
    }

    if (action === 'list') {
      const schema = String(input.type ?? '').trim();
      if (schema) {
        return canAccessSchema(getKernel(), session.roles, schema, 'view');
      }
      return session.roles.some((role) => ['admin', 'editor', 'viewer'].includes(role));
    }

    if (action === 'stats') {
      return session.roles.some((role) => ['admin', 'editor', 'viewer'].includes(role));
    }

    const node = String(input.node ?? '').trim();
    const record = await contentStorage.invokeConcept('urn:clef/ContentNode', 'get', { node });
    const schema = record.variant === 'ok' ? String(record.type ?? '') : '';
    return canAccessNode(getKernel(), session.roles, node, schema, permissionAction);
  }

  return session.permissions.includes(ADMIN_PERMISSION);
}
