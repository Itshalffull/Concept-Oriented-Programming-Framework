import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { authorizationHandler as repertoireAuthorizationHandler } from '../../../handlers/ts/app/authorization.handler';

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

export const authorizationHandler: ConceptHandler = {
  ...repertoireAuthorizationHandler,

  async grantRole(input: Record<string, unknown>, storage: ConceptStorage) {
    return repertoireAuthorizationHandler.assignRole(input, storage);
  },

  async revokeRole(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const role = input.role as string;
    const record = await storage.get('userRole', user);
    if (!record) {
      return { variant: 'notfound' };
    }

    const roles = parseJsonArray(record.roles).filter((entry) => entry !== role);
    await storage.put('userRole', user, { user, roles: JSON.stringify(roles) });
    return { variant: 'ok' };
  },

  async listRoles(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const record = await storage.get('userRole', user);
    return { variant: 'ok', roles: JSON.stringify(record ? parseJsonArray(record.roles) : []) };
  },
};
