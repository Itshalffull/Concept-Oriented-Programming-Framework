// @migrated dsl-constructs 2026-03-18
// ConsentProcess Counting Method Provider
// Sociocratic consent: Present -> Clarify -> React -> Object -> Integrate -> Consent state machine.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const PHASES = ['Presenting', 'Clarifying', 'Reacting', 'Objecting', 'Integrating', 'Consented'] as const;
type Phase = typeof PHASES[number];

function nextPhase(current: Phase): Phase | null {
  const idx = PHASES.indexOf(current);
  return idx < PHASES.length - 1 ? PHASES[idx + 1] : null;
}

type Result = { variant: string; [key: string]: unknown };

const _consentProcessHandler: FunctionalConceptHandler = {
  openRound(input: Record<string, unknown>) {
    const id = `consent-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'consent', id, {
      id,
      proposal: input.proposal,
      facilitator: input.facilitator,
      phase: 'Presenting' as Phase,
      objections: '[]',
      reactions: '[]',
      amendments: '[]',
    });

    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'ConsentProcess',
      instanceId: id,
    });

    return complete(p, 'opened', { round: id }) as StorageProgram<Result>;
  },

  advancePhase(input: Record<string, unknown>) {
    const { round } = input;
    let p = createProgram();
    p = get(p, 'consent', round as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'advanced', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const currentPhase = record.phase as Phase;

          // Cannot advance past Objecting if unresolved objections exist
          if (currentPhase === 'Objecting') {
            const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
            const unresolved = objections.filter(o => !o.resolved);
            if (unresolved.length > 0) {
              return { variant: 'unresolved_objections', round, count: unresolved.length };
            }
          }

          const next = nextPhase(currentPhase);
          if (!next) return { variant: 'already_final', round, phase: currentPhase };

          return { variant: 'advanced', round, phase: next };
        });
      },
      (elseP) => complete(elseP, 'not_found', { round }),
    ) as StorageProgram<Result>;
  },

  raiseObjection(input: Record<string, unknown>) {
    const { round, raiser, objection } = input;
    let p = createProgram();
    p = get(p, 'consent', round as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'objection_raised', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const phase = record.phase as Phase;
          if (phase !== 'Objecting' && phase !== 'Reacting') {
            return { variant: 'wrong_phase', round, phase };
          }

          const objId = `obj-${Date.now()}`;
          return { variant: 'objection_raised', round, objectionId: objId };
        });
      },
      (elseP) => complete(elseP, 'not_found', { round }),
    ) as StorageProgram<Result>;
  },

  resolveObjection(input: Record<string, unknown>) {
    const { round, objection, resolution } = input;
    let p = createProgram();
    p = get(p, 'consent', round as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'objection_resolved', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ id: string; resolved: boolean; resolution?: string }>;
          const target = objections.find(o => o.id === objection);
          if (!target) return { variant: 'objection_not_found', round, objection };

          return { variant: 'objection_resolved', round };
        });
      },
      (elseP) => complete(elseP, 'not_found', { round }),
    ) as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const { round } = input;
    let p = createProgram();
    p = get(p, 'consent', round as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'consented', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
          const unresolved = objections.filter(o => !o.resolved);
          if (unresolved.length > 0) {
            return { variant: 'unresolved_objections', round, count: unresolved.length };
          }

          return { variant: 'consented', round, amendments: record.amendments };
        });
      },
      (elseP) => complete(elseP, 'not_found', { round }),
    ) as StorageProgram<Result>;
  },
};

export const consentProcessHandler = autoInterpret(_consentProcessHandler);
