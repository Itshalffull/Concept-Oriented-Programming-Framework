// ============================================================
// StorageProgram — Free Monad DSL for Concept Handlers
// ============================================================
//
// A StorageProgram<A> is a description of storage operations that
// produces a value of type A when interpreted. Handlers build programs
// using the DSL functions below; the interpreter in interpreter.ts
// executes them against a real ConceptStorage backend.

/** A single storage instruction in the program tree. */
export type Instruction =
  | { tag: 'get'; relation: string; key: string; bindAs: string }
  | { tag: 'find'; relation: string; criteria: Record<string, unknown>; bindAs: string }
  | { tag: 'put'; relation: string; key: string; value: Record<string, unknown> }
  | { tag: 'merge'; relation: string; key: string; fields: Record<string, unknown> }
  | { tag: 'del'; relation: string; key: string }
  | { tag: 'delFrom'; relation: string; keyFn: (bindings: Bindings) => string }
  | { tag: 'putFrom'; relation: string; key: string; valueFn: (bindings: Bindings) => Record<string, unknown> }
  | { tag: 'mergeFrom'; relation: string; key: string; fieldsFn: (bindings: Bindings) => Record<string, unknown> }
  | { tag: 'branch'; condition: (bindings: Bindings) => boolean; thenBranch: StorageProgram<unknown>; elseBranch: StorageProgram<unknown> }
  | { tag: 'mapBindings'; fn: (bindings: Bindings) => unknown; bindAs: string }
  | { tag: 'pure'; value: unknown }
  | { tag: 'pureFrom'; fn: (bindings: Bindings) => unknown }
  | { tag: 'bind'; first: StorageProgram<unknown>; bindAs: string; second: StorageProgram<unknown> };

/** Runtime bindings accumulated during interpretation. */
export type Bindings = Record<string, unknown>;

/**
 * A StorageProgram is an inspectable, composable description of storage
 * operations. It is pure data — no side effects occur until an interpreter
 * runs it against a ConceptStorage backend.
 */
export interface StorageProgram<A> {
  readonly instructions: Instruction[];
  readonly terminated: boolean;
}

// --- Builder DSL ---

/** Create an empty program. */
export function createProgram(): StorageProgram<void> {
  return { instructions: [], terminated: false };
}

/** Append a Get instruction. */
export function get(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
  bindAs: string,
): StorageProgram<Record<string, unknown> | null> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'get', relation, key, bindAs }],
    terminated: false,
  };
}

/** Append a Find instruction. */
export function find(
  program: StorageProgram<unknown>,
  relation: string,
  criteria: Record<string, unknown>,
  bindAs: string,
): StorageProgram<Record<string, unknown>[]> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'find', relation, criteria, bindAs }],
    terminated: false,
  };
}

/** Append a Put instruction. */
export function put(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
  value: Record<string, unknown>,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'put', relation, key, value }],
    terminated: false,
  };
}

/** Append a Merge instruction — read-modify-write that merges fields into existing record. */
export function merge(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
  fields: Record<string, unknown>,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'merge', relation, key, fields }],
    terminated: false,
  };
}

/** Append a Del instruction. */
export function del(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'del', relation, key }],
    terminated: false,
  };
}

/** Append a Del instruction with a key derived from bindings at runtime. */
export function delFrom(
  program: StorageProgram<unknown>,
  relation: string,
  keyFn: (bindings: Bindings) => string,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'delFrom', relation, keyFn }],
    terminated: false,
  };
}

/** Append a Put instruction with a value derived from bindings at runtime. */
export function putFrom(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
  valueFn: (bindings: Bindings) => Record<string, unknown>,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'putFrom', relation, key, valueFn }],
    terminated: false,
  };
}

/** Append a Merge instruction with fields derived from bindings at runtime. */
export function mergeFrom(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
  fieldsFn: (bindings: Bindings) => Record<string, unknown>,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'mergeFrom', relation, key, fieldsFn }],
    terminated: false,
  };
}

/** Append a conditional branch. */
export function branch<A>(
  program: StorageProgram<unknown>,
  condition: (bindings: Bindings) => boolean,
  thenBranch: StorageProgram<A>,
  elseBranch: StorageProgram<A>,
): StorageProgram<A> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'branch', condition, thenBranch, elseBranch }],
    terminated: false,
  };
}

