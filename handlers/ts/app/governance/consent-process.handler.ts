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

function resolveId(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val.trim() || undefined;
  if (typeof val === 'object') return String((val as Record<string, unknown>).id ?? '') || undefined;
  return String(val) || undefined;
}

let roundCounter = 0;
let objectionCounter = 0;

const _consentProcessHandler: FunctionalConceptHandler = {
  openRound(input: Record<string, unknown>) {
    const proposal = input.proposal as string;
    const facilitator = input.facilitator as string;
    const id = `consent-round-${++roundCounter}`;
    let p = createProgram();
    p = put(p, 'consent', id, {
      id,
      proposalRef: proposal,
      facilitator,
      phase: 'Presenting' as Phase,
      objections: '[]',
      reactions: '[]',
      amendments: '[]',
    });
    return complete(p, 'opened', { round: id }) as StorageProgram<Result>;
  },

  initiate(input: Record<string, unknown>) {
    const proposalRef = input.proposalRef as string | undefined;
    if (!proposalRef || proposalRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }
    const id = `consent-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'consent', id, {
      id,
      proposalRef,
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

    return complete(p, 'ok', { id, process: id }) as StorageProgram<Result>;
  },

  advancePhase(input: Record<string, unknown>) {
    const processId = resolveId(input.process) ?? resolveId(input.round);
    if (!processId) {
      return complete(createProgram(), 'error', { message: 'process or round is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'consent', processId, 'record');

    return branch(p, 'record',
      (thenP) => {
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

        thenP = putFrom(thenP, 'consent', processId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const advance = bindings.advance as { status: string; phase?: string };
          if (advance.status === 'ok') {
            return { ...record, phase: advance.phase };
          }
          return record;
        });

        return completeFrom(thenP, '_dynamic', (bindings) => {
          const advance = bindings.advance as { status: string; phase?: string; count?: number };
          if (advance.status === 'blocked') {
            return { variant: 'unresolved_objections', process: processId, count: advance.count };
          }
          if (advance.status === 'final') {
            return { variant: 'already_final', process: processId, phase: advance.phase };
          }
          return { variant: 'advanced', process: processId, phase: advance.phase };
        });
      },
      (elseP) => complete(elseP, 'not_found', { process: processId }),
    ) as StorageProgram<Result>;
  },

  raiseObjection(input: Record<string, unknown>) {
    const processId = resolveId(input.process) ?? resolveId(input.round);
    const objector = input.objector ?? input.raiser;
    const reason = input.reason ?? input.objection;
    const isParamount = input.isParamount;
    if (!processId) {
      return complete(createProgram(), 'not_found', { process: processId }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'consent', processId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const phase = record.phase as Phase;
          return (phase === 'Objecting' || phase === 'Reacting' || phase === 'Presenting');
        }, 'validPhase');

        return branch(thenP, 'validPhase',
          (validP) => {
            const objId = `obj-${Date.now()}`;
            validP = putFrom(validP, 'consent', processId, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const objections = JSON.parse(record.objections as string) as unknown[];
              const paramount = isParamount === 'true' || isParamount === true;
              objections.push({ id: objId, objector, reason, isParamount: paramount, resolved: false });
              return {
                ...record,
                phase: 'Objecting',
                objections: JSON.stringify(objections),
              };
            });
            return complete(validP, 'objection_raised', { process: processId, objectionId: objId });
          },
          (invalidP) => {
            return completeFrom(invalidP, 'wrong_phase', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { variant: 'wrong_phase', process: processId, phase: record.phase };
            });
          },
        );
      },
      (elseP) => complete(elseP, 'not_found', { process: processId }),
    ) as StorageProgram<Result>;
  },

  integrateObjection(input: Record<string, unknown>) {
    const processId = resolveId(input.process);
    const { objectionIndex, amendment } = input;
    if (!processId) {
      return complete(createProgram(), 'not_found', { process: processId }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'consent', processId, 'record');

    return branch(p, 'record',
      (thenP) => {
        const idx = typeof objectionIndex === 'number' ? objectionIndex : parseInt(objectionIndex as string, 10);

        // Integrate the objection — if index is within bounds, mark resolved; otherwise add amendment
        thenP = putFrom(thenP, 'consent', processId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean; amendment?: string }>;
          if (!isNaN(idx) && idx >= 0 && idx < objections.length) {
            objections[idx].resolved = true;
            objections[idx].amendment = amendment as string;
          }
          const amendments = JSON.parse(record.amendments as string) as unknown[];
          amendments.push({ objectionIndex: idx, amendment, appliedAt: new Date().toISOString() });
          return {
            ...record,
            objections: JSON.stringify(objections),
            amendments: JSON.stringify(amendments),
          };
        });

        return complete(thenP, 'ok', { process: processId, objectionIndex: idx });
      },
      (elseP) => complete(elseP, 'not_found', { process: processId }),
    ) as StorageProgram<Result>;
  },

  resolveObjection(input: Record<string, unknown>) {
    const processId = resolveId(input.process) ?? resolveId(input.round);
    const objectionId = input.objection as string;
    const resolution = input.resolution as string;
    if (!processId) {
      return complete(createProgram(), 'not_found', { process: processId }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'consent', processId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'consent', processId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<Record<string, unknown>>;
          for (const obj of objections) {
            if (obj.id === objectionId) {
              obj.resolved = true;
              obj.resolution = resolution;
            }
          }
          return { ...record, objections: JSON.stringify(objections) };
        });
        return complete(thenP, 'objection_resolved', { process: processId, objection: objectionId });
      },
      (elseP) => complete(elseP, 'not_found', { process: processId }),
    ) as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const processId = resolveId(input.process) ?? resolveId(input.round);
    if (!processId) {
      return complete(createProgram(), 'not_found', { process: processId }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'consent', processId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
          const unresolved = objections.filter(o => !o.resolved);
          return unresolved.length;
        }, 'unresolvedCount');

        return branch(thenP,
          (bindings) => (bindings.unresolvedCount as number) === 0,
          (okP) => {
            okP = putFrom(okP, 'consent', processId, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, phase: 'Consented' };
            });
            return complete(okP, 'consented', { process: processId });
          },
          (blockedP) => {
            return completeFrom(blockedP, 'unresolved_objections', (bindings) => {
              return { process: processId, count: bindings.unresolvedCount };
            });
          },
        );
      },
      (elseP) => complete(elseP, 'not_found', { process: processId }),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const processId = resolveId(input.process);
    if (!processId) {
      return complete(createProgram(), 'not_found', { process: processId }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'consent', processId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
          const unresolved = objections.filter(o => !o.resolved);
          return unresolved.length;
        }, 'unresolvedCount');

        return branch(thenP,
          (bindings) => (bindings.unresolvedCount as number) === 0,
          (okP) => {
            okP = putFrom(okP, 'consent', processId, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, phase: 'Consented' };
            });
            return completeFrom(okP, 'consented', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { variant: 'ok', process: processId, amendments: record.amendments };
            });
          },
          (blockedP) => {
            return completeFrom(blockedP, 'unresolved_objections', (bindings) => {
              return { variant: 'unresolved_objections', process: processId, count: bindings.unresolvedCount };
            });
          },
        );
      },
      (elseP) => complete(elseP, 'not_found', { process: processId }),
    ) as StorageProgram<Result>;
  },
};

export const consentProcessHandler = autoInterpret(_consentProcessHandler);
