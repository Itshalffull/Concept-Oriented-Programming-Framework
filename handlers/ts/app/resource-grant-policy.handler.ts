import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function grantKey(scope: string, resourcePattern: string, actionName: string) {
  return `${scope}:${resourcePattern}:${actionName}`;
}

async function listGrantRecords(storage: ConceptStorage, scope?: string) {
  if (scope) {
    return storage.find('grant', { scope });
  }
  return storage.find('grant', {});
}

function toGrantResult(record: Record<string, unknown>) {
  const roles = Array.isArray(record.roles)
    ? record.roles.map((role) => String(role))
    : JSON.parse(String(record.roles ?? '[]')) as string[];

  return {
    grant: String(record.id ?? ''),
    scope: String(record.scope ?? ''),
    resourcePattern: String(record.resourcePattern ?? ''),
    actionName: String(record.actionName ?? ''),
    roles,
  };
}

function normalizeRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((role) => String(role));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((role) => String(role)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const resourceGrantPolicyHandler: ConceptHandler = {
  async setGrant(input: Record<string, unknown>, storage: ConceptStorage) {
    const grant = String(input.grant ?? '');
    const scope = String(input.scope ?? '');
    const resourcePattern = String(input.resourcePattern ?? '');
    const actionName = String(input.actionName ?? '');
    const roles = normalizeRoles(input.roles);

    const key = grant || grantKey(scope, resourcePattern, actionName);
    await storage.put('grant', key, {
      id: key,
      scope,
      resourcePattern,
      actionName,
      roles: JSON.stringify(roles),
    });

    return { variant: 'ok', grant: key };
  },

  async getGrant(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope = String(input.scope ?? '');
    const resourcePattern = String(input.resourcePattern ?? '');
    const actionName = String(input.actionName ?? '');
    const key = grantKey(scope, resourcePattern, actionName);
    const record = await storage.get('grant', key);
    if (!record) {
      return {
        variant: 'notfound',
        message: `No grant for ${scope}:${resourcePattern}:${actionName}`,
      };
    }

    return { variant: 'ok', ...toGrantResult(record) };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope = String(input.scope ?? '');
    const resource = String(input.resource ?? '');
    const actionName = String(input.actionName ?? '');
    const exact = await storage.get('grant', grantKey(scope, resource, actionName));
    if (exact) {
      return {
        variant: 'ok',
        ...toGrantResult(exact),
        matchedPattern: resource,
      };
    }

    const wildcard = await storage.get('grant', grantKey(scope, '*', actionName));
    if (wildcard) {
      return {
        variant: 'ok',
        ...toGrantResult(wildcard),
        matchedPattern: '*',
      };
    }

    return {
      variant: 'notfound',
      message: `No grant matches ${scope}:${resource}:${actionName}`,
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope = typeof input.scope === 'string' && input.scope.trim() ? String(input.scope) : undefined;
    const grants = await listGrantRecords(storage, scope);
    return {
      variant: 'ok',
      grants: grants.map((record) => toGrantResult(record)),
    };
  },
};

export default resourceGrantPolicyHandler;
