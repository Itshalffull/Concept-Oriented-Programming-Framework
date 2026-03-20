// ============================================================
// StorageProgram — Free Monad DSL for Concept Handlers
// ============================================================
//
// A StorageProgram<A> is a description of storage operations that
// produces a value of type A when interpreted. Handlers build programs
// using the DSL functions below; the interpreter in interpreter.ts
// executes them against a real ConceptStorage backend.

// --- Lens Types ---

/** A single segment in a lens path. */
export type LensSegment =
  | { kind: 'relation'; name: string }
  | { kind: 'key'; value: string }
  | { kind: 'field'; name: string };

/**
 * A typed, composable reference to a location within concept state.
 * Replaces untyped string-based relation/key/field access with a
 * first-class optic that can be composed, decomposed, and validated.
 */
export interface StateLens {
  readonly segments: readonly LensSegment[];
  readonly sourceType: string;
  readonly focusType: string;
}

/** A single storage instruction in the program tree. */
export type Instruction =
  | { tag: 'get'; relation: string; key: string; bindAs: string }
  | { tag: 'find'; relation: string; criteria: Record<string, unknown>; bindAs: string }
  | { tag: 'put'; relation: string; key: string; value: Record<string, unknown> }
  | { tag: 'merge'; relation: string; key: string; fields: Record<string, unknown> }
  | { tag: 'del'; relation: string; key: string }
  | { tag: 'delMany'; relation: string; criteria: Record<string, unknown>; bindAs: string }
  | { tag: 'delManyFrom'; relation: string; criteriaFn: (bindings: Bindings) => Record<string, unknown>; bindAs: string }
  | { tag: 'delFrom'; relation: string; keyFn: (bindings: Bindings) => string }
  | { tag: 'putFrom'; relation: string; key: string; valueFn: (bindings: Bindings) => Record<string, unknown> }
  | { tag: 'mergeFrom'; relation: string; key: string; fieldsFn: (bindings: Bindings) => Record<string, unknown> }
  | { tag: 'getLens'; lens: StateLens; bindAs: string }
  | { tag: 'putLens'; lens: StateLens; value: Record<string, unknown> }
  | { tag: 'modifyLens'; lens: StateLens; fn: (bindings: Bindings) => Record<string, unknown> }
  | { tag: 'perform'; protocol: string; operation: string; payload: Record<string, unknown>; bindAs: string }
  | { tag: 'performFrom'; protocol: string; operation: string; payloadFn: (bindings: Bindings) => Record<string, unknown>; bindAs: string }
  | { tag: 'branch'; condition: (bindings: Bindings) => boolean; thenBranch: StorageProgram<unknown>; elseBranch: StorageProgram<unknown> }
  | { tag: 'mapBindings'; fn: (bindings: Bindings) => unknown; bindAs: string }
  | { tag: 'pure'; value: unknown }
  | { tag: 'pureFrom'; fn: (bindings: Bindings) => unknown }
  | { tag: 'bind'; first: StorageProgram<unknown>; bindAs: string; second: StorageProgram<unknown> }
  | { tag: 'traverse'; sourceBinding: string; itemBinding: string; body: (item: unknown, bindings: Bindings) => StorageProgram<unknown>; bindAs: string };

/** Runtime bindings accumulated during interpretation. */
export type Bindings = Record<string, unknown>;

/** Effect set tracking storage, transport, and completion effects structurally. */
export interface EffectSet {
  readonly reads: ReadonlySet<string>;
  readonly writes: ReadonlySet<string>;
  readonly completionVariants: ReadonlySet<string>;
  readonly performs: ReadonlySet<string>;
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
  return { reads: new Set(), writes: new Set(), completionVariants: new Set(), performs: new Set() };
}

/** Merge two effect sets (union of all dimensions). */
function mergeEffects(a: EffectSet, b: EffectSet): EffectSet {
  return {
    reads: new Set([...a.reads, ...b.reads]),
    writes: new Set([...a.writes, ...b.writes]),
    completionVariants: new Set([...a.completionVariants, ...b.completionVariants]),
    performs: new Set([...a.performs, ...b.performs]),
  };
}

/** Add a read relation to an effect set. */
function addRead(effects: EffectSet, relation: string): EffectSet {
  const reads = new Set(effects.reads);
  reads.add(relation);
  return { reads, writes: effects.writes, completionVariants: effects.completionVariants, performs: effects.performs };
}

