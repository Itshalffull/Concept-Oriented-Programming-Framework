// @clef-handler style=functional
// Organization Concept Implementation
// Define a governance domain with its foundational purpose, values,
// scope of authority, and constitutional layer configuration.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `org-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Organization' }) as StorageProgram<Result>;
  },

  establish(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'organization', id, {
      id, name: input.name, purpose: input.purpose, scope: input.scope,
      values: input.values, constitutionalRules: [],
      operationalLayer: 'standard', policyLayer: 'standard', constitutionalLayer: 'standard',
      status: 'Active', createdAt: new Date().toISOString(), amendedAt: null,
    });
    return complete(p, 'ok', { id, organization: id }) as StorageProgram<Result>;
  },

  amend(input: Record<string, unknown>) {
    const { organization, field, newValue } = input;
    let p = createProgram();
    p = get(p, 'organization', organization as string, 'record');

    return branch(p, 'record',
      (b) => {
        let b2 = put(b, 'organization', organization as string, { [field as string]: newValue, amendedAt: new Date().toISOString() });
        return complete(b2, 'ok', { organization, field });
      },
      (b) => complete(b, 'not_found', { organization }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const { organization, reason } = input;
    let p = createProgram();
    p = get(p, 'organization', organization as string, 'record');

    return branch(p, 'record',
      (b) => {
        let b2 = put(b, 'organization', organization as string, { status: 'Dissolved', dissolvedAt: new Date().toISOString(), reason });
        return complete(b2, 'ok', { organization });
      },
      (b) => complete(b, 'not_found', { organization }),
    ) as StorageProgram<Result>;
  },
};

export const organizationHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetOrganization(): void {
  idCounter = 0;
}
