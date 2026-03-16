'use server';

import {
  assignAccessRole,
  createAccessRole,
  createAccessUser,
  getAccessSnapshot,
  getCurrentAdminSession,
  grantAccessPermission,
  loginAsAdmin,
  logoutCurrentSession,
  resetAccessPassword,
  revokeAccessPermission,
  revokeAccessRole,
  updateNodeAccess,
  updateSchemaAccess,
} from '@/lib/auth';
import { ADMIN_PERMISSION, AUTH_COOKIE_NAME } from '@/lib/identity';
import { getCookieStore, navigate } from '../server-runtime';

export interface LoginActionState {
  error: string;
  message: string;
}

async function requireAdminAccess() {
  const session = await getCurrentAdminSession();
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function loginAdminAction(
  _previous: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const user = String(formData.get('user') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await loginAsAdmin({
    user,
    password,
    device: 'browser',
  });

  if (!result.ok) {
    return { error: result.message, message: '' };
  }

  const cookieStore = await getCookieStore();
  cookieStore.set(AUTH_COOKIE_NAME, result.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  if (result.permissions.includes(ADMIN_PERMISSION)) {
    navigate('/admin');
    return { error: '', message: 'admin' };
  }

  return {
    error: '',
    message: 'Signed in. This deployment only exposes the admin console to users with admin access.',
  };
}

export async function logoutAdminAction() {
  const cookieStore = await getCookieStore();
  const sessionId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  await logoutCurrentSession(sessionId);
  cookieStore.delete(AUTH_COOKIE_NAME);
  navigate('/');
}

export async function readAccessSnapshotAction() {
  await requireAdminAccess();
  return getAccessSnapshot();
}

export async function createAccessUserAction(input: {
  user: string;
  password: string;
  provider?: string;
  roles?: string[];
}) {
  await requireAdminAccess();
  await createAccessUser(input);
  return getAccessSnapshot();
}

export async function createAccessRoleAction(input: { role: string }) {
  await requireAdminAccess();
  await createAccessRole(input.role);
  return getAccessSnapshot();
}

export async function assignAccessRoleAction(input: { user: string; role: string }) {
  await requireAdminAccess();
  await assignAccessRole(input.user, input.role);
  return getAccessSnapshot();
}

export async function revokeAccessRoleAction(input: { user: string; role: string }) {
  await requireAdminAccess();
  await revokeAccessRole(input.user, input.role);
  return getAccessSnapshot();
}

export async function resetAccessPasswordAction(input: { user: string; password: string }) {
  await requireAdminAccess();
  await resetAccessPassword(input.user, input.password);
  return getAccessSnapshot();
}

export async function grantAccessPermissionAction(input: { role: string; permission: string }) {
  await requireAdminAccess();
  await grantAccessPermission(input.role, input.permission);
  return getAccessSnapshot();
}

export async function revokeAccessPermissionAction(input: { role: string; permission: string }) {
  await requireAdminAccess();
  await revokeAccessPermission(input.role, input.permission);
  return getAccessSnapshot();
}

export async function updateSchemaAccessAction(input: {
  schema: string;
  action: string;
  roles: string[];
}) {
  await requireAdminAccess();
  await updateSchemaAccess(input);
  return getAccessSnapshot();
}

export async function updateNodeAccessAction(input: {
  node: string;
  action: string;
  roles: string[];
}) {
  await requireAdminAccess();
  await updateNodeAccess(input);
  return getAccessSnapshot();
}
