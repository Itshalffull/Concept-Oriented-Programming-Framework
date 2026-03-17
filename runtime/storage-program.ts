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

/** Effect set tracking which relations a program reads and writes. */
export interface EffectSet {
  readonly reads: ReadonlySet<string>;
  readonly writes: ReadonlySet<string>;
}

/** Purity level derived from effect set. */
export type Purity = 'pure' | 'read-only' | 'read-write';

/**
 * A StorageProgram is an inspectable, composable description of storage
 * operations. It is pure data — no side effects occur until an interpreter
 * runs it against a ConceptStorage backend.
 *
 * The effects field tracks which relations the program reads and writes,
 * accumulated structurally during program construction. This makes purity
 * a first-class, build-time property rather than a post-hoc analysis.
 */
export interface StorageProgram<A> {
  readonly instructions: Instruction[];
  readonly terminated: boolean;
  readonly effects: EffectSet;
}

/** Derive purity from a program's structural effect set. */
export function purityOf(program: StorageProgram<unknown>): Purity {
  if (program.effects.writes.size > 0) return 'read-write';
  if (program.effects.reads.size > 0) return 'read-only';
  return 'pure';
}

/** Create a new empty effect set. */
function emptyEffects(): EffectSet {
  return { reads: new Set(), writes: new Set() };
}

/** Merge two effect sets (union of reads, union of writes). */
function mergeEffects(a: EffectSet, b: EffectSet): EffectSet {
  return {
    reads: new Set([...a.reads, ...b.reads]),
    writes: new Set([...a.writes, ...b.writes]),
  };
}

/** Add a read relation to an effect set. */
function addRead(effects: EffectSet, relation: string): EffectSet {
  const reads = new Set(effects.reads);
  reads.add(relation);
  return { reads, writes: effects.writes };
}

/** Add a write relation to an effect set. */
function addWrite(effects: EffectSet, relation: string): EffectSet {
  const writes = new Set(effects.writes);
  writes.add(relation);
  return { reads: effects.reads, writes };
}

/** Add both a read and write relation (for merge/mergeFrom). */
function addReadWrite(effects: EffectSet, relation: string): EffectSet {
  const reads = new Set(effects.reads);
  reads.add(relation);
  const writes = new Set(effects.writes);
  writes.add(relation);
  return { reads, writes };
}

// --- Builder DSL ---

/** Create an empty program. */
export function createProgram(): StorageProgram<void> {
  return { instructions: [], terminated: false, effects: emptyEffects() };
}

/** Append a Get instruction. Adds relation to read effects. */
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
    effects: addRead(program.effects, relation),
  };
}

/** Append a Find instruction. Adds relation to read effects. */
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
    effects: addRead(program.effects, relation),
  };
}

/** Append a Put instruction. Adds relation to write effects. */
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
    effects: addWrite(program.effects, relation),
  };
}

/** Append a Merge instruction — read-modify-write. Adds relation to both read and write effects. */
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
    effects: addReadWrite(program.effects, relation),
  };
}

/** Append a Del instruction. Adds relation to write effects. */
export function del(
  program: StorageProgram<unknown>,
  relation: string,
  key: string,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'del', relation, key }],
    terminated: false,
    effects: addWrite(program.effects, relation),
  };
}

/** Append a Del instruction with a key derived from bindings at runtime. Adds relation to write effects. */
export function delFrom(
  program: StorageProgram<unknown>,
  relation: string,
  keyFn: (bindings: Bindings) => string,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'delFrom', relation, keyFn }],
    terminated: false,
    effects: addWrite(program.effects, relation),
  };
}

/** Append a Put instruction with a value derived from bindings at runtime. Adds relation to write effects. */
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
    effects: addWrite(program.effects, relation),
  };
}

/** Append a Merge instruction with fields derived from bindings at runtime. Adds relation to both read and write effects. */
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
    effects: addReadWrite(program.effects, relation),
  };
}

/** Append a conditional branch. Merges effects from both branches (conservative). */
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
    effects: mergeEffects(program.effects, mergeEffects(thenBranch.effects, elseBranch.effects)),
  };
}

/**
 * Derive a value from accumulated bindings via a pure function and bind the result.
 * No storage effects — pure computation.
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
    effects: program.effects,
  };
}

/** Terminate the program with a static return value. No storage effects. */
export function pure<A>(
  program: StorageProgram<unknown>,
  value: A,
): StorageProgram<A> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'pure', value }],
    terminated: true,
    effects: program.effects,
  };
}

/**
 * Terminate the program with a return value derived from accumulated bindings.
 * No storage effects — pure computation on existing bindings.
 */
export function pureFrom(
  program: StorageProgram<unknown>,
  fn: (bindings: Bindings) => unknown,
): StorageProgram<unknown> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'pureFrom', fn }],
    terminated: true,
    effects: program.effects,
  };
}

/** Monadic bind: run first, bind result to bindAs, then run second. Merges effects from both programs. */
export function compose<A, B>(
  first: StorageProgram<A>,
  bindAs: string,
  second: StorageProgram<B>,
): StorageProgram<B> {
  return {
    instructions: [{ tag: 'bind', first, bindAs, second }],
    terminated: second.terminated,
    effects: mergeEffects(first.effects, second.effects),
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

/**
 * Classify program purity. Prefers structural effects accumulated during
 * construction (O(1)). Falls back to instruction-walk for deserialized
 * programs that lack structural effect data.
 */
export function classifyPurity(program: StorageProgram<unknown>): Purity {
  // Fast path: use structural effects if present
  if (program.effects && (program.effects.reads.size > 0 || program.effects.writes.size > 0)) {
    return purityOf(program);
  }
  // Also check if it's a genuinely pure program (effects exist but are empty)
  if (program.effects) {
    return purityOf(program);
  }
  // Fallback: walk instructions (for deserialized programs without effects)
  const reads = extractReadSet(program);
  const writes = extractWriteSet(program);
  if (writes.size > 0) return 'read-write';
  if (reads.size > 0) return 'read-only';
  return 'pure';
}

/** Serialize a program to a JSON-safe representation (including structural effects). */
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
    effects: {
      reads: [...(program.effects?.reads || [])],
      writes: [...(program.effects?.writes || [])],
    },
  });
}

/**
 * Validate that a program's structural effects match a declared purity level.
 * Returns null if valid, or an error message describing the violation.
 */
export function validatePurity(
  program: StorageProgram<unknown>,
  declaredPurity: Purity,
): string | null {
  const actualPurity = purityOf(program);

  if (declaredPurity === 'pure') {
    if (program.effects.reads.size > 0) {
      return `Declared pure but reads from: ${[...program.effects.reads].join(', ')}`;
    }
    if (program.effects.writes.size > 0) {
      return `Declared pure but writes to: ${[...program.effects.writes].join(', ')}`;
    }
  }

  if (declaredPurity === 'read-only') {
    if (program.effects.writes.size > 0) {
      return `Declared read-only but writes to: ${[...program.effects.writes].join(', ')}`;
    }
  }

  // 'read-write' is always valid — it's the most permissive level
  return null;
}
