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

/**
 * Returns true if an ISO 8601 duration string represents a zero-length duration
 * (e.g. "PT0S", "PT0M", "P0D", "P0Y0M0DT0H0M0S").  Steps with a zero-duration
 * timeout are considered already expired when they are inserted into a spec.
 */
function isZeroDuration(iso: string): boolean {
  // Strip the leading 'P' (and optional 'T') then check all numeric parts
  const withoutP = iso.replace(/^P/, '').replace(/T/, '');
  // Match all numeric values in the duration
  const numbers = withoutP.match(/\d+(\.\d+)?/g);
  if (!numbers) return true; // no numbers at all → zero
  return numbers.every((n) => parseFloat(n) === 0);
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

// ---------------------------------------------------------------------------
// FlowBuilder-compatible step helpers
// Steps are stored in 'process-spec-fb/<specId>' as a JSON array of StepRecord.
// This is separate from the legacy 'process-spec/<specId>.steps' format so
// both APIs can coexist without migration.
// ---------------------------------------------------------------------------

let fbStepCounter = 0;
function fbNextStepId(): string {
  return `fbstep-${Date.now()}-${++fbStepCounter}`;
}

interface FbStepRecord {
  stepId: string;
  stepKind: string;
  stepLabel: string;
  stepIndex: number;
  isCollapsible: boolean;
  isCollapsed: boolean;
  parentId: string | null;
  config: string;
}

interface FbEdgeRecord {
  edgeId: string;
  fromStepId: string;
  toStepId: string;
  label: string; // "default" | "true" | "false" | "error" | custom
}

let fbEdgeCounter = 0;
function fbNextEdgeId(): string {
  return `fbedge-${Date.now()}-${++fbEdgeCounter}`;
}

interface FbGraph {
  steps: FbStepRecord[];
  edges: FbEdgeRecord[];
}

async function fbLoad(storage: any, specId: string): Promise<FbGraph> {
  const rec = await storage.get('process-spec-fb', specId);
  if (!rec) return { steps: [], edges: [] };
  let steps: FbStepRecord[] = [];
  let edges: FbEdgeRecord[] = [];
  try { steps = JSON.parse(rec.steps as string ?? '[]'); } catch { /* empty */ }
  try { edges = JSON.parse(rec.edges as string ?? '[]'); } catch { /* empty */ }
  return { steps, edges };
}

async function fbSave(storage: any, specId: string, graph: FbGraph): Promise<void> {
  graph.steps.forEach((s, i) => { s.stepIndex = i; });
  await storage.put('process-spec-fb', specId, {
    steps: JSON.stringify(graph.steps),
    edges: JSON.stringify(graph.edges),
  });
}

// Legacy shims kept for callers that only need steps
async function fbLoadSteps(storage: any, specId: string): Promise<FbStepRecord[]> {
  return (await fbLoad(storage, specId)).steps;
}

async function fbSaveSteps(storage: any, specId: string, steps: FbStepRecord[]): Promise<void> {
  const graph = await fbLoad(storage, specId);
  await fbSave(storage, specId, { ...graph, steps });
}

function defaultLabelForKind(kind: string): string {
  const labels: Record<string, string> = {
    trigger: 'Trigger',
    action: 'Action',
    branch: 'Branch',
    catch: 'Catch',
    logic: 'Logic',
  };
  return labels[kind] ?? kind;
}

// Extend handler with imperative overrides — index logic and FlowBuilder
// step management are awkward to express monadically.
const processSpecHandlerBase = autoInterpret(handler);

export const processSpecHandler = {
  ...processSpecHandlerBase,

  async addStep(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;

    // FlowBuilder API: { spec, stepKind, atIndex?, fromStepId?, edgeLabel? }
    if (input.stepKind !== undefined) {
      const stepKind = String(input.stepKind ?? 'action');
      const atIndex = typeof input.atIndex === 'number' ? input.atIndex : -1;
      const fromStepId = input.fromStepId as string | undefined;
      const edgeLabel = (input.edgeLabel as string | undefined) ?? 'default';

      const graph = await fbLoad(storage, specId);
      const stepId = fbNextStepId();
      const callerLabel = input.stepLabel as string | undefined;
      const newStep: FbStepRecord = {
        stepId,
        stepKind,
        stepLabel: callerLabel?.trim() ? callerLabel.trim() : defaultLabelForKind(stepKind),
        stepIndex: atIndex === -1 ? graph.steps.length : atIndex,
        isCollapsible: stepKind === 'branch',
        isCollapsed: false,
        parentId: null,
        config: '{}',
      };
      const insertIdx = atIndex === -1 || atIndex >= graph.steps.length ? graph.steps.length : atIndex;
      const newSteps = [...graph.steps.slice(0, insertIdx), newStep, ...graph.steps.slice(insertIdx)];

      // Auto-wire an edge if fromStepId is provided
      const newEdges = [...graph.edges];
      if (fromStepId) {
        newEdges.push({ edgeId: fbNextEdgeId(), fromStepId, toStepId: stepId, label: edgeLabel });
      } else if (newSteps.length > 1) {
        // Default: connect from the step immediately before this one
        const prevStep = newSteps[insertIdx - 1];
        if (prevStep && prevStep.stepId !== stepId) {
          newEdges.push({ edgeId: fbNextEdgeId(), fromStepId: prevStep.stepId, toStepId: stepId, label: 'default' });
        }
      }

      await fbSave(storage, specId, { steps: newSteps, edges: newEdges });
      return { variant: 'ok', stepId, spec: specId };
    }

    // Legacy API: { spec, step (JSON string), index }
    const stepRaw = input.step as string;
    const index = input.index as number;

    let step: Record<string, unknown>;
    try {
      step = JSON.parse(stepRaw);
    } catch {
      return { variant: 'invalid', message: 'Invalid step JSON' };
    }

    const key = step.key as string | undefined;
    const stepType = step.step_type as string | undefined;
    if (!key || key.trim() === '') {
      return { variant: 'invalid', message: 'Step must have a key' };
    }
    if (!stepType || stepType.trim() === '') {
      return { variant: 'invalid', message: 'Step must have a step_type' };
    }

    const allowedStepTypes = new Set([
      'human', 'automation', 'llm', 'approval', 'manual',
      'subprocess', 'webhook_wait', 'vote', 'brainstorm',
    ]);
    if (!allowedStepTypes.has(stepType)) {
      return { variant: 'invalid', message: `Unknown step_type: ${stepType}` };
    }

    const timeout = (step.timeout as string | undefined) ?? null;
    if (timeout !== null && isZeroDuration(timeout)) {
      return { variant: 'timed_out', message: `Step timeout "${timeout}" has already elapsed` };
    }

    const rec = await storage.get('process-spec', specId);
    if (!rec) {
      return { variant: 'not_found', spec: specId };
    }
    if (rec.status !== 'draft') {
      return { variant: 'invalid', message: 'addStep is only allowed when spec is in draft status' };
    }

    let existingSteps: Array<Record<string, unknown>>;
    try {
      existingSteps = JSON.parse(rec.steps as string);
    } catch {
      existingSteps = [];
    }

    if (existingSteps.some((s) => s.key === key)) {
      return { variant: 'invalid', message: `Duplicate step key: ${key}` };
    }

    const normalizedStep: Record<string, unknown> = {
      key,
      step_type: stepType,
      config: step.config ?? '{}',
      timeout,
    };

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

  async getSteps(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    if (!specId) return { variant: 'invalid', message: 'spec is required' };
    const steps = await fbLoadSteps(storage, specId);
    return { variant: 'ok', spec: specId, steps };
  },

  async getStep(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const stepId = input.stepId as string;
    if (!specId || !stepId) return { variant: 'invalid', message: 'spec and stepId are required' };
    const steps = await fbLoadSteps(storage, specId);
    const step = steps.find(s => s.stepId === stepId);
    if (!step) return { variant: 'not_found', stepId };
    return { variant: 'ok', ...step };
  },

  async updateStep(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const stepId = input.stepId as string;
    if (!specId || !stepId) return { variant: 'invalid', message: 'spec and stepId are required' };
    const steps = await fbLoadSteps(storage, specId);
    const idx = steps.findIndex(s => s.stepId === stepId);
    if (idx === -1) return { variant: 'not_found', stepId };
    if (input.label !== undefined) steps[idx].stepLabel = String(input.label);
    if (input.stepLabel !== undefined) steps[idx].stepLabel = String(input.stepLabel);
    if (input.config !== undefined) steps[idx].config = String(input.config);
    await fbSaveSteps(storage, specId, steps);
    return { variant: 'ok', stepId, spec: specId };
  },

  async reorderStep(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const fromIndex = Number(input.fromIndex ?? -1);
    const toIndex = Number(input.toIndex ?? -1);
    if (!specId || fromIndex < 0 || toIndex < 0) {
      return { variant: 'invalid', message: 'spec, fromIndex, toIndex are required' };
    }
    const steps = await fbLoadSteps(storage, specId);
    if (fromIndex >= steps.length || toIndex >= steps.length) {
      return { variant: 'invalid', message: 'Index out of bounds' };
    }
    const [moved] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, moved);
    await fbSaveSteps(storage, specId, steps);
    return { variant: 'ok', spec: specId };
  },

  async removeStep(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const stepId = input.stepId as string;
    if (!specId || !stepId) return { variant: 'invalid', message: 'spec and stepId are required' };
    const graph = await fbLoad(storage, specId);
    const filtered = graph.steps.filter(s => s.stepId !== stepId);
    if (filtered.length === graph.steps.length) return { variant: 'not_found', stepId };
    // Remove edges touching this step
    const filteredEdges = graph.edges.filter(e => e.fromStepId !== stepId && e.toStepId !== stepId);
    await fbSave(storage, specId, { steps: filtered, edges: filteredEdges });
    return { variant: 'ok', stepId, spec: specId };
  },

  async getEdges(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    if (!specId) return { variant: 'invalid', message: 'spec is required' };
    const graph = await fbLoad(storage, specId);
    return { variant: 'ok', spec: specId, edges: graph.edges };
  },

  async addEdge(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const fromStepId = input.fromStepId as string;
    const toStepId = input.toStepId as string;
    const label = (input.label as string | undefined) ?? 'default';
    if (!specId || !fromStepId || !toStepId) {
      return { variant: 'invalid', message: 'spec, fromStepId, toStepId are required' };
    }
    const graph = await fbLoad(storage, specId);
    // Prevent duplicate edge for same from+label pair
    const existing = graph.edges.find(e => e.fromStepId === fromStepId && e.label === label);
    if (existing) {
      // Update target
      existing.toStepId = toStepId;
      await fbSave(storage, specId, graph);
      return { variant: 'ok', edgeId: existing.edgeId, spec: specId };
    }
    const edgeId = fbNextEdgeId();
    graph.edges.push({ edgeId, fromStepId, toStepId, label });
    await fbSave(storage, specId, graph);
    return { variant: 'ok', edgeId, spec: specId };
  },

  async removeEdge(input: Record<string, unknown>, storage: any) {
    const specId = input.spec as string;
    const edgeId = input.edgeId as string;
    if (!specId || !edgeId) return { variant: 'invalid', message: 'spec and edgeId are required' };
    const graph = await fbLoad(storage, specId);
    const filtered = graph.edges.filter(e => e.edgeId !== edgeId);
    if (filtered.length === graph.edges.length) return { variant: 'not_found', edgeId };
    await fbSave(storage, specId, { ...graph, edges: filtered });
    return { variant: 'ok', edgeId, spec: specId };
  },
};
