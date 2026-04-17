// @clef-handler style=functional
// AgentRegistration Concept Implementation
// Register and manage agent principals as durable acting identities — the
// source-of-truth principal record for an agent, distinct from authored
// persona content and runtime AgentSession state.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Coerce an `option String` input (string or null/undefined/empty) to either
 * a non-empty string or `null`. The parser serialises `none` as missing/null
 * and Clef conventionally stores "not set" as null in the persisted row.
 */
function toOptStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

const _agentRegistrationHandler: FunctionalConceptHandler = {
  /**
   * Create a durable agent principal owned by the given subject. Status starts
   * at "active". Optional personaRef points at a persona page that shapes
   * runtime behavior.
   */
  register(input: Record<string, unknown>) {
    const displayName = toStr(input.displayName);
    const ownerSubject = toStr(input.ownerSubject);
    const agentClass = toStr(input.agentClass);
    const metadata = toStr(input.metadata) || '{}';
    const personaRef = toOptStr(input.personaRef);

    // Guard: required-field validation matches the register/requires clauses
    // in the concept spec (displayName, ownerSubject, agentClass all non-empty).
    if (!displayName || displayName.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'displayName is required' }) as StorageProgram<Result>;
    }
    if (!ownerSubject || ownerSubject.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'ownerSubject is required' }) as StorageProgram<Result>;
    }
    if (!agentClass || agentClass.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'agentClass is required' }) as StorageProgram<Result>;
    }

    // Validate metadata is parseable JSON so downstream consumers never fail
    // on a stored malformed blob.
    try {
      JSON.parse(metadata);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'metadata must be valid JSON' }) as StorageProgram<Result>;
    }

    // agent is `option A` — when omitted, synthesise a deterministic-looking
    // id from the displayName + timestamp. When provided, use it verbatim.
    const providedAgent = toStr(input.agent).trim();
    const agent = providedAgent !== ''
      ? providedAgent
      : `agent:${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${Date.now()}`;

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', agent, 'existing');

    return branch(p,
      (b) => b.existing != null,
      (dup) => complete(dup, 'duplicate', {
        message: `Agent registration already exists: ${agent}`,
      }) as StorageProgram<Result>,
      (ok) => {
        let b = put(ok, 'registration', agent, {
          agent,
          displayName,
          status: 'active',
          personaRef,
          ownerSubject,
          agentClass,
          metadata,
          createdAt: now,
          updatedAt: now,
        });
        return complete(b, 'ok', { agent }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Update the persona reference on an existing registration. Pass an empty
   * or null personaRef to clear the binding.
   */
  setPersona(input: Record<string, unknown>) {
    const agent = toStr(input.agent);
    const personaRefRaw = input.personaRef;
    // Distinguish "intentionally cleared" (null / missing) from "empty string"
    // (invalid). The concept spec marks empty-string personaRef as invalid.
    const personaRefIsCleared = personaRefRaw === null || personaRefRaw === undefined;
    const personaRefStr = typeof personaRefRaw === 'string' ? personaRefRaw : '';

    if (!personaRefIsCleared && personaRefStr === '') {
      return complete(createProgram(), 'invalid', {
        message: 'personaRef cannot be an empty string; pass none to clear',
      }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();
    const nextPersonaRef: string | null = personaRefIsCleared ? null : personaRefStr;

    let p = createProgram();
    p = spGet(p, 'registration', agent, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No agent registration found: ${agent}`,
      }) as StorageProgram<Result>,
      (found) => {
        let b = putFrom(found, 'registration', agent, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, personaRef: nextPersonaRef, updatedAt: now };
        });
        return completeFrom(b, 'ok', () => ({
          agent,
          personaRef: nextPersonaRef,
        })) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Mark the registration disabled. Inspectable but not usable for new
   * session spawns.
   */
  disable(input: Record<string, unknown>) {
    const agent = toStr(input.agent);
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', agent, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No agent registration found: ${agent}`,
      }) as StorageProgram<Result>,
      (found) => {
        let b = putFrom(found, 'registration', agent, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'disabled', updatedAt: now };
        });
        return complete(b, 'ok', { agent }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Mark the registration revoked. History is preserved but the agent is
   * no longer valid for delegated execution.
   */
  revoke(input: Record<string, unknown>) {
    const agent = toStr(input.agent);
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', agent, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No agent registration found: ${agent}`,
      }) as StorageProgram<Result>,
      (found) => {
        let b = putFrom(found, 'registration', agent, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'revoked', updatedAt: now };
        });
        return complete(b, 'ok', { agent }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Return the full principal record for an agent: ownership, status,
   * persona binding, class, and opaque metadata.
   */
  get(input: Record<string, unknown>) {
    const agent = toStr(input.agent);

    let p = createProgram();
    p = spGet(p, 'registration', agent, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No agent registration found: ${agent}`,
      }) as StorageProgram<Result>,
      (found) => completeFrom(found, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          displayName: (rec.displayName as string) ?? '',
          status: (rec.status as string) ?? 'active',
          personaRef: (rec.personaRef as string | null) ?? null,
          ownerSubject: (rec.ownerSubject as string) ?? '',
          agentClass: (rec.agentClass as string) ?? '',
          metadata: (rec.metadata as string) ?? '{}',
        };
      }) as StorageProgram<Result>,
    );
  },

  /**
   * Return all registrations owned by a given subject as a JSON array.
   * Returns notfound when the owner has zero registrations.
   */
  listByOwner(input: Record<string, unknown>) {
    const ownerSubject = toStr(input.ownerSubject);

    if (!ownerSubject || ownerSubject.trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'ownerSubject is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'registration', { ownerSubject }, 'results');

    return branch(p,
      (b) => {
        const arr = (b.results as Array<Record<string, unknown>> | undefined) ?? [];
        return arr.length === 0;
      },
      (nf) => complete(nf, 'notfound', {
        message: `No agent registrations owned by ${ownerSubject}`,
      }) as StorageProgram<Result>,
      (ok) => completeFrom(ok, 'ok', (bindings) => ({
        registrations: JSON.stringify(
          (bindings.results as Array<Record<string, unknown>>) ?? [],
        ),
      })) as StorageProgram<Result>,
    );
  },

  /**
   * Inventory every agent principal record as a JSON array, regardless of
   * owner or status. Returns ok with "[]" when empty. Used by admin surfaces
   * that need a global view of registered agent identities.
   */
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'registration', {}, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      registrations: JSON.stringify(
        (bindings.results as Array<Record<string, unknown>>) ?? [],
      ),
    })) as StorageProgram<Result>;
  },

  /**
   * Transfer the agent principal to a new owning subject. Empty owner is
   * rejected as invalid.
   */
  setOwner(input: Record<string, unknown>) {
    const agent = toStr(input.agent);
    const owner = toStr(input.owner);

    if (!owner || owner.trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'owner is required',
      }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', agent, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No agent registration found: ${agent}`,
      }) as StorageProgram<Result>,
      (found) => {
        let b = putFrom(found, 'registration', agent, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, ownerSubject: owner, updatedAt: now };
        });
        return complete(b, 'ok', { agent, owner }) as StorageProgram<Result>;
      },
    );
  },
};

export const agentRegistrationHandler = autoInterpret(_agentRegistrationHandler);
