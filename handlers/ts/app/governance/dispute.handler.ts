// @migrated dsl-constructs 2026-03-18
// Dispute Concept Handler
// Formal dispute resolution — @gate concept.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _disputeHandler: FunctionalConceptHandler = {
  open(input: Record<string, unknown>) {
    const id = `dispute-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'dispute', id, {
      id, challenger: input.challenger, respondent: input.respondent,
      subject: input.subject, evidence: [input.evidence], bond: input.bond,
      status: 'Open', openedAt: new Date().toISOString(),
    });
    return complete(p, 'opened', { dispute: id }) as StorageProgram<Result>;
  },

  submitEvidence(input: Record<string, unknown>) {
    const { dispute, party, evidence } = input;
    let p = createProgram();
    p = get(p, 'dispute', dispute as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          const evidenceList = [...(rec.evidence as unknown[])];
          evidenceList.push({ party, evidence, submittedAt: new Date().toISOString() });
          return { ...rec, evidence: evidenceList, status: 'EvidencePhase' };
        }, 'updated');
        b2 = put(b2, 'dispute', dispute as string, {});
        return complete(b2, 'evidence_added', { dispute });
      },
      (b) => complete(b, 'not_found', { dispute }),
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
        b2 = put(b2, 'dispute', dispute as string, {});
        return complete(b2, 'resolved', { dispute, decision });
      },
      (b) => complete(b, 'not_found', { dispute }),
    );

    return p as StorageProgram<Result>;
  },

  appeal(input: Record<string, unknown>) {
    const { dispute, appellant, grounds } = input;
    let p = createProgram();
    p = get(p, 'dispute', dispute as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => (bindings.record as Record<string, unknown>).status !== 'Resolved',
          (b2) => complete(b2, 'not_resolved', { dispute }),
          (b2) => {
            let b3 = mapBindings(b2, (bindings) => {
              const rec = bindings.record as Record<string, unknown>;
              return { ...rec, status: 'Appealed', appellant, appealGrounds: grounds };
            }, 'updated');
            b3 = put(b3, 'dispute', dispute as string, {});
            return complete(b3, 'appealed', { dispute });
          },
        );
      },
      (b) => complete(b, 'not_found', { dispute }),
    );

    return p as StorageProgram<Result>;
  },
};

export const disputeHandler = autoInterpret(_disputeHandler);
