// ============================================================
// ProgramInterpreter — Execute StoragePrograms Against Backends
// ============================================================

import type { ConceptStorage } from './types.ts';
import type { StorageProgram, Bindings, Instruction } from './storage-program.ts';
import { serializeProgram } from './storage-program.ts';
import type { FunctionalConceptHandler } from './functional-handler.ts';

/** Result of executing a StorageProgram. */
export interface ExecutionResult {
  variant: string;
  output: Record<string, unknown>;
  trace: ExecutionTrace;
}

/** Trace of operations performed during execution. */
export interface ExecutionTrace {
  executionId: string;
  steps: ExecutionStep[];
  durationMs: number;
}

/** A single step in the execution trace. */
export interface ExecutionStep {
  index: number;
  instruction: string;
  relation?: string;
  key?: string;
  result?: unknown;
  durationMs: number;
}

/** Mutation recorded during execution (for rollback and dry-run). */
export interface Mutation {
  tag: 'put' | 'del';
  relation: string;
  key: string;
  value?: Record<string, unknown>;
  previousValue?: Record<string, unknown> | null;
}

/**
 * Interpret a StorageProgram against a ConceptStorage backend.
 *
 * Walks the instruction list, executing each operation against storage
 * and accumulating bindings. Returns the terminal value (variant + output)
 * along with an execution trace.
 */