/** Add a write relation to an effect set. */
function addWrite(effects: EffectSet, relation: string): EffectSet {
  const writes = new Set(effects.writes);
  writes.add(relation);
  return { reads: effects.reads, writes, completionVariants: effects.completionVariants, performs: effects.performs };
}

/** Add both a read and write relation (for merge/mergeFrom). */
function addReadWrite(effects: EffectSet, relation: string): EffectSet {
  const reads = new Set(effects.reads);
  reads.add(relation);
  const writes = new Set(effects.writes);
  writes.add(relation);
  return { reads, writes, completionVariants: effects.completionVariants, performs: effects.performs };
}

/** Add a completion variant tag to an effect set. */
function addCompletionVariant(effects: EffectSet, variant: string): EffectSet {
  const completionVariants = new Set(effects.completionVariants);
  completionVariants.add(variant);
  return { reads: effects.reads, writes: effects.writes, completionVariants, performs: effects.performs };
}

/** Add a transport effect (protocol:operation) to an effect set. */
function addPerform(effects: EffectSet, protocol: string, operation: string): EffectSet {
  const performs = new Set(effects.performs);
  performs.add(`${protocol}:${operation}`);
  return { reads: effects.reads, writes: effects.writes, completionVariants: effects.completionVariants, performs };
}

// --- Lens Builders ---

/** Extract the relation name from the first segment of a lens. */
function lensRelation(lens: StateLens): string {
  const first = lens.segments[0];
  if (!first || first.kind !== 'relation') {
    throw new Error('Lens must start with a relation segment');
  }
  return first.name;
}

/** Create a relation-level lens focusing on an entire storage relation. */
export function relation(name: string): StateLens {
  return {
    segments: [{ kind: 'relation', name }],
    sourceType: 'store',
    focusType: `relation<${name}>`,
  };
}

/** Compose two lenses by concatenating their segments. */
export function composeLens(outer: StateLens, inner: StateLens): StateLens {
  return {
    segments: [...outer.segments, ...inner.segments],
    sourceType: outer.sourceType,
    focusType: inner.focusType,
  };
}

/** Narrow a lens to a specific record by key. */
export function at(lens: StateLens, key: string): StateLens {
  return {
    segments: [...lens.segments, { kind: 'key', value: key }],
    sourceType: lens.sourceType,
    focusType: `record`,
  };
}

/** Narrow a lens to a specific field within a record. */
export function field(lens: StateLens, name: string): StateLens {
  return {
    segments: [...lens.segments, { kind: 'field', name }],
    sourceType: lens.sourceType,
    focusType: name,
  };
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

/** Append a DelMany instruction — delete all records matching criteria. Adds relation to write effects. Binds the deletion count. */
export function delMany(
  program: StorageProgram<unknown>,
  relation: string,
  criteria: Record<string, unknown>,
  bindAs: string,
): StorageProgram<number> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'delMany', relation, criteria, bindAs }],
    terminated: false,
    effects: addWrite(program.effects, relation),
  };
}

/** Append a DelMany instruction with criteria derived from bindings at runtime. Adds relation to write effects. Binds the deletion count. */
export function delManyFrom(
  program: StorageProgram<unknown>,
  relation: string,
  criteriaFn: (bindings: Bindings) => Record<string, unknown>,
  bindAs: string,
): StorageProgram<number> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'delManyFrom', relation, criteriaFn, bindAs }],
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

/** Append a GetLens instruction — read through a lens. Adds lens relation to read effects. */
export function getLens(
  program: StorageProgram<unknown>,
  lens: StateLens,
  bindAs: string,
): StorageProgram<Record<string, unknown> | null> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'getLens', lens, bindAs }],
    terminated: false,
    effects: addRead(program.effects, lensRelation(lens)),
  };
}

/** Append a PutLens instruction — write through a lens. Adds lens relation to write effects. */
export function putLens(
  program: StorageProgram<unknown>,
  lens: StateLens,
  value: Record<string, unknown>,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'putLens', lens, value }],
    terminated: false,
    effects: addWrite(program.effects, lensRelation(lens)),
  };
}

