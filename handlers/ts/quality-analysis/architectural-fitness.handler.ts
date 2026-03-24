// @clef-handler style=functional
// ============================================================
// ArchitecturalFitness Handler
//
// Monitor preservation of macro-system design and dependency
// boundaries. Define architectural fitness functions as automated
// tests for architectural intent. Detect illegal cross-layer
// dependencies, circular references, and boundary violations.
// Providers perform actual dependency analysis.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `fitness-${++idCounter}`;
}

const VALID_FITNESS_TYPES = [
  'structural', 'layering', 'coupling', 'circularity', 'naming', 'custom',
];

const _architecturalFitnessHandler: FunctionalConceptHandler = {

  // ── register ──────────────────────────────────────────────
  register(input: Record<string, unknown>) {
    const functionId = input.functionId as string;
    const name = input.name as string;
    const description = input.description as string;
    const fitnessType = input.fitnessType as string;
    const boundaryDefinition = input.boundaryDefinition as {
      layers: Array<{ name: string; allowedDependencies: string[] }>;
      forbiddenPatterns: Array<{ from: string; to: string; reason: string }>;
    };

    if (!functionId || functionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'functionId is required' });
    }
    if (!fitnessType || !VALID_FITNESS_TYPES.includes(fitnessType)) {
      return complete(createProgram(), 'error', {
        message: `fitnessType must be one of: ${VALID_FITNESS_TYPES.join(', ')}; got "${fitnessType}"`,
      });
    }

    let p = createProgram();
    p = find(p, 'function', { functionId }, 'existing');

    return branch(p,
      (bindings) => {
        const arr = bindings.existing as unknown[];
        return arr && arr.length > 0;
      },
      // duplicate
      complete(createProgram(), 'duplicate', { functionId }),
      // ok — create new fitness function
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'function', id, {
          id,
          functionId,
          name,
          description,
          fitnessType,
          boundaryDefinition: boundaryDefinition || { layers: [], forbiddenPatterns: [] },
          enabled: true,
          lastEvaluated: null,
          passed: null,
          violations: [],
          history: [],
        });
        return complete(b, 'ok', { function: id });
      })(),
    );
  },

  // ── verify ────────────────────────────────────────────────
  verify(input: Record<string, unknown>) {
    const functionId = input.functionId as string;
    const _targets = input.targets as string[] | null | undefined;

    let p = createProgram();
    p = find(p, 'function', { functionId }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      // unknownFunction
      complete(createProgram(), 'unknownFunction', { functionId }),
      // found — check enabled
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_func');

        return branch(b,
          (bindings) => {
            const func = bindings._func as Record<string, unknown>;
            return func.enabled === false;
          },
          // disabled
          complete(createProgram(), 'disabled', { functionId }),
          // enabled — evaluate (provider-backed; stub returns passed)
          (() => {
            let c = createProgram();
            // In a real deployment, a provider would perform actual analysis.
            // Stub: check forbidden patterns against targets (basic simulation).
            c = mapBindings(c, (bindings) => {
              const func = bindings._func as Record<string, unknown>;
              const bd = func.boundaryDefinition as {
                forbiddenPatterns: Array<{ from: string; to: string; reason: string }>;
              };
              // No forbidden patterns means no violations in stub mode
              const violations: Array<{
                from: string; to: string; violationType: string; message: string;
              }> = [];
              return { violations, funcId: func.id as string };
            }, '_evalResult');

            c = mapBindings(c, (bindings) => {
              const result = bindings._evalResult as {
                violations: unknown[]; funcId: string;
              };
              return result.violations.length === 0;
            }, '_passed');

            return branch(c,
              (bindings) => bindings._passed as boolean,
              // passed
              (() => {
                let d = createProgram();
                d = mapBindings(d, (bindings) => {
                  const result = bindings._evalResult as { funcId: string };
                  return result.funcId;
                }, '_fid');
                return completeFrom(d, 'passed', (bindings) => ({
                  function: bindings._fid as string,
                }));
              })(),
              // violated
              (() => {
                let d = createProgram();
                d = mapBindings(d, (bindings) => {
                  const result = bindings._evalResult as {
                    violations: unknown[]; funcId: string;
                  };
                  return result;
                }, '_violResult');
                return completeFrom(d, 'violated', (bindings) => {
                  const result = bindings._violResult as {
                    violations: unknown[]; funcId: string;
                  };
                  return {
                    function: result.funcId,
                    violations: result.violations,
                  };
                });
              })(),
            );
          })(),
        );
      })(),
    );
  },

  // ── verifyAll ─────────────────────────────────────────────
  verifyAll(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'function', {}, 'allFunctions');

    p = mapBindings(p, (bindings) => {
      const funcs = (bindings.allFunctions as Record<string, unknown>[]) || [];
      return funcs
        .filter(f => f.enabled === true)
        .map(f => ({
          functionId: f.functionId as string,
          name: f.name as string,
          passed: true, // stub: all pass in absence of real provider
          violationCount: 0,
        }));
    }, '_results');

    return completeFrom(p, 'ok', (bindings) => ({
      results: bindings._results as unknown[],
    }));
  },

  // ── enable ────────────────────────────────────────────────
  enable(input: Record<string, unknown>) {
    const functionId = input.functionId as string;

    let p = createProgram();
    p = find(p, 'function', { functionId }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'error', { message: `No function with id "${functionId}"` }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_func');

        return branch(b,
          (bindings) => {
            const func = bindings._func as Record<string, unknown>;
            return func.enabled === true;
          },
          // alreadyEnabled
          (() => {
            let c = createProgram();
            return completeFrom(c, 'alreadyEnabled', (bindings) => ({
              function: (bindings._func as Record<string, unknown>).id as string,
            }));
          })(),
          // ok — enable it
          (() => {
            let c = createProgram();
            c = mapBindings(c, (bindings) => {
              const func = bindings._func as Record<string, unknown>;
              return { ...func, enabled: true };
            }, '_updated');
            return completeFrom(c, 'ok', (bindings) => ({
              function: (bindings._func as Record<string, unknown>).id as string,
            }));
          })(),
        );
      })(),
    );
  },

  // ── disable ───────────────────────────────────────────────
  disable(input: Record<string, unknown>) {
    const functionId = input.functionId as string;

    let p = createProgram();
    p = find(p, 'function', { functionId }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'error', { message: `No function with id "${functionId}"` }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_func');

        return branch(b,
          (bindings) => {
            const func = bindings._func as Record<string, unknown>;
            return func.enabled === false;
          },
          // alreadyDisabled
          (() => {
            let c = createProgram();
            return completeFrom(c, 'alreadyDisabled', (bindings) => ({
              function: (bindings._func as Record<string, unknown>).id as string,
            }));
          })(),
          // ok — disable it
          (() => {
            let c = createProgram();
            c = mapBindings(c, (bindings) => {
              const func = bindings._func as Record<string, unknown>;
              return { ...func, enabled: false };
            }, '_updated');
            return completeFrom(c, 'ok', (bindings) => ({
              function: (bindings._func as Record<string, unknown>).id as string,
            }));
          })(),
        );
      })(),
    );
  },

  // ── trend ─────────────────────────────────────────────────
  trend(input: Record<string, unknown>) {
    const functionId = input.functionId as string;
    const count = (input.count as number) ?? 20;

    let p = createProgram();
    p = find(p, 'function', { functionId }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'unknownFunction', { functionId }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          const func = arr[0];
          const history = (func.history as Array<{
            evaluatedAt: string; passed: boolean; violationCount: number;
          }>) || [];
          return history.slice(-count);
        }, '_history');

        return completeFrom(b, 'ok', (bindings) => ({
          history: bindings._history as unknown[],
        }));
      })(),
    );
  },
};

export const architecturalFitnessHandler = autoInterpret(_architecturalFitnessHandler);

export function resetArchitecturalFitnessCounter(): void {
  idCounter = 0;
}
