// ============================================================
// TraversalInterpreter — VariableProgram Traversal Execution
//
// Applies typed access-path traversal instructions to a value
// produced by a source provider. Traversal is not pluggable:
// all source kinds produce values that this single interpreter
// can navigate via universal structural navigation.
//
// Instruction set: get, follow, at, first, count, keys.
// JSON string handling: get/follow auto-parse JSON strings.
// Type inference: schema-aware when schemaMetadata supplied.
//
// See Architecture doc Section 16.x (VariableProgram concept).
// ============================================================

// ─── Instruction Types ────────────────────────────────────────────────────────

export interface TraversalInstruction {
  /** Which navigation operation to apply. */
  kind: 'get' | 'follow' | 'at' | 'first' | 'count' | 'keys';
  /** Field name — required for 'get' and 'follow'. */
  field?: string;
  /** Array index — required for 'at'. */
  index?: number;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export type TraversalErrorCode =
  | 'not_a_list'
  | 'index_out_of_bounds'
  | 'field_not_found'
  | 'type_mismatch';

export class TraversalError extends Error {
  constructor(
    public readonly code: TraversalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TraversalError';
  }
}

// ─── Schema Metadata ─────────────────────────────────────────────────────────

/**
 * Optional schema metadata supplied to TraversalInterpreter for type inference.
 * Maps field/relation name → declared type string.
 *
 * Example:
 *   { title: 'string', author: 'User', tags: 'string[]' }
 */
export type SchemaMetadata = Record<string, string>;

// ─── TraversalInterpreter ─────────────────────────────────────────────────────

export class TraversalInterpreter {
  private readonly schemaMetadata: SchemaMetadata;

  /**
   * @param schemaMetadata - Optional field-name → type-string map for type inference.
   *   When omitted, get/follow type inference falls back to "unknown".
   */
  constructor(schemaMetadata?: SchemaMetadata) {
    this.schemaMetadata = schemaMetadata ?? {};
  }

  // ─── Core Execution ────────────────────────────────────────────────────────

  /**
   * Apply a single traversal instruction to the current value.
   * Returns the new value after traversal, or throws TraversalError.
   */
  applyStep(value: unknown, instruction: TraversalInstruction): unknown {
    switch (instruction.kind) {
      case 'get':
        return this._applyGet(value, instruction.field);

      case 'follow':
        // Structurally identical to get at runtime. The distinction is
        // semantic: follow signals a relation (entity reference or entity
        // reference array) rather than a scalar field. The type system
        // uses this to infer an entity output type rather than a scalar.
        return this._applyGet(value, instruction.field);

      case 'at':
        return this._applyAt(value, instruction.index);

      case 'first':
        return this._applyFirst(value);

      case 'count':
        return this._applyCount(value);

      case 'keys':
        return this._applyKeys(value);

      default: {
        const exhaustive: never = instruction.kind;
        throw new TraversalError('type_mismatch', `Unknown traversal kind: ${exhaustive}`);
      }
    }
  }

  /**
   * Apply a sequence of traversal instructions in order, threading the
   * output of each step into the input of the next.
   */
  applyAll(value: unknown, instructions: TraversalInstruction[]): unknown {
    let current = value;
    for (const instruction of instructions) {
      current = this.applyStep(current, instruction);
    }
    return current;
  }

  // ─── Type Inference ────────────────────────────────────────────────────────

  /**
   * Infer the output type string after applying one traversal step to an
   * input type. Used by VariableProgram/typeCheck for static analysis.
   *
   * Falls back to "unknown" when schema information is unavailable.
   */
  inferType(inputType: string, instruction: TraversalInstruction): string {
    switch (instruction.kind) {
      case 'count':
        return 'number';

      case 'keys':
        return 'string[]';

      case 'first':
      case 'at':
        return this._inferElementType(inputType);

      case 'get':
        return this._inferFieldType(inputType, instruction.field, 'scalar');

      case 'follow':
        return this._inferFieldType(inputType, instruction.field, 'relation');

      default: {
        const exhaustive: never = instruction.kind;
        void exhaustive;
        return 'unknown';
      }
    }
  }

