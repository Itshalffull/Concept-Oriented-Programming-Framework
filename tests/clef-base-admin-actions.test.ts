import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCookieStoreMock = vi.fn();
const navigateMock = vi.fn();
const loginAsAdminMock = vi.fn();
const logoutCurrentSessionMock = vi.fn();
const getCurrentAdminSessionMock = vi.fn();
const getAccessSnapshotMock = vi.fn();
const createAccessUserMock = vi.fn();
const createAccessRoleMock = vi.fn();
const assignAccessRoleMock = vi.fn();
const revokeAccessRoleMock = vi.fn();
const resetAccessPasswordMock = vi.fn();
const grantAccessPermissionMock = vi.fn();
const revokeAccessPermissionMock = vi.fn();
const updateSchemaAccessMock = vi.fn();
const updateNodeAccessMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  loginAsAdmin: loginAsAdminMock,
  logoutCurrentSession: logoutCurrentSessionMock,
  getCurrentAdminSession: getCurrentAdminSessionMock,
  getAccessSnapshot: getAccessSnapshotMock,
  createAccessUser: createAccessUserMock,
  createAccessRole: createAccessRoleMock,
  assignAccessRole: assignAccessRoleMock,
  revokeAccessRole: revokeAccessRoleMock,
  resetAccessPassword: resetAccessPasswordMock,
  grantAccessPermission: grantAccessPermissionMock,
  revokeAccessPermission: revokeAccessPermissionMock,
  updateSchemaAccess: updateSchemaAccessMock,
  updateNodeAccess: updateNodeAccessMock,
}));

vi.mock('@/lib/identity', () => ({
  ADMIN_PERMISSION: 'admin.access',
  AUTH_COOKIE_NAME: 'clef_base_session',
}));

vi.mock('../clef-base/app/server-runtime.js', () => ({
  getCookieStore: getCookieStoreMock,
  navigate: navigateMock,
}));

describe('clef-base admin actions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getCookieStoreMock.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    });
    getAccessSnapshotMock.mockResolvedValue({ users: [], roles: [] });
  });

  it('logs in through the auth action and writes the session cookie', async () => {
    const cookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    getCookieStoreMock.mockResolvedValue(cookieStore);
    loginAsAdminMock.mockResolvedValue({
      ok: true,
      sessionId: 'session-1',
      permissions: ['admin.access'],
    });

    const { loginAdminAction } = await import('../clef-base/app/admin/actions.js');
    const formData = new FormData();
    formData.set('user', 'admin');
    formData.set('password', 'secret');

    await loginAdminAction({ error: '', message: '' }, formData);

    expect(loginAsAdminMock).toHaveBeenCalledWith({
      user: 'admin',
      password: 'secret',
      device: 'browser',
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      'clef_base_session',
      'session-1',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/admin');
  });

  it('logs out through the server action and clears the cookie', async () => {
    const cookieStore = {
      get: vi.fn(() => ({ value: 'session-1' })),
      set: vi.fn(),
      delete: vi.fn(),
    };
    getCookieStoreMock.mockResolvedValue(cookieStore);

    const { logoutAdminAction } = await import('../clef-base/app/admin/actions.js');
    await logoutAdminAction();

    expect(logoutCurrentSessionMock).toHaveBeenCalledWith('session-1');
    expect(cookieStore.delete).toHaveBeenCalledWith('clef_base_session');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('runs access mutations through server actions and returns the refreshed snapshot', async () => {
    getCurrentAdminSessionMock.mockResolvedValue({
      user: 'admin',
      permissions: ['admin.access'],
    });
    getAccessSnapshotMock.mockResolvedValue({
      users: [{ user: 'alice' }],
      roles: [{ role: 'editor' }],
    });

    const { createAccessUserAction, updateSchemaAccessAction } = await import('../clef-base/app/admin/actions.js');

    const created = await createAccessUserAction({
      user: 'alice',
      password: 'pw',
      provider: 'local',
      roles: ['editor'],
    });
    expect(createAccessUserMock).toHaveBeenCalledWith({
      user: 'alice',
      password: 'pw',
      provider: 'local',
      roles: ['editor'],
    });
    expect(created).toEqual({
      users: [{ user: 'alice' }],
      roles: [{ role: 'editor' }],
    });

    await updateSchemaAccessAction({
      schema: 'Article',
      action: 'view',
      roles: ['admin', 'editor'],
    });
    expect(updateSchemaAccessMock).toHaveBeenCalledWith({
      schema: 'Article',
      action: 'view',
      roles: ['admin', 'editor'],
    });
  });
});
