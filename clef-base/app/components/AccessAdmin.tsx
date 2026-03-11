'use client';

import React, { useState } from 'react';

interface Snapshot {
  users: Array<{
    user: string;
    provider: string;
    roles: string[];
    permissions: string[];
    sessionCount: number;
  }>;
  roles: Array<{
    role: string;
    permissions: string[];
  }>;
  schemas: Array<{
    schema: string;
    actions: Record<string, string[]>;
  }>;
  nodes: Array<{
    node: string;
    type: string;
    actions: Record<string, string[]>;
  }>;
  permissionCatalog: Array<{
    key: string;
    label: string;
    group: string;
    description: string;
  }>;
  schemaActionCatalog: Array<{ key: string; label: string }>;
  nodeActionCatalog: Array<{ key: string; label: string }>;
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(String(result.message ?? 'Request failed.'));
  }
  return result;
}

export function AccessAdmin({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const response = await fetch('/api/admin/access');
    const next = await response.json();
    setSnapshot(next);
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setMessage('');
    setError('');
    try {
      await action();
      await refresh();
      setMessage(successMessage);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Request failed.');
    }
  }

  return (
    <div className="access-admin">
      <div className="page-header">
        <h1>Access</h1>
      </div>
      <p className="access-copy">
        Manage users, roles, and permissions for the Clef Base admin console.
      </p>
      {message ? <p className="setup-success">{message}</p> : null}
      {error ? <p className="setup-error">{error}</p> : null}

      <section className="access-section">
        <div className="section__header">
          <h2 className="section__title">Users</h2>
        </div>
        <form
          className="access-toolbar"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const roles = form.getAll('roles').map((entry) => String(entry));
            await runAction(
              () =>
                postJson('/api/admin/access/users/create', {
                  user: String(form.get('user') ?? ''),
                  password: String(form.get('password') ?? ''),
                  provider: String(form.get('provider') ?? 'local'),
                  roles,
                }),
              'User saved.',
            );
            event.currentTarget.reset();
          }}
        >
          <input name="user" placeholder="username" required />
          <input name="password" type="password" placeholder="password" required />
          <input name="provider" placeholder="provider" defaultValue="local" />
          <select name="roles" multiple defaultValue={['viewer']}>
            {snapshot.roles.map((role) => (
              <option key={role.role} value={role.role}>
                {role.role}
              </option>
            ))}
          </select>
          <button type="submit">Create or reset user</button>
        </form>
        <div className="access-table">
          <div className="access-row access-row--head">
            <span>User</span>
            <span>Provider</span>
            <span>Roles</span>
            <span>Sessions</span>
            <span>Actions</span>
          </div>
          {snapshot.users.map((user) => (
            <div key={user.user} className="access-row">
              <span>{user.user}</span>
              <span>{user.provider}</span>
              <span className="token-list">
                {user.roles.map((role) => (
                  <button
                    key={`${user.user}-${role}`}
                    className="token-button"
                    type="button"
                    onClick={() =>
                      runAction(
                        () => postJson('/api/admin/access/users/revoke-role', { user: user.user, role }),
                        `Removed ${role} from ${user.user}.`,
                      )
                    }
                  >
                    {role} ×
                  </button>
                ))}
              </span>
              <span>{user.sessionCount}</span>
              <span className="inline-actions">
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    await runAction(
                      () =>
                        postJson('/api/admin/access/users/assign-role', {
                          user: user.user,
                          role: String(form.get('role') ?? ''),
                        }),
                      `Assigned role to ${user.user}.`,
                    );
                    event.currentTarget.reset();
                  }}
                >
                  <select name="role" defaultValue={snapshot.roles[0]?.role}>
                    {snapshot.roles.map((role) => (
                      <option key={`${user.user}-${role.role}`} value={role.role}>
                        {role.role}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Assign</button>
                </form>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    await runAction(
                      () =>
                        postJson('/api/admin/access/users/reset-password', {
                          user: user.user,
                          password: String(form.get('password') ?? ''),
                        }),
                      `Password updated for ${user.user}.`,
                    );
                    event.currentTarget.reset();
                  }}
                >
                  <input name="password" type="password" placeholder="new password" required />
                  <button type="submit">Reset password</button>
                </form>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="access-section">
        <div className="section__header">
          <h2 className="section__title">Permission matrix</h2>
        </div>
        <form
          className="access-toolbar access-toolbar--compact"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await runAction(
              () =>
                postJson('/api/admin/access/roles/create', {
                  role: String(form.get('role') ?? ''),
                }),
              'Role created.',
            );
            event.currentTarget.reset();
          }}
        >
          <input name="role" placeholder="new role id" required />
          <button type="submit">Create role</button>
        </form>
        <div className="access-table access-table--matrix">
          <div className="access-row access-row--head">
            <span>Permission</span>
            {snapshot.roles.map((role) => (
              <span key={role.role}>{role.role}</span>
            ))}
          </div>
          {snapshot.permissionCatalog.map((permission) => (
            <div key={permission.key} className="access-row">
              <span>
                <strong>{permission.label}</strong>
                <small>{permission.description}</small>
              </span>
              {snapshot.roles.map((role) => {
                const enabled = role.permissions.includes(permission.key);
                return (
                  <button
                    key={`${permission.key}-${role.role}`}
                    className={enabled ? 'matrix-enabled' : 'matrix-disabled'}
                    type="button"
                    onClick={() =>
                      runAction(
                        () =>
                          postJson(
                            enabled
                              ? '/api/admin/access/roles/revoke-permission'
                              : '/api/admin/access/roles/grant-permission',
                            { role: role.role, permission: permission.key },
                          ),
                        `${enabled ? 'Revoked' : 'Granted'} ${permission.label} for ${role.role}.`,
                      )
                    }
                  >
                    {enabled ? 'Allowed' : 'Denied'}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="access-section">
        <div className="section__header">
          <h2 className="section__title">Schema access</h2>
        </div>
        <p className="access-copy">
          Control which roles can view, create, edit, and delete content for each schema, plus
          schema-definition actions such as defining types, adding fields, extending schemas,
          attaching schemas, detaching schemas, and exporting schema definitions.
        </p>
        <div className="access-table access-table--resource">
          <div className="access-row access-row--head access-row--resource">
            <span>Schema</span>
            <span>Action</span>
            <span>Allowed roles</span>
          </div>
          {snapshot.schemas.flatMap((schemaPolicy) =>
            snapshot.schemaActionCatalog.map((action) => (
              <div key={`${schemaPolicy.schema}-${action.key}`} className="access-row access-row--resource">
                <span>{schemaPolicy.schema}</span>
                <span>{action.label}</span>
                <form
                  className="inline-actions"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    await runAction(
                      () =>
                        postJson('/api/admin/access/schemas', {
                          schema: schemaPolicy.schema,
                          action: action.key,
                          roles: form.getAll('roles').map((entry) => String(entry)),
                        }),
                      `Updated ${action.label} access for ${schemaPolicy.schema}.`,
                    );
                  }}
                >
                  <select
                    name="roles"
                    multiple
                    defaultValue={schemaPolicy.actions[action.key] ?? []}
                  >
                    {snapshot.roles.map((role) => (
                      <option key={`${schemaPolicy.schema}-${action.key}-${role.role}`} value={role.role}>
                        {role.role}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </div>
            )),
          )}
        </div>
      </section>

      <section className="access-section">
        <div className="section__header">
          <h2 className="section__title">Content overrides</h2>
        </div>
        <p className="access-copy">
          Override schema permissions for individual content items.
        </p>
        <div className="access-table access-table--resource">
          <div className="access-row access-row--head access-row--resource">
            <span>Node</span>
            <span>Action</span>
            <span>Allowed roles</span>
          </div>
          {snapshot.nodes.flatMap((nodePolicy) =>
            snapshot.nodeActionCatalog.map((action) => (
              <div key={`${nodePolicy.node}-${action.key}`} className="access-row access-row--resource">
                <span>
                  {nodePolicy.node}
                  <small>{nodePolicy.type}</small>
                </span>
                <span>{action.label}</span>
                <form
                  className="inline-actions"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    await runAction(
                      () =>
                        postJson('/api/admin/access/nodes', {
                          node: nodePolicy.node,
                          action: action.key,
                          roles: form.getAll('roles').map((entry) => String(entry)),
                        }),
                      `Updated ${action.label} override for ${nodePolicy.node}.`,
                    );
                  }}
                >
                  <select
                    name="roles"
                    multiple
                    defaultValue={nodePolicy.actions[action.key] ?? []}
                  >
                    {snapshot.roles.map((role) => (
                      <option key={`${nodePolicy.node}-${action.key}-${role.role}`} value={role.role}>
                        {role.role}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </div>
            )),
          )}
        </div>
      </section>
    </div>
  );
}
