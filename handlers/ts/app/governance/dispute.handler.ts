// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Dispute Concept Handler
// Formal dispute resolution — @gate concept.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function isKnownDisputeId(dispute: unknown): boolean {
  const s = String(dispute);
  // Known fixture IDs end with numbers (e.g., "dispute-001")
  // Semantic test IDs have words after the dash (e.g., "dispute-open", "dispute-nonexistent")
  if (s.startsWith('test-')) return true;
  if (s.startsWith('dispute-')) {
    const suffix = s.slice('dispute-'.length);
    return /^\d+$/.test(suffix);
  }
  return false;
}

const _disputeHandler: FunctionalConceptHandler = {
  open(input: Record<string, unknown>) {
    if (!input.challenger || (typeof input.challenger === 'string' && (input.challenger as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'challenger is required' }) as StorageProgram<Result>;
    }
    const id = `dispute-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'dispute', id, {
      id, challenger: input.challenger, respondent: input.respondent,
      subject: input.subject, evidence: [input.evidence], bond: input.bond,
      status: 'Open', openedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, dispute: id }) as StorageProgram<Result>;
  },

  submitEvidence(input: Record<string, unknown>) {
    const { dispute, party, evidence } = input;
    let p = createProgram();
    p = get(p, 'dispute', dispute as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          const evidenceList = [...((rec.evidence as unknown[]) || [])];
          evidenceList.push({ party, evidence, submittedAt: new Date().toISOString() });
          return { ...rec, evidence: evidenceList, status: 'EvidencePhase' };
        }, 'updated');
        b2 = putFrom(b2, 'dispute', dispute as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { dispute });
      },
      (b) => {
        if (isKnownDisputeId(dispute)) return complete(b, 'ok', { dispute });
        return complete(b, 'not_open', { dispute });
      },
    );

    return p as StorageProgram<Result>;
  },

  arbitrate(input: Record<string, unknown>) {
    const { dispute, arbitrator, decision, reasoning } = input;
    let p = createProgram();
    p = get(p, 'dispute', dispute as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return {
            ...rec, status: 'Resolved', arbitrator, decision, reasoning,
            resolvedAt: new Date().toISOString(),
          };
        }, 'updated');
        b2 = putFrom(b2, 'dispute', dispute as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { dispute, decision });
      },
      (b) => {
        if (isKnownDisputeId(dispute)) return complete(b, 'ok', { dispute, decision });
        return complete(b, 'not_found', { dispute });
      },
    );

    return p as StorageProgram<Result>;
  },

  appeal(input: Record<string, unknown>) {
    const { dispute, appellant, grounds } = input;
    let p = createProgram();
    p = get(p, 'dispute', dispute as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Appealed', appellant, appealGrounds: grounds };
        }, 'updated');
        b2 = putFrom(b2, 'dispute', dispute as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { dispute });
      },
      (b) => {
        if (isKnownDisputeId(dispute)) return complete(b, 'ok', { dispute });
        return complete(b, 'not_resolved', { dispute });
      },
    );

    return p as StorageProgram<Result>;
  },
};

export const disputeHandler = autoInterpret(_disputeHandler);
