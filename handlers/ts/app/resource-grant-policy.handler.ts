// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function grantKey(scope: string, resourcePattern: string, actionName: string) {
  return `${scope}:${resourcePattern}:${actionName}`;
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

const _resourceGrantPolicyHandler: FunctionalConceptHandler = {
  setGrant(input: Record<string, unknown>) {
    if (!input.grant || (typeof input.grant === 'string' && (input.grant as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'grant is required' }) as StorageProgram<Result>;
    }
    const grant = String(input.grant ?? '');
    const scope = String(input.scope ?? '');
    const resourcePattern = String(input.resourcePattern ?? '');
    const actionName = String(input.actionName ?? '');
    const roles = normalizeRoles(input.roles);

    // Always use the computed key so resolve() can find it
    const key = grantKey(scope, resourcePattern, actionName);

    let p = createProgram();
    p = put(p, 'grant', key, {
      id: key,
      grant: grant || key,
      scope,
      resourcePattern,
      actionName,
      roles: JSON.stringify(roles),
    });

    return complete(p, 'ok', { grant: key }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getGrant(input: Record<string, unknown>) {
    const scope = String(input.scope ?? '');
    const resourcePattern = String(input.resourcePattern ?? '');
    const actionName = String(input.actionName ?? '');
    const key = grantKey(scope, resourcePattern, actionName);

    let p = createProgram();
    p = spGet(p, 'grant', key, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', { grant: key, scope, resourcePattern, actionName, roles: [] }),
      (b) => complete(b, 'notfound', { message: `No grant for ${scope}:${resourcePattern}:${actionName}` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const scope = String(input.scope ?? '');
    const resource = String(input.resource ?? '');
    const actionName = String(input.actionName ?? '');

    let p = createProgram();
    p = spGet(p, 'grant', grantKey(scope, resource, actionName), 'exact');
    p = branch(p, 'exact',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const exact = bindings.exact as Record<string, unknown>;
        return { grant: grantKey(scope, resource, actionName), matchedPattern: resource, roles: normalizeRoles(exact.roles) };
      }),
      (b) => {
        let b2 = spGet(b, 'grant', grantKey(scope, '*', actionName), 'wildcard');
        b2 = branch(b2, 'wildcard',
          (c) => completeFrom(c, 'ok', (bindings) => {
            const wildcard = bindings.wildcard as Record<string, unknown>;
            return { grant: grantKey(scope, '*', actionName), matchedPattern: '*', roles: normalizeRoles(wildcard.roles) };
          }),
          (c) => complete(c, 'notfound', { message: `No grant matches ${scope}:${resource}:${actionName}` }),
        );
        return b2;
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(input: Record<string, unknown>) {
    const scope = typeof input.scope === 'string' && input.scope.trim() ? String(input.scope) : undefined;

    let p = createProgram();
    p = scope
      ? find(p, 'grant', { scope }, 'grants')
      : find(p, 'grant', {}, 'grants');

    return complete(p, 'ok', { grants: [] }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const resourceGrantPolicyHandler = autoInterpret(_resourceGrantPolicyHandler);


export default resourceGrantPolicyHandler;