/** Append a ModifyLens instruction — read-modify-write through a lens. Adds lens relation to both effects. */
export function modifyLens(
  program: StorageProgram<unknown>,
  lens: StateLens,
  fn: (bindings: Bindings) => Record<string, unknown>,
): StorageProgram<void> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'modifyLens', lens, fn }],
    terminated: false,
    effects: addReadWrite(program.effects, lensRelation(lens)),
  };
}

/**
 * Append a Perform instruction — an abstract transport effect.
 * The handler declares "I need to call protocol:operation" without knowing
 * the concrete transport implementation. The interpreter resolves it
 * through a registered EffectHandler at execution time.
 * Adds protocol:operation to the performs effect set.
 */
export function perform(
  program: StorageProgram<unknown>,
  protocol: string,
  operation: string,
  payload: Record<string, unknown>,
  bindAs: string,
): StorageProgram<Record<string, unknown>> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'perform', protocol, operation, payload, bindAs }],
    terminated: false,
    effects: addPerform(program.effects, protocol, operation),
  };
}

/**
 * Append a Perform instruction with payload derived from bindings at runtime.
 * Adds protocol:operation to the performs effect set.
 */
export function performFrom(
  program: StorageProgram<unknown>,
  protocol: string,
  operation: string,
  payloadFn: (bindings: Bindings) => Record<string, unknown>,
  bindAs: string,
): StorageProgram<Record<string, unknown>> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'performFrom', protocol, operation, payloadFn, bindAs }],
    terminated: false,
    effects: addPerform(program.effects, protocol, operation),
  };
}

/** Append a conditional branch. Merges effects from both branches (conservative). */
export function branch<A>(
  program: StorageProgram<unknown>,
  condition: string | ((bindings: Bindings) => boolean),
  thenBranch: StorageProgram<A> | ((p: StorageProgram<unknown>) => StorageProgram<A>),
  elseBranch: StorageProgram<A> | ((p: StorageProgram<unknown>) => StorageProgram<A>),
): StorageProgram<A> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');

  // Support string binding name as shorthand for (bindings) => !!bindings[name]
  const conditionFn: (bindings: Bindings) => boolean =
    typeof condition === 'string'
      ? (bindings: Bindings) => !!bindings[condition]
      : condition;

  // Support builder callbacks: (emptyProgram) => StorageProgram
  const base = createProgram();
  const thenProg: StorageProgram<A> =
    typeof thenBranch === 'function' ? thenBranch(base) : thenBranch;
  const elseProg: StorageProgram<A> =
    typeof elseBranch === 'function' ? elseBranch(base) : elseBranch;

  return {
    instructions: [...program.instructions, { tag: 'branch', condition: conditionFn, thenBranch: thenProg, elseBranch: elseProg }],
    terminated: false,
    effects: mergeEffects(program.effects, mergeEffects(thenProg.effects, elseProg.effects)),
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

/**
 * Terminate the program with a named variant completion, tracking the variant
 * in the structural effect set. This is the algebraic-effect-aware terminal —
 * use it instead of pure() when you want exhaustiveness checking of sync coverage.
 */
export function complete<A extends Record<string, unknown>>(
  program: StorageProgram<unknown>,
  variant: string,
  output: A,
): StorageProgram<{ variant: string } & A> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'pure', value: { variant, ...output } }],
    terminated: true,
    effects: addCompletionVariant(program.effects, variant),
  };
}

/**
 * Terminate the program with a named variant completion derived from bindings.
 * Like complete() but the output is computed at interpretation time from accumulated bindings.
 */
