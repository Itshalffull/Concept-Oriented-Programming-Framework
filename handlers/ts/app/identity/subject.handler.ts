// @clef-handler style=functional
// Subject Concept Implementation — Functional (StorageProgram) style
// Unifies all acting principals (human, agent, service) into a single
// identity surface. Source concepts project into Subject via syncs.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, find, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_KINDS = new Set(['human', 'agent', 'service']);
const VALID_STATUSES = new Set(['active', 'disabled', 'revoked']);

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toOptStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

const _subjectHandler: FunctionalConceptHandler = {
  /**
   * Mint a new Subject entry. Returns duplicate if the supplied subject ID
   * is already in use; returns invalid when kind or backingRef are absent or
   * kind is not one of the three accepted values.
   */
  register(input: Record<string, unknown>) {
    const kind = toStr(input.kind);
    const backingRef = toStr(input.backingRef);
    const ownerRef = toOptStr(input.ownerRef);

    if (!kind) {
      return complete(createProgram(), 'invalid', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'invalid', {
        message: `kind must be one of: human, agent, service. Got: ${kind}`,
      }) as StorageProgram<Result>;
    }
    if (!backingRef) {
      return complete(createProgram(), 'invalid', { message: 'backingRef is required' }) as StorageProgram<Result>;
    }

    const providedId = toStr(input.subject).trim();
    const subjectId = providedId !== ''
      ? providedId
      : `subject:${kind}:${backingRef.replace(/[^a-z0-9:_-]+/gi, '-')}`;

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'subject', subjectId, 'existing');

    return branch(p,
      (b) => b.existing != null,
      (dup) => complete(dup, 'duplicate', {
        message: `Subject already exists: ${subjectId}`,
      }) as StorageProgram<Result>,
      (ok) => {
        const b = put(ok, 'subject', subjectId, {
          subject: subjectId,
          kind,
          backingRef,
          status: 'active',
          ownerRef,
          createdAt: now,
          updatedAt: now,
        });
        return complete(b, 'ok', { subject: subjectId }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Idempotent create-or-return. Looks up an existing Subject by backingRef
   * first; if one exists it is returned unchanged. Otherwise a new Subject is
   * minted via the same logic as register.
   */
  unify(input: Record<string, unknown>) {
    const kind = toStr(input.kind);
    const backingRef = toStr(input.backingRef);
    const ownerRef = toOptStr(input.ownerRef);

    if (!kind) {
      return complete(createProgram(), 'invalid', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'invalid', {
        message: `kind must be one of: human, agent, service. Got: ${kind}`,
      }) as StorageProgram<Result>;
    }
    if (!backingRef) {
      return complete(createProgram(), 'invalid', { message: 'backingRef is required' }) as StorageProgram<Result>;
    }

    // Check if a Subject with this backingRef already exists
    let p = createProgram();
    p = find(p, 'subject', { backingRef }, 'existing');

    return branch(p,
      (b) => {
        const arr = (b.existing as Array<Record<string, unknown>> | undefined) ?? [];
        return arr.length > 0;
      },
      // Already exists — return the first match
      (found) => completeFrom(found, 'ok', (bindings) => {
        const arr = bindings.existing as Array<Record<string, unknown>>;
        const rec = arr[0];
        return { subject: rec.subject as string };
      }) as StorageProgram<Result>,
      // Does not exist — mint a new subject
      (notFound) => {
        const providedId = toStr(input.subject).trim();
        const subjectId = providedId !== ''
          ? providedId
          : `subject:${kind}:${backingRef.replace(/[^a-z0-9:_-]+/gi, '-')}`;

        const now = new Date().toISOString();

        const b = put(notFound, 'subject', subjectId, {
          subject: subjectId,
          kind,
          backingRef,
          status: 'active',
          ownerRef,
          createdAt: now,
          updatedAt: now,
        });
        return complete(b, 'ok', { subject: subjectId }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Transition the Subject's lifecycle status. Rejects empty values and
   * unknown status strings before touching storage.
   */
  updateStatus(input: Record<string, unknown>) {
    const id = toStr(input.id);
    const status = toStr(input.status);

    if (!status) {
      return complete(createProgram(), 'invalid', { message: 'status is required' }) as StorageProgram<Result>;
    }
    if (!VALID_STATUSES.has(status)) {
      return complete(createProgram(), 'invalid', {
        message: `status must be one of: active, disabled, revoked. Got: ${status}`,
      }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'subject', id, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No Subject found: ${id}`,
      }) as StorageProgram<Result>,
      (found) => {
        const b = putFrom(found, 'subject', id, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status, updatedAt: now };
        });
        return complete(b, 'ok', { subject: id, status }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Set or replace the ownerRef on an existing Subject.
   */
  updateOwner(input: Record<string, unknown>) {
    const id = toStr(input.id);
    const ownerRef = toStr(input.ownerRef);

    if (!ownerRef) {
      return complete(createProgram(), 'invalid', { message: 'ownerRef is required' }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'subject', id, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No Subject found: ${id}`,
      }) as StorageProgram<Result>,
      (found) => {
        const b = putFrom(found, 'subject', id, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, ownerRef, updatedAt: now };
        });
        return complete(b, 'ok', { subject: id, ownerRef }) as StorageProgram<Result>;
      },
    );
  },

  /**
   * Return the current identity record for a Subject.
   */
  get(input: Record<string, unknown>) {
    const subject = toStr(input.subject);

    let p = createProgram();
    p = spGet(p, 'subject', subject, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (nf) => complete(nf, 'notfound', {
        message: `No Subject found: ${subject}`,
      }) as StorageProgram<Result>,
      (found) => completeFrom(found, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          kind: (rec.kind as string) ?? '',
          backingRef: (rec.backingRef as string) ?? '',
          status: (rec.status as string) ?? 'active',
          ownerRef: (rec.ownerRef as string | null) ?? null,
        };
      }) as StorageProgram<Result>,
    );
  },

  /**
   * Return every Subject as a JSON array. Returns ok with "[]" when empty.
   */
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'subject', {}, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      subjects: JSON.stringify(
        (bindings.results as Array<Record<string, unknown>>) ?? [],
      ),
    })) as StorageProgram<Result>;
  },

  /**
   * Return all Subjects of a specific kind as a JSON array.
   */
  listByKind(input: Record<string, unknown>) {
    const kind = toStr(input.kind);

    if (!kind) {
      return complete(createProgram(), 'invalid', {
        message: 'kind is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'subject', { kind }, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      subjects: JSON.stringify(
        (bindings.results as Array<Record<string, unknown>>) ?? [],
      ),
    })) as StorageProgram<Result>;
  },
};

export const subjectHandler = autoInterpret(_subjectHandler);
