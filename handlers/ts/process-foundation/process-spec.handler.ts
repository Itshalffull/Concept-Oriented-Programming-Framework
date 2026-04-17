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

const _handler: FunctionalConceptHandler = {
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
        return completeFrom(b, 'ok', (bindings) => {
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
        return mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status'),
        branch(b, '_status',
          // status exists (truthy) - check if draft
          (b2) => {
            return completeFrom(b2, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              const status = rec.status as string;
              if (status !== 'draft') {
                return { spec: specId };
              }
              return { spec: specId, version: (rec.version as number) + 1 };
            });
          },
          (b2) => complete(b2, 'ok', { spec: specId }),
        );
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
};

// Re-implement publish and update with proper storage writes
const handler: FunctionalConceptHandler = {
  ..._handler,

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
};

// Extend handler with addStep — uses imperative override because key insertion
// index logic and per-step timeout extraction are awkward to express monadically.
const processSpecHandlerBase = autoInterpret(handler);

export const processSpecHandler = {
  ...processSpecHandlerBase,

  async addStep(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const stepRaw = input.step as string;
    const index = input.index as number;

    // Parse the step JSON
    let step: Record<string, unknown>;
    try {
      step = JSON.parse(stepRaw);
    } catch {
      return { variant: 'invalid', message: 'Invalid step JSON' };
    }

    // Validate required step fields
    const key = step.key as string | undefined;
    const stepType = step.step_type as string | undefined;
    if (!key || key.trim() === '') {
      return { variant: 'invalid', message: 'Step must have a key' };
    }
    if (!stepType || stepType.trim() === '') {
      return { variant: 'invalid', message: 'Step must have a step_type' };
    }

    // Extract optional timeout (null if absent)
    const timeout = (step.timeout as string | undefined) ?? null;

    // Load the existing spec
    const rec = await storage.get('process-spec', specId);
    if (!rec) {
      return { variant: 'not_found', spec: specId };
    }

    // Only allowed in draft status
    if (rec.status !== 'draft') {
      return { variant: 'invalid', message: 'addStep is only allowed when spec is in draft status' };
    }

    // Parse existing steps
    let existingSteps: Array<Record<string, unknown>>;
    try {
      existingSteps = JSON.parse(rec.steps as string);
    } catch {
      existingSteps = [];
    }

    // Check for duplicate key
    if (existingSteps.some((s) => s.key === key)) {
      return { variant: 'invalid', message: `Duplicate step key: ${key}` };
    }

    // Build the normalized step record
    const normalizedStep: Record<string, unknown> = {
      key,
      step_type: stepType,
      config: step.config ?? '{}',
      timeout,
    };

    // Insert at index, or append if index is -1 or out of bounds
    let newSteps: Array<Record<string, unknown>>;
    if (index === -1 || index >= existingSteps.length) {
      newSteps = [...existingSteps, normalizedStep];
    } else {
      newSteps = [...existingSteps.slice(0, index), normalizedStep, ...existingSteps.slice(index)];
    }

    const newStepsRaw = JSON.stringify(newSteps);
    await storage.put('process-spec', specId, { ...rec, steps: newStepsRaw });
    return { variant: 'ok', spec: specId, steps: newStepsRaw };
  },
};