export function completeFrom(
  program: StorageProgram<unknown>,
  variant: string,
  fn: (bindings: Bindings) => Record<string, unknown>,
): StorageProgram<{ variant: string; [key: string]: unknown }> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');
  return {
    instructions: [...program.instructions, { tag: 'pureFrom', fn: (bindings: Bindings) => ({ variant, ...fn(bindings) }) }],
    terminated: true,
    effects: addCompletionVariant(program.effects, variant),
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

/**
 * Traverse a bound array (typically from a prior `find`), applying a
 * program-producing function to each element. The sub-programs run
 * sequentially, and the collected results are bound to `bindAs`.
 *
 * This is the monadic `traverse`/`mapM` pattern — the standard way
 * to express "find N records, do something to each" purely.
 *
 * Example:
 *   let p = createProgram();
 *   p = find(p, 'entries', {}, 'allEntries');
 *   p = traverse(p, 'allEntries', 'entry', (item, _bindings) => {
 *     const entry = item as Record<string, unknown>;
 *     let sub = createProgram();
 *     sub = put(sub, 'entries', entry.key as string, { ...entry, stale: true });
 *     return complete(sub, 'ok', { key: entry.key });
 *   }, 'results');
 *
 * When the body accesses item properties that are undefined on the sentinel,
 * pass declared effects so static analysis doesn't need to run the body:
 *
 *   p = traverse(p, 'allEntries', 'entry', (item) => { ... }, 'results', {
 *     reads: ['entries'],
 *     writes: ['entries'],
 *     completionVariants: ['invalidated', 'skipped'],
 *   });
 */
export interface TraverseDeclaredEffects {
  reads?: string[];
  writes?: string[];
  completionVariants?: string[];
  performs?: string[];
}

export function traverse<A>(
  program: StorageProgram<unknown>,
  sourceBinding: string,
  itemBinding: string,
  body: (item: unknown, bindings: Bindings) => StorageProgram<A>,
  bindAs: string,
  declaredEffects?: TraverseDeclaredEffects,
): StorageProgram<unknown> {
  if (program.terminated) throw new Error('Program is sealed — cannot append after pure()');

  let bodyEffects: EffectSet;
  if (declaredEffects) {
    // Use structurally declared effects — no sentinel execution needed.
    bodyEffects = {
      reads: new Set(declaredEffects.reads || []),
      writes: new Set(declaredEffects.writes || []),
      completionVariants: new Set(declaredEffects.completionVariants || []),
      performs: new Set(declaredEffects.performs || []),
    };
  } else {
    // Fall back to running body with sentinel data to extract effects.
    try {
      bodyEffects = body({}, {}).effects;
    } catch {
      bodyEffects = emptyEffects();
    }
  }

  return {
    instructions: [...program.instructions, { tag: 'traverse', sourceBinding, itemBinding, body, bindAs, declaredEffects: declaredEffects || undefined }],
    terminated: false,
    effects: mergeEffects(program.effects, bodyEffects),
  };
}

// --- Analysis Helpers ---

/** Extract the set of relations read by the program. */
export function extractReadSet(program: StorageProgram<unknown>): Set<string> {
  const reads = new Set<string>();
  for (const instr of program.instructions) {
    if (instr.tag === 'get' || instr.tag === 'find') reads.add(instr.relation);
    if (instr.tag === 'getLens') reads.add(lensRelation(instr.lens));
    // merge/mergeFrom/modifyLens reads the existing record before writing
    if (instr.tag === 'merge' || instr.tag === 'mergeFrom') reads.add(instr.relation);
    if (instr.tag === 'modifyLens') reads.add(lensRelation(instr.lens));
    if (instr.tag === 'branch') {
      for (const r of extractReadSet(instr.thenBranch)) reads.add(r);
      for (const r of extractReadSet(instr.elseBranch)) reads.add(r);
    }
    if (instr.tag === 'bind') {
      for (const r of extractReadSet(instr.first)) reads.add(r);
      for (const r of extractReadSet(instr.second)) reads.add(r);
    }
    if (instr.tag === 'traverse') {
      if (instr.declaredEffects?.reads) {
        for (const r of instr.declaredEffects.reads) reads.add(r);
      } else {
        let sample: StorageProgram<unknown> | null = null; try { sample = instr.body({}, {}); } catch { /* body threw on sentinel */ }
        if (sample) for (const r of extractReadSet(sample)) reads.add(r);
      }
    }
  }
  return reads;
}

/** Extract the set of relations written by the program. */
export function extractWriteSet(program: StorageProgram<unknown>): Set<string> {
  const writes = new Set<string>();
  for (const instr of program.instructions) {
    if (instr.tag === 'put' || instr.tag === 'del' || instr.tag === 'merge' || instr.tag === 'delFrom' || instr.tag === 'delMany' || instr.tag === 'delManyFrom' || instr.tag === 'putFrom' || instr.tag === 'mergeFrom') writes.add(instr.relation);
    if (instr.tag === 'putLens' || instr.tag === 'modifyLens') writes.add(lensRelation(instr.lens));
    if (instr.tag === 'branch') {
      for (const w of extractWriteSet(instr.thenBranch)) writes.add(w);
      for (const w of extractWriteSet(instr.elseBranch)) writes.add(w);
    }
    if (instr.tag === 'bind') {
      for (const w of extractWriteSet(instr.first)) writes.add(w);
      for (const w of extractWriteSet(instr.second)) writes.add(w);
    }
    if (instr.tag === 'traverse') {
      if (instr.declaredEffects?.writes) {
        for (const w of instr.declaredEffects.writes) writes.add(w);
      } else {
        let sample: StorageProgram<unknown> | null = null; try { sample = instr.body({}, {}); } catch { /* body threw on sentinel */ }
        if (sample) for (const w of extractWriteSet(sample)) writes.add(w);
      }
    }
  }
  return writes;
}

/** Extract the set of completion variant tags reachable from the program's instruction tree. */
export function extractCompletionVariants(program: StorageProgram<unknown>): Set<string> {
  const variants = new Set<string>();
  for (const instr of program.instructions) {
    if (instr.tag === 'pure' && instr.value && typeof instr.value === 'object' && 'variant' in (instr.value as Record<string, unknown>)) {
      variants.add((instr.value as Record<string, unknown>).variant as string);
    }
    if (instr.tag === 'branch') {
      for (const v of extractCompletionVariants(instr.thenBranch)) variants.add(v);
      for (const v of extractCompletionVariants(instr.elseBranch)) variants.add(v);
    }
    if (instr.tag === 'bind') {
      for (const v of extractCompletionVariants(instr.first)) variants.add(v);
      for (const v of extractCompletionVariants(instr.second)) variants.add(v);
    }
    if (instr.tag === 'traverse') {
      if (instr.declaredEffects?.completionVariants) {
        for (const v of instr.declaredEffects.completionVariants) variants.add(v);
      } else {
        let sample: StorageProgram<unknown> | null = null; try { sample = instr.body({}, {}); } catch { /* body threw on sentinel */ }
        if (sample) for (const v of extractCompletionVariants(sample)) variants.add(v);
      }
    }
  }
  return variants;
}

/** Extract the set of transport effects (protocol:operation) from the program's instruction tree. */
export function extractPerformSet(program: StorageProgram<unknown>): Set<string> {
  const performs = new Set<string>();
  for (const instr of program.instructions) {
    if (instr.tag === 'perform' || instr.tag === 'performFrom') {
      performs.add(`${instr.protocol}:${instr.operation}`);
    }
    if (instr.tag === 'branch') {
      for (const p of extractPerformSet(instr.thenBranch)) performs.add(p);
      for (const p of extractPerformSet(instr.elseBranch)) performs.add(p);
    }
    if (instr.tag === 'bind') {
      for (const p of extractPerformSet(instr.first)) performs.add(p);
      for (const p of extractPerformSet(instr.second)) performs.add(p);
    }
    if (instr.tag === 'traverse') {
      if (instr.declaredEffects?.performs) {
        for (const p of instr.declaredEffects.performs) performs.add(p);
      } else {
        let sample: StorageProgram<unknown> | null = null; try { sample = instr.body({}, {}); } catch { /* body threw on sentinel */ }
        if (sample) for (const p of extractPerformSet(sample)) performs.add(p);
      }
    }
  }
  return performs;
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
      if (instr.tag === 'modifyLens') {
        return { ...instr, fn: instr.fn.toString() };
      }
      if (instr.tag === 'performFrom') {
        return { ...instr, payloadFn: instr.payloadFn.toString() };
      }
      if (instr.tag === 'traverse') {
        let bodyStr = '(empty)';
        try { bodyStr = serializeProgram(instr.body({}, {})); } catch { /* body threw on sentinel */ }
        return {
          tag: 'traverse', sourceBinding: instr.sourceBinding, itemBinding: instr.itemBinding,
          bindAs: instr.bindAs, body: bodyStr,
          ...(instr.declaredEffects ? { declaredEffects: instr.declaredEffects } : {}),
        };
      }
      return instr;
    }),
    terminated: program.terminated,
    effects: {
      reads: [...(program.effects?.reads || [])],
      writes: [...(program.effects?.writes || [])],
      completionVariants: [...(program.effects?.completionVariants || [])],
      performs: [...(program.effects?.performs || [])],
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