  // ─── Private — Step Implementations ───────────────────────────────────────

  private _applyGet(value: unknown, field: string | undefined): unknown {
    if (field === undefined) {
      throw new TraversalError('field_not_found', 'get/follow instruction missing field name');
    }

    // null / undefined → propagate null
    if (value === null || value === undefined) {
      return null;
    }

    // JSON string → try to parse, then access field
    if (typeof value === 'string') {
      const parsed = this._tryParseJson(value);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return (parsed as Record<string, unknown>)[field] ?? null;
      }
      // String that is not a JSON object — treat as scalar, field is missing
      return null;
    }

    // Plain object
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return Object.prototype.hasOwnProperty.call(obj, field) ? obj[field] : null;
    }

    // Arrays and other primitives — field access is not meaningful
    return null;
  }

  private _applyAt(value: unknown, index: number | undefined): unknown {
    if (!Array.isArray(value)) {
      throw new TraversalError(
        'not_a_list',
        `at(${index}) requires an array; got ${this._typeName(value)}`,
      );
    }
    if (index === undefined || index < 0 || index >= value.length) {
      // Out of bounds — return null (callers use `fallback` transform for safety)
      return null;
    }
    return value[index];
  }

  private _applyFirst(value: unknown): unknown {
    if (!Array.isArray(value)) {
      throw new TraversalError(
        'not_a_list',
        `first() requires an array; got ${this._typeName(value)}`,
      );
    }
    return value.length > 0 ? value[0] : null;
  }

  private _applyCount(value: unknown): number {
    if (Array.isArray(value)) {
      return value.length;
    }
    if (typeof value === 'string') {
      return value.length;
    }
    if (value === null || value === undefined) {
      return 0;
    }
    throw new TraversalError(
      'not_a_list',
      `count() requires an array, string, or null; got ${this._typeName(value)}`,
    );
  }

  private _applyKeys(value: unknown): string[] {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>);
    }
    throw new TraversalError(
      'type_mismatch',
      `keys() requires a plain object; got ${this._typeName(value)}`,
    );
  }

  // ─── Private — Type Inference Helpers ─────────────────────────────────────

  /**
   * Infer element type from a list type string.
   *   "T[]"   → "T"
   *   "any[]" → "any"
   *   other   → "unknown"
   */
  private _inferElementType(inputType: string): string {
    if (inputType.endsWith('[]')) {
      return inputType.slice(0, -2);
    }
    return 'unknown';
  }

  /**
   * Infer output type for a field access on inputType.
   *
   * - If inputType is "ContentNode" (or any named entity type) and
   *   schemaMetadata declares the field, return the declared type.
   * - If inputType is "any" or "unknown", return "unknown".
   * - Otherwise return "unknown".
   *
   * `mode` distinguishes scalar ('scalar') from relation ('relation') access;
   * both look up schemaMetadata but the presence of a declared type carries
   * different semantics to callers.
   */
  private _inferFieldType(
    inputType: string,
    field: string | undefined,
    _mode: 'scalar' | 'relation',
  ): string {
    if (!field) return 'unknown';
    if (inputType === 'any' || inputType === 'unknown') return 'unknown';

    // Schema-aware lookup: works for ContentNode and any entity type
    // whose fields are declared in the injected schemaMetadata.
    const declared = this.schemaMetadata[field];
    if (declared !== undefined) {
      return declared;
    }

    return 'unknown';
  }

  // ─── Private — Utilities ──────────────────────────────────────────────────

  /**
   * Try to JSON.parse a string. Returns the parsed value on success, or
   * null on failure (including non-string inputs).
   */
  private _tryParseJson(str: string): unknown {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  private _typeName(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

/*
 * ─── Usage Examples (not runnable — documentation only) ──────────────────────
 *
 * const interp = new TraversalInterpreter({ title: 'string', author: 'User', tags: 'string[]' });
 *
 * // get — plain object field access
 * interp.applyStep({ title: 'Hello', author: 'u1' }, { kind: 'get', field: 'title' })
 * // → "Hello"
 *
 * // get — missing field returns null
 * interp.applyStep({ title: 'Hello' }, { kind: 'get', field: 'missing' })
 * // → null
 *
 * // get — null input returns null
 * interp.applyStep(null, { kind: 'get', field: 'title' })
 * // → null
 *
 * // get — JSON string input: parses first, then accesses field
 * interp.applyStep('{"title":"Hello"}', { kind: 'get', field: 'title' })
 * // → "Hello"
 *
 * // get — non-JSON string: field access returns null (not a throw)
 * interp.applyStep('plain string', { kind: 'get', field: 'title' })
 * // → null
 *
 * // follow — structurally identical to get at runtime
 * interp.applyStep({ author: 'user-id-42' }, { kind: 'follow', field: 'author' })
 * // → "user-id-42"
 *
 * // at — array index
 * interp.applyStep(['a', 'b', 'c'], { kind: 'at', index: 1 })
 * // → "b"
 *
 * // at — index out of bounds returns null (does not throw)
 * interp.applyStep(['a', 'b'], { kind: 'at', index: 5 })
 * // → null
 *
 * // at — non-array throws TraversalError('not_a_list', ...)
 * interp.applyStep('hello', { kind: 'at', index: 0 })
 * // throws TraversalError { code: 'not_a_list' }
 *
 * // first — first element or null if empty
 * interp.applyStep([10, 20, 30], { kind: 'first' })
 * // → 10
 * interp.applyStep([], { kind: 'first' })
 * // → null
 *
 * // count — array length
 * interp.applyStep([1, 2, 3], { kind: 'count' })
 * // → 3
 *
 * // count — string length
 * interp.applyStep('hello', { kind: 'count' })
 * // → 5
 *
 * // count — null/undefined → 0
 * interp.applyStep(null, { kind: 'count' })
 * // → 0
 *
 * // count — number throws TraversalError('not_a_list', ...)
 * interp.applyStep(42, { kind: 'count' })
 * // throws TraversalError { code: 'not_a_list' }
 *
 * // keys — plain object
 * interp.applyStep({ a: 1, b: 2 }, { kind: 'keys' })
 * // → ['a', 'b']
 *
 * // keys — non-object throws TraversalError('type_mismatch', ...)
 * interp.applyStep([1, 2], { kind: 'keys' })
 * // throws TraversalError { code: 'type_mismatch' }
 *
 * // applyAll — chain multiple steps
 * interp.applyAll(
 *   { users: [{ name: 'Alice' }, { name: 'Bob' }] },
 *   [
 *     { kind: 'get', field: 'users' },
 *     { kind: 'first' },
 *     { kind: 'get', field: 'name' },
 *   ]
 * )
 * // → "Alice"
 *
 * // inferType — schema-aware field type
 * interp.inferType('ContentNode', { kind: 'get', field: 'title' })
 * // → "string"  (because schemaMetadata.title === 'string')
 *
 * // inferType — relation field
 * interp.inferType('ContentNode', { kind: 'follow', field: 'author' })
 * // → "User"  (because schemaMetadata.author === 'User')
 *
 * // inferType — unknown field
 * interp.inferType('ContentNode', { kind: 'get', field: 'unknownField' })
 * // → "unknown"
 *
 * // inferType — element extraction from list type
 * interp.inferType('User[]', { kind: 'first' })
 * // → "User"
 * interp.inferType('string[]', { kind: 'at', index: 0 })
 * // → "string"
 *
 * // inferType — count always returns "number"
 * interp.inferType('string[]', { kind: 'count' })
 * // → "number"
 * interp.inferType('any', { kind: 'count' })
 * // → "number"
 *
 * // inferType — keys always returns "string[]"
 * interp.inferType('ContentNode', { kind: 'keys' })
 * // → "string[]"
 *
 * // inferType — any/unknown input type → "unknown" for get/follow
 * interp.inferType('unknown', { kind: 'get', field: 'title' })
 * // → "unknown"
 * ────────────────────────────────────────────────────────────────────────────
 */
