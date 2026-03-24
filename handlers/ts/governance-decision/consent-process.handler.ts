// @clef-handler style=functional
// ConsentProcess Concept Implementation
// Determines whether a proposal proceeds based on the absence of reasoned objections
// (sociocratic consent-based decision making).
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `consent-${++idCounter}`;
}

const PHASE_SEQUENCE = ['Presenting', 'Clarifying', 'Reacting', 'ObjectionRound'];

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ConsentProcess' }) as StorageProgram<Result>;
  },

  initiate(input: Record<string, unknown>) {
    const proposalRef = input.proposalRef as string;

    if (!proposalRef || proposalRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'consent_process', id, {
      id,
      proposalRef,
      status: 'Presenting',
      objections: [],
      amendments: [],
    });
    return complete(p, 'ok', { process: id }) as StorageProgram<Result>;
  },

  advancePhase(input: Record<string, unknown>) {
    const processId = input.process as string;

    if (!processId) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'consent_process', processId, 'processRecord');

    return branch(
      p,
      (b) => !b.processRecord,
      complete(createProgram(), 'error', { message: 'Consent process not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.processRecord as Record<string, unknown>;
          const currentPhase = rec.status as string;
          const idx = PHASE_SEQUENCE.indexOf(currentPhase);
          if (idx < 0 || idx >= PHASE_SEQUENCE.length - 1) return currentPhase;
          return PHASE_SEQUENCE[idx + 1];
        }, '_nextPhase');

        b2 = putFrom(b2, 'consent_process', processId, (b) => {
          const rec = b.processRecord as Record<string, unknown>;
          return { ...rec, status: b._nextPhase };
        });

        return completeFrom(b2, 'ok', (b) => ({
          process: processId,
          newPhase: b._nextPhase,
        })) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  raiseObjection(input: Record<string, unknown>) {
    const processId = input.process as string;
    const objector = input.objector as string;
    const reason = input.reason as string;
    const isParamount = input.isParamount as boolean;

    if (!processId) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'consent_process', processId, 'processRecord');

    return branch(
      p,
      (b) => !b.processRecord,
      complete(createProgram(), 'error', { message: 'Consent process not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.processRecord as Record<string, unknown>;
          return rec.status !== 'ObjectionRound';
        }, '_wrongPhase');

        return branch(
          b2,
          (b) => !!b._wrongPhase,
          complete(createProgram(), 'ok', { process: processId }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'consent_process', processId, (b) => {
              const rec = b.processRecord as Record<string, unknown>;
              const objections = [...(rec.objections as unknown[])];
              objections.push({ objector, reason, isParamount, integrated: false });
              return { ...rec, objections };
            });
            return complete(b3, 'ok', { process: processId }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  integrateObjection(input: Record<string, unknown>) {
    const processId = input.process as string;
    const objectionIndex = input.objectionIndex as number;
    const amendment = input.amendment as string;

    if (!processId) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'consent_process', processId, 'processRecord');

    return branch(
      p,
      (b) => !b.processRecord,
      complete(createProgram(), 'error', { message: 'Consent process not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.processRecord as Record<string, unknown>;
          const objections = rec.objections as unknown[];
          return objectionIndex >= 0 && objectionIndex < objections.length;
        }, '_validIndex');

        return branch(
          b2,
          (b) => !b._validIndex,
          complete(createProgram(), 'error', { message: 'Objection index out of bounds' }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'consent_process', processId, (b) => {
              const rec = b.processRecord as Record<string, unknown>;
              const objections = [...(rec.objections as Record<string, unknown>[])];
              objections[objectionIndex] = { ...objections[objectionIndex], integrated: true };
              const amendments = [...(rec.amendments as string[]), amendment];
              return { ...rec, objections, amendments };
            });
            return complete(b3, 'ok', { process: processId }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const processId = input.process as string;

    if (!processId) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'consent_process', processId, 'processRecord');

    return branch(
      p,
      (b) => !b.processRecord,
      complete(createProgram(), 'error', { message: 'Consent process not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.processRecord as Record<string, unknown>;
          const objections = rec.objections as Array<{ isParamount: boolean; integrated: boolean }>;
          return objections.filter(o => !o.integrated).length;
        }, '_outstanding');

        return branch(
          b2,
          (b) => (b._outstanding as number) > 0,
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'consent_process', processId, (b) => {
              const rec = b.processRecord as Record<string, unknown>;
              return { ...rec, status: 'Blocked' };
            });
            return completeFrom(b3, 'ok', (b) => ({
              process: processId,
              outstandingObjections: b._outstanding,
            })) as StorageProgram<Result>;
          })(),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'consent_process', processId, (b) => {
              const rec = b.processRecord as Record<string, unknown>;
              return { ...rec, status: 'Consented' };
            });
            return complete(b3, 'ok', { process: processId }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const consentProcessHandler = autoInterpret(_handler);
