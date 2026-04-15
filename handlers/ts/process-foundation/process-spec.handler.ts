// @clef-handler style=functional
// ProcessSpec Concept Implementation
// Store versioned, publishable process template definitions
// consisting of step definitions and routing edges.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom, putFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `pspec-${Date.now()}-${++idCounter}`;
}

function validateStepsAndEdges(
  stepsRaw: string,
  edgesRaw: string,
): { valid: boolean; message?: string; steps?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> } {
  let steps: Array<Record<string, unknown>>;
  let edges: Array<Record<string, unknown>>;
  try {
    steps = JSON.parse(stepsRaw);
  } catch {
    return { valid: false, message: 'Invalid steps JSON' };
  }
  try {
    edges = JSON.parse(edgesRaw);
  } catch {
    return { valid: false, message: 'Invalid edges JSON' };
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return { valid: false, message: 'At least one step is required' };
  }
  const stepKeys = new Set<string>();
  for (const step of steps) {
    const key = step.key as string;
    if (!key) return { valid: false, message: 'Each step must have a key' };
    if (stepKeys.has(key)) return { valid: false, message: `Duplicate step key: ${key}` };
    stepKeys.add(key);
  }
  if (Array.isArray(edges)) {
    for (const edge of edges) {
      const from = edge.from_step as string;
      const to = edge.to_step as string;
      if (!stepKeys.has(from)) return { valid: false, message: `Edge references unknown from_step: ${from}` };
      if (!stepKeys.has(to)) return { valid: false, message: `Edge references unknown to_step: ${to}` };
    }
  }
  return { valid: true, steps, edges };
}

const ALLOWED_EDGE_KINDS = new Set(['default', 'branch', 'catch']);

const handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'process-spec', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'ProcessSpec' }),
      (b) => {
        let b2 = put(b, 'process-spec', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'ProcessSpec' });
      },
    ) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const stepsRaw = input.steps as string;
    const edgesRaw = input.edges as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const validation = validateStepsAndEdges(stepsRaw, edgesRaw);
    if (!validation.valid) {
      return complete(createProgram(), 'invalid', { message: validation.message }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'process-spec', id, {
      id,
      name,
      version: 1,
      status: 'draft',
      description: (input.description as string) || null,
      steps: stepsRaw,
      edges: edgesRaw,
      metadata: (input.metadata as string) || null,
    });
    return complete(p, 'ok', { spec: id }) as StorageProgram<Result>;
  },

  publish(input: Record<string, unknown>) {
    const specId = input.spec as string;
    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-spec', specId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status === 'active') {
            return rec; // no change
          }
          const newVersion = status === 'deprecated' ? (rec.version as number) + 1 : rec.version as number;
          return { ...rec, status: 'active', version: newVersion };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status === 'active') {
            return { spec: specId };
          }
          const newVersion = status === 'deprecated' ? (rec.version as number) + 1 : rec.version as number;
          return { spec: specId, version: newVersion };
        });
      },
      (b) => complete(b, 'not_found', { spec: specId }),
    ) as StorageProgram<Result>;
  },

  deprecate(input: Record<string, unknown>) {
    const specId = input.spec as string;
    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-spec', specId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'deprecated' };
        });
        return complete(b2, 'ok', { spec: specId });
      },
      (b) => complete(b, 'not_found', { spec: specId }),
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const specId = input.spec as string;
    const stepsRaw = input.steps as string;
    const edgesRaw = input.edges as string;

    const validation = validateStepsAndEdges(stepsRaw, edgesRaw);
    if (!validation.valid) {
      return complete(createProgram(), 'invalid', { message: validation.message }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-spec', specId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'draft') {
            return rec; // no change if not draft
          }
          return {
            ...rec,
            steps: stepsRaw,
            edges: edgesRaw,
            version: (rec.version as number) + 1,
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'draft') {
            return { spec: specId };
          }
          return { spec: specId, version: (rec.version as number) + 1 };
        });
      },
      (b) => complete(b, 'not_found', { spec: specId }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const specId = input.spec as string;
    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            spec: specId,
            name: rec.name as string,
            version: rec.version as number,
            status: rec.status as string,
            steps: rec.steps as string,
            edges: rec.edges as string,
          };
        });
      },
      (b) => complete(b, 'not_found', { spec: specId }),
    ) as StorageProgram<Result>;
  },

  // ── Granular step/edge mutations ──────────────────────────────────────

  addStep(input: Record<string, unknown>) {
    const specId = input.spec as string;
    const stepRaw = input.step as string;
    const index = input.index as number;

    // Validate the step JSON before any storage access
    let newStep: Record<string, unknown>;
    try {
      newStep = JSON.parse(stepRaw);
    } catch {
      return complete(createProgram(), 'error', { message: 'step is not valid JSON' }) as StorageProgram<Result>;
    }
    if (!newStep.key || typeof newStep.key !== 'string') {
      return complete(createProgram(), 'error', { message: 'step must have a key field' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        // Check locked first via mapBindings, then branch
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(b2,
          (bindings) => {
            const status = bindings._status as string;
            return status === 'active' || status === 'deprecated';
          },
          (b3) => complete(b3, 'locked', { message: 'Spec is not in draft status and cannot be modified' }),
          (b3) => {
            // Parse existing steps and check for duplicate key
            let b4 = mapBindings(b3, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              try {
                return JSON.parse(rec.steps as string) as Array<Record<string, unknown>>;
              } catch {
                return null;
              }
            }, '_steps');
            return branch(b4,
              (bindings) => bindings._steps === null,
              (b5) => complete(b5, 'error', { message: 'Failed to decode stored steps' }),
              (b5) => {
                // Check duplicate key
                let b6 = mapBindings(b5, (bindings) => {
                  const steps = bindings._steps as Array<Record<string, unknown>>;
                  return steps.some((s) => s.key === newStep.key);
                }, '_duplicate');
                return branch(b6,
                  (bindings) => bindings._duplicate as boolean,
                  (b7) => complete(b7, 'error', { message: `Duplicate step key: ${newStep.key}` }),
                  (b7) => {
                    // Insert the step at the given index
                    let b8 = putFrom(b7, 'process-spec', specId, (bindings) => {
                      const rec = bindings.existing as Record<string, unknown>;
                      const steps = [...(bindings._steps as Array<Record<string, unknown>>)];
                      const insertAt = Math.min(Math.max(0, index), steps.length);
                      steps.splice(insertAt, 0, newStep);
                      return { ...rec, steps: JSON.stringify(steps) };
                    });
                    return complete(b8, 'ok', { spec: specId });
                  },
                );
              },
            );
          },
        );
      },
      (b) => complete(b, 'notfound', { message: `No spec found with id: ${specId}` }),
    ) as StorageProgram<Result>;
  },

  removeStep(input: Record<string, unknown>) {
    const specId = input.spec as string;
    const stepKey = input.stepKey as string;

    if (!stepKey || stepKey.trim() === '') {
      return complete(createProgram(), 'error', { message: 'stepKey is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(b2,
          (bindings) => {
            const status = bindings._status as string;
            return status === 'active' || status === 'deprecated';
          },
          (b3) => complete(b3, 'locked', { message: 'Spec is not in draft status and cannot be modified' }),
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              try {
                return JSON.parse(rec.steps as string) as Array<Record<string, unknown>>;
              } catch {
                return null;
              }
            }, '_steps');
            return branch(b4,
              (bindings) => bindings._steps === null,
              (b5) => complete(b5, 'error', { message: 'Failed to decode stored steps' }),
              (b5) => {
                // Check if the step exists
                let b6 = mapBindings(b5, (bindings) => {
                  const steps = bindings._steps as Array<Record<string, unknown>>;
                  return steps.findIndex((s) => s.key === stepKey);
                }, '_idx');
                return branch(b6,
                  (bindings) => (bindings._idx as number) === -1,
                  (b7) => complete(b7, 'notfound', { message: `No step with key: ${stepKey}` }),
                  (b7) => {
                    let b8 = putFrom(b7, 'process-spec', specId, (bindings) => {
                      const rec = bindings.existing as Record<string, unknown>;
                      const steps = (bindings._steps as Array<Record<string, unknown>>).filter(
                        (s) => s.key !== stepKey,
                      );
                      // Also remove edges that reference the removed step
                      let edges: Array<Record<string, unknown>> = [];
                      try {
                        edges = JSON.parse(rec.edges as string) as Array<Record<string, unknown>>;
                      } catch {
                        // leave edges as empty if parse fails
                      }
                      const filteredEdges = edges.filter(
                        (e) => e.from_step !== stepKey && e.to_step !== stepKey,
                      );
                      return { ...rec, steps: JSON.stringify(steps), edges: JSON.stringify(filteredEdges) };
                    });
                    return complete(b8, 'ok', { spec: specId });
                  },
                );
              },
            );
          },
        );
      },
      (b) => complete(b, 'notfound', { message: `No spec found with id: ${specId}` }),
    ) as StorageProgram<Result>;
  },

  moveStep(input: Record<string, unknown>) {
    const specId = input.spec as string;
    const stepKey = input.stepKey as string;
    const toIndex = input.toIndex as number;

    if (!stepKey || stepKey.trim() === '') {
      return complete(createProgram(), 'error', { message: 'stepKey is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(b2,
          (bindings) => {
            const status = bindings._status as string;
            return status === 'active' || status === 'deprecated';
          },
          (b3) => complete(b3, 'locked', { message: 'Spec is not in draft status and cannot be modified' }),
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              try {
                return JSON.parse(rec.steps as string) as Array<Record<string, unknown>>;
              } catch {
                return null;
              }
            }, '_steps');
            return branch(b4,
              (bindings) => bindings._steps === null,
              (b5) => complete(b5, 'error', { message: 'Failed to decode stored steps' }),
              (b5) => {
                let b6 = mapBindings(b5, (bindings) => {
                  const steps = bindings._steps as Array<Record<string, unknown>>;
                  return steps.findIndex((s) => s.key === stepKey);
                }, '_fromIdx');
                return branch(b6,
                  (bindings) => (bindings._fromIdx as number) === -1,
                  (b7) => complete(b7, 'notfound', { message: `No step with key: ${stepKey}` }),
                  (b7) => {
                    let b8 = putFrom(b7, 'process-spec', specId, (bindings) => {
                      const rec = bindings.existing as Record<string, unknown>;
                      const steps = [...(bindings._steps as Array<Record<string, unknown>>)];
                      const fromIdx = bindings._fromIdx as number;
                      const [moved] = steps.splice(fromIdx, 1);
                      const insertAt = Math.min(Math.max(0, toIndex), steps.length);
                      steps.splice(insertAt, 0, moved);
                      return { ...rec, steps: JSON.stringify(steps) };
                    });
                    return complete(b8, 'ok', { spec: specId });
                  },
                );
              },
            );
          },
        );
      },
      (b) => complete(b, 'notfound', { message: `No spec found with id: ${specId}` }),
    ) as StorageProgram<Result>;
  },

  addEdge(input: Record<string, unknown>) {
    const specId = input.spec as string;
    const fromKey = input.fromKey as string;
    const toKey = input.toKey as string;
    const kind = input.kind as string;

    // Validate kind before any storage access
    if (!ALLOWED_EDGE_KINDS.has(kind)) {
      return complete(createProgram(), 'invalid_kind', {
        message: `kind must be one of: default, branch, catch. Got: ${kind}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(b2,
          (bindings) => {
            const status = bindings._status as string;
            return status === 'active' || status === 'deprecated';
          },
          (b3) => complete(b3, 'locked', { message: 'Spec is not in draft status and cannot be modified' }),
          (b3) => {
            // Decode steps and edges
            let b4 = mapBindings(b3, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              try {
                return JSON.parse(rec.steps as string) as Array<Record<string, unknown>>;
              } catch {
                return null;
              }
            }, '_steps');
            return branch(b4,
              (bindings) => bindings._steps === null,
              (b5) => complete(b5, 'error', { message: 'Failed to decode stored steps' }),
              (b5) => {
                let b6 = mapBindings(b5, (bindings) => {
                  const steps = bindings._steps as Array<Record<string, unknown>>;
                  const keys = new Set(steps.map((s) => s.key as string));
                  return !keys.has(fromKey) ? fromKey : (!keys.has(toKey) ? toKey : null);
                }, '_missingKey');
                return branch(b6,
                  (bindings) => bindings._missingKey !== null,
                  (b7) => {
                    return completeFrom(b7, 'notfound', (bindings) => ({
                      message: `No step with key: ${bindings._missingKey as string}`,
                    }));
                  },
                  (b7) => {
                    let b8 = mapBindings(b7, (bindings) => {
                      const rec = bindings.existing as Record<string, unknown>;
                      try {
                        return JSON.parse(rec.edges as string) as Array<Record<string, unknown>>;
                      } catch {
                        return null;
                      }
                    }, '_edges');
                    return branch(b8,
                      (bindings) => bindings._edges === null,
                      (b9) => complete(b9, 'error', { message: 'Failed to decode stored edges' }),
                      (b9) => {
                        let b10 = putFrom(b9, 'process-spec', specId, (bindings) => {
                          const rec = bindings.existing as Record<string, unknown>;
                          const edges = [
                            ...(bindings._edges as Array<Record<string, unknown>>),
                            { from_step: fromKey, to_step: toKey, on_variant: kind, condition_expr: null, priority: 0 },
                          ];
                          return { ...rec, edges: JSON.stringify(edges) };
                        });
                        return complete(b10, 'ok', { spec: specId });
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
      (b) => complete(b, 'notfound', { message: `No spec found with id: ${specId}` }),
    ) as StorageProgram<Result>;
  },

  removeEdge(input: Record<string, unknown>) {
    const specId = input.spec as string;
    const fromKey = input.fromKey as string;
    const toKey = input.toKey as string;

    let p = createProgram();
    p = get(p, 'process-spec', specId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(b2,
          (bindings) => {
            const status = bindings._status as string;
            return status === 'active' || status === 'deprecated';
          },
          (b3) => complete(b3, 'locked', { message: 'Spec is not in draft status and cannot be modified' }),
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              try {
                return JSON.parse(rec.edges as string) as Array<Record<string, unknown>>;
              } catch {
                return null;
              }
            }, '_edges');
            return branch(b4,
              (bindings) => bindings._edges === null,
              (b5) => complete(b5, 'error', { message: 'Failed to decode stored edges' }),
              (b5) => {
                let b6 = putFrom(b5, 'process-spec', specId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const edges = (bindings._edges as Array<Record<string, unknown>>).filter(
                    (e) => !(e.from_step === fromKey && e.to_step === toKey),
                  );
                  return { ...rec, edges: JSON.stringify(edges) };
                });
                return complete(b6, 'ok', { spec: specId });
              },
            );
          },
        );
      },
      (b) => complete(b, 'notfound', { message: `No spec found with id: ${specId}` }),
    ) as StorageProgram<Result>;
  },
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'process-spec', {}, '_allSpecs');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allSpecs as Array<Record<string, unknown>>) ?? [];
      const specs = all.filter((rec) => rec.id !== '__registered');
      return { specs };
    }) as StorageProgram<Result>;
  },
};

export const processSpecHandler = autoInterpret(handler);
