// @clef-handler style=functional
// ContentReconciler Concept Implementation
// Reverse-project live concept state back into authored content pages so
// editable admin surfaces stay in contractual sync with the runtime.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, mergeFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Deterministic registration id from (sourceKind, sourceId). */
function regId(sourceKind: string, sourceId: string): string {
  return `${sourceKind}:${sourceId}`;
}

const _contentReconcilerHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const sourceKind = toStr(input.sourceKind);
    const sourceId = toStr(input.sourceId);
    const targetConcept = toStr(input.targetConcept);
    const mapping = toStr(input.mapping);

    if (!sourceKind || sourceKind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceKind is required' }) as StorageProgram<Result>;
    }
    if (!sourceId || sourceId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceId is required' }) as StorageProgram<Result>;
    }
    if (!targetConcept || targetConcept.trim() === '') {
      return complete(createProgram(), 'error', { message: 'targetConcept is required' }) as StorageProgram<Result>;
    }

    // Validate mapping is parseable JSON if non-empty.
    if (mapping && mapping.trim() !== '') {
      try {
        JSON.parse(mapping);
      } catch {
        return complete(createProgram(), 'error', { message: 'mapping must be valid JSON' }) as StorageProgram<Result>;
      }
    }

    const registration = regId(sourceKind, sourceId);
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', registration, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: `A registration for (${sourceKind}, ${sourceId}) already exists` }),
      (b) => {
        let b2 = put(b, 'registration', registration, {
          registration,
          sourceKind,
          sourceId,
          targetConcept,
          mapping: mapping || '{}',
          status: 'registered',
          drift: 'registered',
          lastReconciledAt: '',
          lastPlan: '',
          metadata: '{}',
          createdAt: now,
        });
        return complete(b2, 'ok', { registration });
      },
    );
    return p as StorageProgram<Result>;
  },

  reconcile(input: Record<string, unknown>) {
    const sourceKind = toStr(input.sourceKind);
    const sourceId = toStr(input.sourceId);

    if (!sourceId || sourceId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceId is required' }) as StorageProgram<Result>;
    }
    if (!sourceKind || sourceKind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceKind is required' }) as StorageProgram<Result>;
    }

    const registration = regId(sourceKind, sourceId);
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', registration, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Reconciliation runtime dispatch happens via routing sync; the
        // handler records the outcome on the registration. Default the
        // applied/skipped counts to zero (no-op idempotent reconcile) and
        // leave the drift at "in-sync". The routing sync supplies real
        // counts on a subsequent update.
        let b2 = mergeFrom(b, 'registration', registration, () => ({
          status: 'reconciled',
          drift: 'in-sync',
          lastReconciledAt: now,
        }));
        return complete(b2, 'ok', { applied: 0, skipped: 0 });
      },
      (b) => complete(b, 'notfound', { message: `No registration found for (${sourceKind}, ${sourceId})` }),
    );
    return p as StorageProgram<Result>;
  },

  plan(input: Record<string, unknown>) {
    const sourceKind = toStr(input.sourceKind);
    const sourceId = toStr(input.sourceId);

    if (!sourceId || sourceId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceId is required' }) as StorageProgram<Result>;
    }

    const registration = regId(sourceKind, sourceId);
    const defaultPlan = JSON.stringify({ changes: [], note: 'no-op dry-run' });

    let p = createProgram();
    p = spGet(p, 'registration', registration, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mergeFrom(b, 'registration', registration, () => ({
          lastPlan: defaultPlan,
        }));
        return complete(b2, 'ok', { changes: defaultPlan });
      },
      (b) => complete(b, 'notfound', { message: `No registration found for (${sourceKind}, ${sourceId})` }),
    );
    return p as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const sourceKind = toStr(input.sourceKind);
    const sourceId = toStr(input.sourceId);

    if (!sourceId || sourceId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'sourceId is required' }) as StorageProgram<Result>;
    }

    const registration = regId(sourceKind, sourceId);

    let p = createProgram();
    p = spGet(p, 'registration', registration, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          lastReconciledAt: toStr(rec.lastReconciledAt) || '',
          drift: toStr(rec.drift) || 'registered',
        };
      }),
      (b) => complete(b, 'notfound', { message: `No registration found for (${sourceKind}, ${sourceId})` }),
    );
    return p as StorageProgram<Result>;
  },

  list() {
    let p = createProgram();
    p = find(p, 'registration', {}, 'allRegs');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allRegs as Array<Record<string, unknown>>) ?? [];
      return { registrations: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },
};

export const contentReconcilerHandler = autoInterpret(_contentReconcilerHandler);
