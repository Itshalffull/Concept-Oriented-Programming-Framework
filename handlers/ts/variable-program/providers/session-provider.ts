/**
 * SessionVariableProvider — resolves $session.<field> expressions.
 *
 * Reads the current user's session object from context.session. The session
 * carries identity information (userId, displayName, email, roles) that is
 * set by the authentication layer before variable resolution runs.
 *
 * Registered under PluginRegistry key "variable-source:session".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

/** Fixed fields available on every session object. */
const SESSION_FIELDS: PropertySpec[] = [
  { name: 'userId',      type: 'string',   isRelation: true,  description: 'Authenticated user identifier' },
  { name: 'displayName', type: 'string',   isRelation: false, description: 'User display name' },
  { name: 'email',       type: 'string',   isRelation: false, description: 'User email address' },
  { name: 'roles',       type: 'string[]', isRelation: false, description: 'List of role names granted to this user' },
];

export const sessionProvider: VariableSourceProvider = {
  kind: 'session',
  prefix: '$session',
  argSpec: [] as ArgSpec[],
  resolvedType: 'Session',

  async resolve(
    _args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    return context.session ?? null;
  },

  async listProperties(
    _args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    return SESSION_FIELDS;
  },
};
