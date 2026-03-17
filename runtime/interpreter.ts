// ============================================================
// ProgramInterpreter — Execute StoragePrograms Against Backends
// ============================================================

import type { ConceptStorage } from './types.ts';
import type { StorageProgram, Instruction, Bindings } from './storage-program.ts';

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
): Promise<ExecutionResult> {
  const eid = executionId ?? `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bindings: Bindings = {};
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
      case 'del': {
        const previousValue = await storage.get(instr.relation, instr.key);
        await storage.del(instr.relation, instr.key);
        mutations.push({ tag: 'del', relation: instr.relation, key: instr.key, previousValue });
        steps.push({ index: i, instruction: 'del', relation: instr.relation, key: instr.key, durationMs: Date.now() - stepStart });
        break;
      }
      case 'branch': {
        const taken = instr.condition(bindings);
        const branchProgram = taken ? instr.thenBranch : instr.elseBranch;
        const branchResult = await interpret(branchProgram, storage, eid);
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
