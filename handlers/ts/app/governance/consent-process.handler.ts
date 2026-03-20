// @clef-handler style=functional
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
        // Compute next phase or error condition
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const currentPhase = record.phase as Phase;

          if (currentPhase === 'Objecting') {
            const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
            const unresolved = objections.filter(o => !o.resolved);
            if (unresolved.length > 0) {
              return { status: 'blocked', count: unresolved.length };
            }
          }

          const next = nextPhase(currentPhase);
          if (!next) return { status: 'final', phase: currentPhase };
          return { status: 'ok', phase: next };
        }, 'advance');

        // Write updated phase if advancing
        thenP = putFrom(thenP, 'consent', round as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const advance = bindings.advance as { status: string; phase?: string };
          if (advance.status === 'ok') {
            return { ...record, phase: advance.phase };
          }
          return record;
        });

        return completeFrom(thenP, 'advance_result', (bindings) => {
          const advance = bindings.advance as { status: string; phase?: string; count?: number };
          if (advance.status === 'blocked') {
            return { variant: 'unresolved_objections', round, count: advance.count };
          }
          if (advance.status === 'final') {
            return { variant: 'already_final', round, phase: advance.phase };
          }
          return { variant: 'advanced', round, phase: advance.phase };
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
        // Check phase validity
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const phase = record.phase as Phase;
          return (phase === 'Objecting' || phase === 'Reacting');
        }, 'validPhase');

        return branch(thenP, 'validPhase',
          (validP) => {
            const objId = `obj-${Date.now()}`;
            validP = putFrom(validP, 'consent', round as string, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const objections = JSON.parse(record.objections as string) as unknown[];
              objections.push({ id: objId, raiser, text: objection, resolved: false });
              return {
                ...record,
                phase: 'Objecting',
                objections: JSON.stringify(objections),
              };
            });
            return complete(validP, 'objection_raised', { round, objectionId: objId });
          },
          (invalidP) => {
            return completeFrom(invalidP, 'wrong_phase', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { variant: 'wrong_phase', round, phase: record.phase };
            });
          },
        );
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
        // Check if objection exists
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ id: string }>;
          return objections.some(o => o.id === objection);
        }, 'objFound');

        return branch(thenP, 'objFound',
          (foundP) => {
            foundP = putFrom(foundP, 'consent', round as string, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const objections = JSON.parse(record.objections as string) as Array<{ id: string; resolved: boolean; resolution?: string }>;
              const target = objections.find(o => o.id === objection)!;
              target.resolved = true;
              target.resolution = resolution as string;

              const amendments = JSON.parse(record.amendments as string) as unknown[];
              amendments.push({ objectionId: objection, resolution, appliedAt: new Date().toISOString() });

              return {
                ...record,
                objections: JSON.stringify(objections),
                amendments: JSON.stringify(amendments),
              };
            });
            return complete(foundP, 'objection_resolved', { round });
          },
          (notFoundP) => complete(notFoundP, 'objection_not_found', { round, objection }),
        );
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
        // Check for unresolved objections
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
          const unresolved = objections.filter(o => !o.resolved);
          return unresolved.length;
        }, 'unresolvedCount');

        return branch(thenP,
          (bindings) => (bindings.unresolvedCount as number) === 0,
          (okP) => {
            okP = putFrom(okP, 'consent', round as string, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, phase: 'Consented' };
            });
            return completeFrom(okP, 'consented', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { variant: 'consented', round, amendments: record.amendments };
            });
          },
          (blockedP) => {
            return completeFrom(blockedP, 'unresolved_objections', (bindings) => {
              return { variant: 'unresolved_objections', round, count: bindings.unresolvedCount };
            });
          },
        );
      },
      (elseP) => complete(elseP, 'not_found', { round }),
    ) as StorageProgram<Result>;
  },
};

export const consentProcessHandler = autoInterpret(_consentProcessHandler);