export async function interpret(
  program: StorageProgram<unknown>,
  storage: ConceptStorage,
  executionId?: string,
  parentBindings?: Bindings,
): Promise<ExecutionResult> {
  const eid = executionId ?? `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Share bindings with parent so branch sub-programs can read and contribute bindings
  const bindings: Bindings = parentBindings ?? {};
  const steps: ExecutionStep[] = [];
  const mutations: Mutation[] = [];
  const start = Date.now();

  let result: { variant: string; [key: string]: unknown } | undefined;

  for (let i = 0; i < program.instructions.length; i++) {
    const instr = program.instructions[i];
    const stepStart = Date.now();

    switch (instr.tag) {
      case 'get': {
        const value = await storage.get(instr.relation, instr.key);
        bindings[instr.bindAs] = value;
        steps.push({ index: i, instruction: 'get', relation: instr.relation, key: instr.key, result: value, durationMs: Date.now() - stepStart });
        break;
      }
      case 'find': {
        const values = await storage.find(instr.relation, instr.criteria);
        bindings[instr.bindAs] = values;
        steps.push({ index: i, instruction: 'find', relation: instr.relation, result: values, durationMs: Date.now() - stepStart });
        break;
      }
      case 'put': {
        const previousValue = await storage.get(instr.relation, instr.key);
        await storage.put(instr.relation, instr.key, instr.value);
        mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value: instr.value, previousValue });
        steps.push({ index: i, instruction: 'put', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
        break;
      }
      case 'merge': {
        const existing = await storage.get(instr.relation, instr.key);
        const merged = existing ? { ...existing, ...instr.fields } : { ...instr.fields };
        const previousValue = existing;
        await storage.put(instr.relation, instr.key, merged);
        mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value: merged, previousValue });
        steps.push({ index: i, instruction: 'merge', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
        break;
      }
      case 'del': {
        const previousValue = await storage.get(instr.relation, instr.key);
        await storage.del(instr.relation, instr.key);
        mutations.push({ tag: 'del', relation: instr.relation, key: instr.key, previousValue });
        steps.push({ index: i, instruction: 'del', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
        break;
      }
      case 'delMany': {
        const count = await storage.delMany(instr.relation, instr.criteria);
        bindings[instr.bindAs] = count;
        steps.push({ index: i, instruction: 'delMany', relation: instr.relation, result: count, durationMs: Date.now() - stepStart });
        break;
      }
      case 'delManyFrom': {
        const criteria = instr.criteriaFn(bindings);
        const count = await storage.delMany(instr.relation, criteria);
        bindings[instr.bindAs] = count;
        steps.push({ index: i, instruction: 'delManyFrom', relation: instr.relation, result: count, durationMs: Date.now() - stepStart });
        break;
      }
      case 'delFrom': {
        const resolvedKey = instr.keyFn(bindings);
        const previousValue = await storage.get(instr.relation, resolvedKey);
        await storage.del(instr.relation, resolvedKey);
        mutations.push({ tag: 'del', relation: instr.relation, key: resolvedKey, previousValue });
        steps.push({ index: i, instruction: 'delFrom', relation: instr.relation, key: resolvedKey, durationMs: Date.now() - stepStart });
        break;
      }
      case 'putFrom': {
        const value = instr.valueFn(bindings);
        const previousValue = await storage.get(instr.relation, instr.key);
        await storage.put(instr.relation, instr.key, value);
        mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value, previousValue });
        steps.push({ index: i, instruction: 'putFrom', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
        break;
      }
      case 'mergeFrom': {
        const fields = instr.fieldsFn(bindings);
        const existing = await storage.get(instr.relation, instr.key);
        const merged = existing ? { ...existing, ...fields } : { ...fields };
        const previousValue = existing;
        await storage.put(instr.relation, instr.key, merged);
        mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value: merged, previousValue });
        steps.push({ index: i, instruction: 'mergeFrom', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
        break;
      }
      case 'mapBindings': {
        const derived = instr.fn(bindings);
        bindings[instr.bindAs] = derived;
        steps.push({ index: i, instruction: 'mapBindings', result: derived, durationMs: Date.now() - stepStart });
        break;
      }
      case 'branch': {
        const taken = instr.condition(bindings);
        const branchProgram = taken ? instr.thenBranch : instr.elseBranch;
        const branchResult = await interpret(branchProgram, storage, eid, bindings);
        steps.push({ index: i, instruction: `branch:${taken ? 'then' : 'else'}`, durationMs: Date.now() - stepStart });
        steps.push(...branchResult.trace.steps);
        if (branchResult.variant !== '__continue') {
          result = { variant: branchResult.variant, ...branchResult.output };
        }
        break;
      }
      case 'pure': {
        const val = instr.value as { variant: string; [key: string]: unknown };
        result = val;
        steps.push({ index: i, instruction: 'pure', result: val, durationMs: Date.now() - stepStart });
        break;
      }
      case 'pureFrom': {
        const val = instr.fn(bindings) as { variant: string; [key: string]: unknown };
        result = val;
        steps.push({ index: i, instruction: 'pureFrom', result: val, durationMs: Date.now() - stepStart });
        break;
      }
      case 'bind': {
        const firstResult = await interpret(instr.first, storage, eid);
        bindings[instr.bindAs] = firstResult.output;
        steps.push(...firstResult.trace.steps);
        const secondResult = await interpret(instr.second, storage, eid);
        steps.push(...secondResult.trace.steps);
        result = { variant: secondResult.variant, ...secondResult.output };
        break;
      }
    }
  }

  const finalResult = result ?? { variant: 'ok' };
  const { variant, ...output } = finalResult;

  return {
    variant,
    output,
    trace: { executionId: eid, steps, durationMs: Date.now() - start },
  };
}

/**
 * Dry-run a StorageProgram: interpret against a snapshot without
 * persisting mutations. Returns what would happen.
 */
export async function dryRunInterpret(
  program: StorageProgram<unknown>,
  snapshot: ConceptStorage,
): Promise<{ variant: string; output: Record<string, unknown>; mutations: Mutation[] }> {
  const mutations: Mutation[] = [];

  // Wrap the snapshot storage to capture mutations without persisting
  const wrapper: ConceptStorage = {
    get: snapshot.get.bind(snapshot),
    find: snapshot.find.bind(snapshot),
    put: async (relation, key, value) => {
      const prev = await snapshot.get(relation, key);
      mutations.push({ tag: 'put', relation, key, value, previousValue: prev });
      // Apply to snapshot so subsequent reads see the write
      await snapshot.put(relation, key, value);
    },
    del: async (relation, key) => {
      const prev = await snapshot.get(relation, key);
      mutations.push({ tag: 'del', relation, key, previousValue: prev });
      await snapshot.del(relation, key);
    },
    delMany: snapshot.delMany.bind(snapshot),
  };

  const result = await interpret(program, wrapper);
  return { variant: result.variant, output: result.output, mutations };
}

/**
 * Execute a single instruction against storage, accumulating bindings and steps.
 * Factored out of interpret() for reuse by parallelInterpret().
 */
async function executeInstruction(
  instr: Instruction,
  index: number,
  bindings: Bindings,
  storage: ConceptStorage,
  eid: string,
): Promise<{
  steps: ExecutionStep[];
  mutations: Mutation[];
  result?: { variant: string; [key: string]: unknown };
}> {
  const stepStart = Date.now();
  const steps: ExecutionStep[] = [];
  const mutations: Mutation[] = [];
  let result: { variant: string; [key: string]: unknown } | undefined;

  switch (instr.tag) {
    case 'get': {
      const value = await storage.get(instr.relation, instr.key);
      bindings[instr.bindAs] = value;
      steps.push({ index, instruction: 'get', relation: instr.relation, key: instr.key, result: value, durationMs: Date.now() - stepStart });
      break;
    }
    case 'find': {
      const values = await storage.find(instr.relation, instr.criteria);
      bindings[instr.bindAs] = values;
      steps.push({ index, instruction: 'find', relation: instr.relation, result: values, durationMs: Date.now() - stepStart });
      break;
    }
    case 'put': {
      const previousValue = await storage.get(instr.relation, instr.key);
      await storage.put(instr.relation, instr.key, instr.value);
      mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value: instr.value, previousValue });
      steps.push({ index, instruction: 'put', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
      break;
    }
    case 'merge': {
      const existing = await storage.get(instr.relation, instr.key);
      const merged = existing ? { ...existing, ...instr.fields } : { ...instr.fields };
      const previousValue = existing;
      await storage.put(instr.relation, instr.key, merged);
      mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value: merged, previousValue });
      steps.push({ index, instruction: 'merge', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
      break;
    }
    case 'del': {
      const previousValue = await storage.get(instr.relation, instr.key);
      await storage.del(instr.relation, instr.key);
      mutations.push({ tag: 'del', relation: instr.relation, key: instr.key, previousValue });
      steps.push({ index, instruction: 'del', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
      break;
    }
    case 'delMany': {
      const count = await storage.delMany(instr.relation, instr.criteria);
      bindings[instr.bindAs] = count;
      steps.push({ index, instruction: 'delMany', relation: instr.relation, result: count, durationMs: Date.now() - stepStart });
      break;
    }
    case 'delManyFrom': {
      const criteria = instr.criteriaFn(bindings);
      const count = await storage.delMany(instr.relation, criteria);
      bindings[instr.bindAs] = count;
      steps.push({ index, instruction: 'delManyFrom', relation: instr.relation, result: count, durationMs: Date.now() - stepStart });
      break;
    }
    case 'delFrom': {
      const resolvedKey = instr.keyFn(bindings);
      const previousValue = await storage.get(instr.relation, resolvedKey);
      await storage.del(instr.relation, resolvedKey);
      mutations.push({ tag: 'del', relation: instr.relation, key: resolvedKey, previousValue });
      steps.push({ index, instruction: 'delFrom', relation: instr.relation, key: resolvedKey, durationMs: Date.now() - stepStart });
      break;
    }
    case 'putFrom': {
      const value = instr.valueFn(bindings);
      const previousValue = await storage.get(instr.relation, instr.key);
      await storage.put(instr.relation, instr.key, value);
      mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value, previousValue });
      steps.push({ index, instruction: 'putFrom', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
      break;
    }
    case 'mergeFrom': {
      const fields = instr.fieldsFn(bindings);
      const existing = await storage.get(instr.relation, instr.key);
      const merged = existing ? { ...existing, ...fields } : { ...fields };
      const previousValue = existing;
      await storage.put(instr.relation, instr.key, merged);
      mutations.push({ tag: 'put', relation: instr.relation, key: instr.key, value: merged, previousValue });
      steps.push({ index, instruction: 'mergeFrom', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
      break;
    }
    case 'mapBindings': {
      const derived = instr.fn(bindings);
      bindings[instr.bindAs] = derived;
      steps.push({ index, instruction: 'mapBindings', result: derived, durationMs: Date.now() - stepStart });
      break;
    }
    case 'branch': {
      const taken = instr.condition(bindings);
      const branchProgram = taken ? instr.thenBranch : instr.elseBranch;
      const branchResult = await interpret(branchProgram, storage, eid, bindings);
      steps.push({ index, instruction: `branch:${taken ? 'then' : 'else'}`, durationMs: Date.now() - stepStart });
      steps.push(...branchResult.trace.steps);
      if (branchResult.variant !== '__continue') {
        result = { variant: branchResult.variant, ...branchResult.output };
      }
      break;
    }
    case 'pure': {
      const val = instr.value as { variant: string; [key: string]: unknown };
      result = val;
      steps.push({ index, instruction: 'pure', result: val, durationMs: Date.now() - stepStart });
      break;
    }
    case 'pureFrom': {
      const val = instr.fn(bindings) as { variant: string; [key: string]: unknown };
      result = val;
      steps.push({ index, instruction: 'pureFrom', result: val, durationMs: Date.now() - stepStart });
      break;
    }
    case 'bind': {
      const firstResult = await interpret(instr.first, storage, eid);
      bindings[instr.bindAs] = firstResult.output;
      steps.push(...firstResult.trace.steps);
      const secondResult = await interpret(instr.second, storage, eid);
      steps.push(...secondResult.trace.steps);
      result = { variant: secondResult.variant, ...secondResult.output };
      break;
    }
  }

  return { steps, mutations, result };
}

/**
 * Interpret a StorageProgram with applicative parallelism.
 *
 * Dispatches to the ParallelismProvider concept (via its handler) to
 * analyze the program's instruction dependencies. The provider returns
 * a StorageProgram which is interpreted sequentially to produce the
 * parallel layer analysis. Those layers then drive concurrent execution
 * of independent instructions via Promise.all.
 *
 * This keeps the analysis fully within the monadic pipeline — the
 * interpreter never bypasses the concept system.
 *
 * @param provider - The ParallelismProvider handler (or any handler
 *   with an `analyze` action that accepts `{ program: string }` and
 *   returns layers via a StorageProgram).
 */
export async function parallelInterpret(
  program: StorageProgram<unknown>,
  storage: ConceptStorage,
  provider: FunctionalConceptHandler,
  executionId?: string,
  parentBindings?: Bindings,
): Promise<ExecutionResult & { parallelLayers: number }> {
  const eid = executionId ?? `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bindings: Bindings = parentBindings ?? {};
  const allSteps: ExecutionStep[] = [];
  const start = Date.now();

  const instructions = program.instructions;

  // --- Step 1: Dispatch to the provider via the concept system ---
  // Serialize the target program and invoke the provider's analyze action,
  // which returns a StorageProgram. We interpret that analysis program
  // sequentially — full monadic traceability for the analysis itself.
  const serialized = serializeProgram(program);
  const analysisProgram = provider.analyze({ program: serialized });
  const analysisResult = await interpret(
    analysisProgram as StorageProgram<unknown>,
    storage,
    eid,
  );

  // Record the analysis trace as part of the overall trace
  allSteps.push(...analysisResult.trace.steps);

  // --- Step 2: Parse layers from the analysis result ---
  let layers: number[][] = [];
  if (analysisResult.variant === 'ok' && analysisResult.output.layers) {
    try {
      layers = JSON.parse(analysisResult.output.layers as string);
    } catch { /* fall through to sequential */ }
  }

  // If analysis returned sequential or failed, fall back to sequential interpret
  if (layers.length === 0) {
    const seqResult = await interpret(program, storage, eid, parentBindings);
    return {
      ...seqResult,
      trace: {
        ...seqResult.trace,
        steps: [...allSteps, ...seqResult.trace.steps],
        durationMs: Date.now() - start,
      },
      parallelLayers: 1,
    };
  }

  // --- Step 3: Execute layers — concurrent within, sequential across ---
  let result: { variant: string; [key: string]: unknown } | undefined;

  for (const layer of layers) {
    if (layer.length === 1) {
      const idx = layer[0];
      const out = await executeInstruction(instructions[idx], idx, bindings, storage, eid);
      allSteps.push(...out.steps);
      if (out.result) result = out.result;
    } else {
      // Independent instructions — execute concurrently via Promise.all
      const promises = layer.map(idx =>
        executeInstruction(instructions[idx], idx, bindings, storage, eid)
      );
      const results = await Promise.all(promises);
      for (const out of results) {
        allSteps.push(...out.steps);
        if (out.result) result = out.result;
      }
    }
  }

  const finalResult = result ?? { variant: 'ok' };
  const { variant, ...output } = finalResult;

  return {
    variant,
    output,
    trace: { executionId: eid, steps: allSteps, durationMs: Date.now() - start },
    parallelLayers: layers.length,
  };
}

/**
 * Rollback an execution by applying compensating operations in reverse.
 */
export async function rollbackExecution(
  mutations: Mutation[],
  storage: ConceptStorage,
): Promise<void> {
  // Apply compensating operations in reverse order
  for (let i = mutations.length - 1; i >= 0; i--) {
    const m = mutations[i];
    if (m.tag === 'put') {
      if (m.previousValue) {
        await storage.put(m.relation, m.key, m.previousValue);
      } else {
        await storage.del(m.relation, m.key);
      }
    } else if (m.tag === 'del') {
      if (m.previousValue) {
        await storage.put(m.relation, m.key, m.previousValue);
      }
    }
  }
}