/**
 * Derive a value from accumulated bindings via a pure function and bind the result.
 *
 * This replaces the __binding: and __compute: string conventions with
 * a proper inspectable instruction. The function receives all bindings
 * accumulated so far and returns a derived value.
 *
 * For static analysis: the fn is a pure (bindings) => value transform,
 * analogous to branch conditions but producing data rather than a boolean.
 */
export function mapBindings(
  program: StorageProgram<unknown>,
  fn: (bindings: Bindings) => unknown,
  bindAs: string,
): StorageProgram<unknown> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'mapBindings', fn, bindAs }],
    terminated: false,
  };
}

/** Terminate the program with a static return value. */
export function pure<A>(
  program: StorageProgram<unknown>,
  value: A,
): StorageProgram<A> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'pure', value }],
    terminated: true,
  };
}

/**
 * Terminate the program with a return value derived from accumulated bindings.
 *
 * Use this instead of pure() when the return value depends on data fetched
 * during execution (get/find results, mapBindings derivations). The fn
 * receives all accumulated bindings and returns the result object.
 */
export function pureFrom(
  program: StorageProgram<unknown>,
  fn: (bindings: Bindings) => unknown,
): StorageProgram<unknown> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'pureFrom', fn }],
    terminated: true,
  };
}

/** Monadic bind: run first, bind result to bindAs, then run second. */
export function compose<A, B>(
  first: StorageProgram<A>,
  bindAs: string,
  second: StorageProgram<B>,
): StorageProgram<B> {
  return {
    instructions: [{ tag: 'bind', first, bindAs, second }],
    terminated: second.terminated,
  };
}

// --- Analysis Helpers ---

/** Extract the set of relations read by the program. */
export function extractReadSet(program: StorageProgram<unknown>): Set<string> {
  const reads = new Set<string>();
  for (const instr of program.instructions) {
    if (instr.tag === 'get' || instr.tag === 'find') reads.add(instr.relation);
    // merge/mergeFrom reads the existing record before writing
    if (instr.tag === 'merge' || instr.tag === 'mergeFrom') reads.add(instr.relation);
    if (instr.tag === 'branch') {
      for (const r of extractReadSet(instr.thenBranch)) reads.add(r);
      for (const r of extractReadSet(instr.elseBranch)) reads.add(r);
    }
    if (instr.tag === 'bind') {
      for (const r of extractReadSet(instr.first)) reads.add(r);
      for (const r of extractReadSet(instr.second)) reads.add(r);
    }
  }
  return reads;
}

/** Extract the set of relations written by the program. */
export function extractWriteSet(program: StorageProgram<unknown>): Set<string> {
  const writes = new Set<string>();
  for (const instr of program.instructions) {
    if (instr.tag === 'put' || instr.tag === 'del' || instr.tag === 'merge' || instr.tag === 'delFrom' || instr.tag === 'putFrom' || instr.tag === 'mergeFrom') writes.add(instr.relation);
    if (instr.tag === 'branch') {
      for (const w of extractWriteSet(instr.thenBranch)) writes.add(w);
      for (const w of extractWriteSet(instr.elseBranch)) writes.add(w);
    }
    if (instr.tag === 'bind') {
      for (const w of extractWriteSet(instr.first)) writes.add(w);
      for (const w of extractWriteSet(instr.second)) writes.add(w);
    }
  }
  return writes;
}

/** Classify program purity from its instruction set. */
export function classifyPurity(program: StorageProgram<unknown>): 'pure' | 'read-only' | 'read-write' {
  const reads = extractReadSet(program);
  const writes = extractWriteSet(program);
  if (writes.size > 0) return 'read-write';
  if (reads.size > 0) return 'read-only';
  return 'pure';
}

/** Serialize a program to a JSON-safe representation. */
export function serializeProgram(program: StorageProgram<unknown>): string {
  return JSON.stringify({
    instructions: program.instructions.map(instr => {
      if (instr.tag === 'branch') {
        return {
          ...instr,
          condition: instr.condition.toString(),
          thenBranch: serializeProgram(instr.thenBranch),
          elseBranch: serializeProgram(instr.elseBranch),
        };
      }
      if (instr.tag === 'bind') {
        return {
          ...instr,
          first: serializeProgram(instr.first),
          second: serializeProgram(instr.second),
        };
      }
      return instr;
    }),
    terminated: program.terminated,
  });
}
