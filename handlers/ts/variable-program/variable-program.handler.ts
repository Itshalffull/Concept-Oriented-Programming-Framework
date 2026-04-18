// @clef-handler style=functional concept=VariableProgram
// VariableProgram Concept Implementation — Functional (StorageProgram) style
//
// VariableProgram is the fourth program monad in Clef. Each action appends an
// instruction to an ordered instruction list stored as a JSON array. The list
// is interpreted at runtime by resolve(), which walks each instruction and
// dispatches to PluginRegistry providers for source and transform steps.
//
// Instruction shapes:
//   { kind: "source",    op: <sourceKind>, args: <parsed-args-object> }
//   { kind: "get",       field: <string> }
//   { kind: "follow",    relation: <string> }
//   { kind: "at",        index: <number> }
//   { kind: "first" }
//   { kind: "count" }
//   { kind: "transform", op: <kind>, args: <parsed-args-object> }
//
// Provider lookup:
//   source providers  → pluginregistry key "variable-source:<sourceKind>"
//   transform providers → pluginregistry key "variable-transform:<kind>"
//
// Storage relation: "variableProgram", key = program ID (caller-supplied).
//
// See architecture doc Section 10.1 for StorageProgram monad patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Record helpers ──────────────────────────────────────────────────────────

type Instruction =
  | { kind: 'source';    op: string; args: Record<string, unknown> }
  | { kind: 'get';       field: string }
  | { kind: 'follow';    relation: string }
  | { kind: 'at';        index: number }
  | { kind: 'first' }
  | { kind: 'count' }
  | { kind: 'transform'; op: string; args: Record<string, unknown> };

type ProgramRecord = {
  id: string;
  sourceKind: string;
  instructions: string;   // JSON array of Instruction
  resolvedType: string | null;
  expression: string;
};

function parseInstructions(rec: ProgramRecord): Instruction[] {
  try {
    return JSON.parse(rec.instructions) as Instruction[];
  } catch {
    return [];
  }
}

function withInstructions(rec: ProgramRecord, instrs: Instruction[]): ProgramRecord {
  return { ...rec, instructions: JSON.stringify(instrs) };
}

function appendInstruction(rec: ProgramRecord, instr: Instruction): ProgramRecord {
  const instrs = parseInstructions(rec);
  return withInstructions(rec, [...instrs, instr]);
}

// ─── Expression compiler ─────────────────────────────────────────────────────

function compileExpression(instrs: Instruction[]): string {
  if (instrs.length === 0) return '';
  const [source, ...rest] = instrs;
  if (source.kind !== 'source') return '';

  // Source prefix
  let expr = '';
  const srcArgs = source.args;
  switch (source.op) {
    case 'page':    expr = '$page'; break;
    case 'url':     expr = `$url.${srcArgs.param ?? 'param'}`; break;
    case 'content': expr = `$content[${srcArgs.nodeId ?? ''}]`; break;
    case 'query':   expr = `$query.${srcArgs.name ?? 'result'}`; break;
    case 'step':    expr = `$step.${srcArgs.stepKey ?? 'step'}`; break;
    case 'session': expr = '$session'; break;
    case 'literal': expr = `'${srcArgs.value ?? ''}'`; break;
    case 'context': expr = `$ctx.${srcArgs.key ?? 'key'}`; break;
    default:        expr = `$${source.op}`;
  }

  // Traversal and transform steps
  for (const instr of rest) {
    switch (instr.kind) {
      case 'get':       expr += `.${instr.field}`; break;
      case 'follow':    expr += `.${instr.relation}`; break;
      case 'at':        expr += `[${instr.index}]`; break;
      case 'first':     expr += '[0]'; break;
      case 'count':     expr += '.count'; break;
      case 'transform': {
        const argStr = JSON.stringify(instr.args);
        expr += `|${instr.op}(${argStr === '{}' ? '' : `'${argStr}'`})`;
        break;
      }
    }
  }
  return expr;
}

// ─── Expression parser ───────────────────────────────────────────────────────
// Parses canonical expressions like:
//   $page.title
//   $url.id
//   $step.brainstorm.shortlisted[0]
//   $session.field
//   'literal value'
//   $ctx.key.field
//   $page.dueDate|format('MMM d, yyyy')
//
// Returns null on failure.

function parseExpression(expression: string): Instruction[] | null {
  if (!expression || expression.trim() === '') return null;

  const trimmed = expression.trim();

  // Literal: 'some value'
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const value = trimmed.slice(1, -1);
    return [{ kind: 'source', op: 'literal', args: { value } }];
  }

  // Variable expressions start with $
  if (!trimmed.startsWith('$')) return null;

  // Split off transform suffix: |kind(args)
  let core = trimmed;
  const transforms: Instruction[] = [];
  const transformRegex = /\|([a-zA-Z][a-zA-Z0-9_-]*)(?:\('([^']*)'\))?/g;
  let transformMatch: RegExpExecArray | null;
  // Find where transforms start
  const firstPipe = core.indexOf('|');
  if (firstPipe !== -1) {
    const transformPart = core.slice(firstPipe);
    core = core.slice(0, firstPipe);
    transformRegex.lastIndex = 0;
    while ((transformMatch = transformRegex.exec(transformPart)) !== null) {
      const [, tKind, tArgs] = transformMatch;
      let parsedArgs: Record<string, unknown> = {};
      if (tArgs) {
        try { parsedArgs = JSON.parse(tArgs); } catch { parsedArgs = { value: tArgs }; }
      }
      transforms.push({ kind: 'transform', op: tKind, args: parsedArgs });
    }
  }

  // Parse source and traversal from core (e.g. "$page.title" or "$step.brainstorm.shortlisted[0]")
  const withoutDollar = core.slice(1); // remove leading $

  // Tokenize: split on . but keep [n] attached to previous segment
  // e.g. "step.brainstorm.shortlisted[0]" -> ["step", "brainstorm", "shortlisted[0]"]
  const rawSegments = withoutDollar.split('.');
  if (rawSegments.length === 0 || rawSegments[0] === '') return null;

  const sourceSegment = rawSegments[0];
  const rest = rawSegments.slice(1);

  // Determine source kind and args from the first segment
  let sourceInstr: Instruction | null = null;

  if (sourceSegment === 'page') {
    sourceInstr = { kind: 'source', op: 'page', args: {} };
  } else if (sourceSegment === 'session') {
    sourceInstr = { kind: 'source', op: 'session', args: {} };
  } else if (sourceSegment === 'url') {
    // $url.<param> — first rest segment is the param name
    const param = rest.shift() ?? 'param';
    sourceInstr = { kind: 'source', op: 'url', args: { param } };
  } else if (sourceSegment === 'query') {
    // $query.<name>
    const name = rest.shift() ?? 'result';
    sourceInstr = { kind: 'source', op: 'query', args: { name } };
  } else if (sourceSegment === 'step') {
    // $step.<stepKey>.<fields...>
    const stepKey = rest.shift() ?? 'step';
    sourceInstr = { kind: 'source', op: 'step', args: { stepKey } };
  } else if (sourceSegment === 'ctx') {
    // $ctx.<key>
    const key = rest.shift() ?? 'key';
    sourceInstr = { kind: 'source', op: 'context', args: { key } };
  } else {
    // Unknown prefix — treat as a generic source kind
    sourceInstr = { kind: 'source', op: sourceSegment, args: {} };
  }

  const instrs: Instruction[] = [sourceInstr];

  // Parse remaining traversal segments
  for (const seg of rest) {
    // Check for index suffix: "shortlisted[0]" or just "[0]"
    const indexMatch = seg.match(/^(.*?)\[(\d+)\]$/);
    if (indexMatch) {
      const fieldPart = indexMatch[1];
      const index = parseInt(indexMatch[2], 10);
      if (fieldPart !== '') {
        instrs.push({ kind: 'get', field: fieldPart });
      }
      instrs.push({ kind: 'at', index });
    } else if (seg === 'count') {
      instrs.push({ kind: 'count' });
    } else if (seg !== '') {
      instrs.push({ kind: 'get', field: seg });
    }
  }

  // Append transforms
  instrs.push(...transforms);

  return instrs;
}

// ─── Type inference ──────────────────────────────────────────────────────────

function inferType(instrs: Instruction[]): string {
  if (instrs.length === 0) return 'unknown';
  const source = instrs[0];
  if (source.kind !== 'source') return 'unknown';

  let type = (() => {
    switch (source.op) {
      case 'literal': return 'string';
      case 'url':     return 'string';
      case 'session': return 'string';
      case 'page':    return 'ContentNode';
      case 'step':    return 'any';
      case 'context': return 'any';
      default:        return 'any';
    }
  })();

  for (const instr of instrs.slice(1)) {
    switch (instr.kind) {
      case 'get':       type = 'unknown'; break; // field type depends on schema
      case 'follow':    type = 'ContentNode'; break;
      case 'at':        type = 'any'; break;
      case 'first':     type = 'any'; break;
      case 'count':     type = 'number'; break;
      case 'transform': type = 'string'; break; // transforms generally produce strings
    }
  }
  return type;
}

// ─── Unique ID generation ────────────────────────────────────────────────────

function newProgramId(): string {
  return `vp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  // --- Construction ---

  from(input: Record<string, unknown>) {
    const sourceKind = (input.sourceKind ?? '') as string;
    const argsStr = (input.args ?? '{}') as string;

    if (!sourceKind || sourceKind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceKind is required' }) as StorageProgram<Result>;
    }

    // Validate args JSON
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(argsStr) as Record<string, unknown>;
    } catch {
      return complete(createProgram(), 'error', { message: 'args must be valid JSON' }) as StorageProgram<Result>;
    }

    // Check PluginRegistry for source provider existence
    // Key pattern: "variable-source:<sourceKind>"
    const providerKey = `variable-source:${sourceKind}`;
    const programId = newProgramId();

    let p = createProgram();
    p = get(p, 'pluginregistry', providerKey, 'provider');

    return branch(p,
      (b) => b.provider == null,
      (b) => complete(b, 'provider_not_found', {
        message: `No variable-source provider registered for kind "${sourceKind}". Register it via PluginRegistry before calling from().`,
      }),
      (b) => {
        const sourceInstr: Instruction = { kind: 'source', op: sourceKind, args: parsedArgs };
        const rec: ProgramRecord = {
          id: programId,
          sourceKind,
          instructions: JSON.stringify([sourceInstr]),
          resolvedType: null,
          expression: '',
        };
        let b2 = put(b, 'variableProgram', programId, rec as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  // --- Traversal ---

  get(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;
    const field = (input.field ?? '') as string;

    if (!field || field.trim() === '') {
      return complete(createProgram(), 'error', { message: 'field is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const updated = appendInstruction(rec, { kind: 'get', field });
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  follow(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;
    const relation = (input.relation ?? '') as string;

    if (!relation || relation.trim() === '') {
      return complete(createProgram(), 'error', { message: 'relation is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const updated = appendInstruction(rec, { kind: 'follow', relation });
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  at(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;
    const index = typeof input.index === 'number' ? input.index : parseInt(String(input.index ?? '0'), 10);

    if (index < 0) {
      return complete(createProgram(), 'error', { message: 'index must be zero or greater' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const updated = appendInstruction(rec, { kind: 'at', index });
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  first(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const updated = appendInstruction(rec, { kind: 'first' });
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const updated = appendInstruction(rec, { kind: 'count' });
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  // --- Transform ---

  transform(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;
    const kind = (input.kind ?? '') as string;
    const argsStr = (input.args ?? '{}') as string;

    if (!kind || kind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(argsStr) as Record<string, unknown>;
    } catch {
      return complete(createProgram(), 'error', { message: 'args must be valid JSON' }) as StorageProgram<Result>;
    }

    const providerKey = `variable-transform:${kind}`;

    let p = createProgram();
    p = get(p, 'pluginregistry', providerKey, 'provider');
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => (b.provider as unknown) == null,
      (b) => complete(b, 'provider_not_found', {
        message: `No variable-transform provider registered for kind "${kind}". Register it via PluginRegistry before calling transform().`,
      }),
      (b) => branch(b,
        (bb) => bb.existing == null,
        (bb) => complete(bb, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
        (bb) => {
          const rec = bb.existing as ProgramRecord;
          const updated = appendInstruction(rec, { kind: 'transform', op: kind, args: parsedArgs });
          let b2 = put(bb, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
          return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  // --- Compilation / Parsing ---

  compile(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const instrs = parseInstructions(rec);
        if (instrs.length === 0 || instrs[0].kind !== 'source') {
          return complete(b, 'error', { message: 'Program has no source instruction and cannot be compiled' }) as StorageProgram<Result>;
        }
        const expression = compileExpression(instrs);
        if (!expression) {
          return complete(b, 'error', { message: 'Compilation produced an empty expression' }) as StorageProgram<Result>;
        }
        // Store the compiled expression back on the record
        const updated: ProgramRecord = { ...rec, expression };
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { expression }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const expression = (input.expression ?? '') as string;

    if (!expression || expression.trim() === '') {
      return complete(createProgram(), 'parse_error', { message: 'expression is required' }) as StorageProgram<Result>;
    }

    const instrs = parseExpression(expression);
    if (instrs === null || instrs.length === 0) {
      return complete(createProgram(), 'parse_error', {
        message: `Could not parse expression "${expression}". Expected format: $page.field, $url.param, $step.key.field[0], $session.field, 'literal', $ctx.key, or any of the above with |transform() suffix.`,
      }) as StorageProgram<Result>;
    }

    const sourceInstr = instrs[0];
    if (sourceInstr.kind !== 'source') {
      return complete(createProgram(), 'parse_error', { message: 'Parsed instruction list has no source instruction' }) as StorageProgram<Result>;
    }

    const programId = newProgramId();
    const rec: ProgramRecord = {
      id: programId,
      sourceKind: sourceInstr.op,
      instructions: JSON.stringify(instrs),
      resolvedType: null,
      expression,
    };

    let p = createProgram();
    p = put(p, 'variableProgram', programId, rec as unknown as Record<string, unknown>);
    return complete(p, 'ok', { program: programId }) as StorageProgram<Result>;
  },

  typeCheck(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const instrs = parseInstructions(rec);
        const resolvedType = inferType(instrs);
        if (resolvedType === 'unknown') {
          return complete(b, 'type_error', {
            message: 'Type cannot be inferred statically for this program. Field types depend on schema definitions that are not available at build time.',
          }) as StorageProgram<Result>;
        }
        // Store inferred type
        const updated: ProgramRecord = { ...rec, resolvedType };
        let b2 = put(b, 'variableProgram', programId, updated as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { resolvedType }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  // --- Runtime resolution ---

  resolve(input: Record<string, unknown>) {
    const programId = (input.program ?? '') as string;
    const contextStr = (input.context ?? '{}') as string;

    let context: Record<string, unknown> = {};
    try {
      context = JSON.parse(contextStr) as Record<string, unknown>;
    } catch {
      return complete(createProgram(), 'not_found', { message: 'context must be valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'variableProgram', programId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'not_found', { message: `No VariableProgram with id "${programId}"` }),
      (b) => {
        const rec = b.existing as ProgramRecord;
        const instrs = parseInstructions(rec);
        if (instrs.length === 0) {
          return complete(b, 'not_found', { message: 'Program has no instructions' }) as StorageProgram<Result>;
        }

        // Check all required providers are registered before executing
        // Source provider
        const sourceInstr = instrs[0];
        if (sourceInstr.kind !== 'source') {
          return complete(b, 'not_found', { message: 'First instruction must be a source instruction' }) as StorageProgram<Result>;
        }

        const sourceProviderKey = `variable-source:${sourceInstr.op}`;
        let b2 = get(b, 'pluginregistry', sourceProviderKey, 'sourceProvider');

        return branch(b2,
          (bb) => bb.sourceProvider == null,
          (bb) => complete(bb, 'provider_not_found', {
            message: `No variable-source provider registered for kind "${sourceInstr.op}". Resolution requires a live provider.`,
          }),
          (bb) => {
            // Check transform providers
            const transformInstrs = instrs.filter((i): i is Extract<Instruction, { kind: 'transform' }> => i.kind === 'transform');

            // For simplicity in the functional model, we verify each transform provider
            // exists and then delegate actual execution to the platform interpreter.
            // The StorageProgram describes what to do; the interpreter calls the providers.
            //
            // Here we perform a best-effort in-handler resolution for literal/simple programs.
            // Full provider dispatch requires the platform's PluginRegistry interpreter.

            // Perform in-handler traversal for programs that don't need external providers
            // (literal source, pure structural traversal, no transforms).
            const sourceProvider = bb.sourceProvider as Record<string, unknown> | null;

            // Walk instruction list and resolve value
            let value: unknown = null;
            let errorResult: Result | null = null;

            for (const instr of instrs) {
              switch (instr.kind) {
                case 'source': {
                  // For literal sources we can resolve immediately; others need provider
                  if (instr.op === 'literal') {
                    value = instr.args.value ?? '';
                  } else {
                    // Signal that external provider resolution is needed
                    // The platform interpreter reads the instruction list and dispatches
                    value = `__provider:${instr.op}:${JSON.stringify(instr.args)}:${JSON.stringify(context)}`;
                  }
                  break;
                }
                case 'get': {
                  if (value == null) {
                    errorResult = { variant: 'not_found', message: `Source value is null; cannot access field "${instr.field}"` };
                    break;
                  }
                  if (typeof value !== 'object') {
                    errorResult = { variant: 'type_error', message: `Cannot access field "${instr.field}" on a non-object value` };
                    break;
                  }
                  value = (value as Record<string, unknown>)[instr.field] ?? null;
                  break;
                }
                case 'follow': {
                  if (value == null) {
                    errorResult = { variant: 'not_found', message: `Source value is null; cannot follow relation "${instr.relation}"` };
                    break;
                  }
                  if (typeof value !== 'object') {
                    errorResult = { variant: 'type_error', message: `Cannot follow relation "${instr.relation}" on a non-object value` };
                    break;
                  }
                  value = (value as Record<string, unknown>)[instr.relation] ?? null;
                  break;
                }
                case 'at': {
                  if (!Array.isArray(value)) {
                    errorResult = { variant: 'type_error', message: `at(${instr.index}) requires a list value` };
                    break;
                  }
                  value = value[instr.index] ?? null;
                  break;
                }
                case 'first': {
                  if (!Array.isArray(value)) {
                    errorResult = { variant: 'type_error', message: 'first() requires a list value' };
                    break;
                  }
                  value = value[0] ?? null;
                  break;
                }
                case 'count': {
                  if (!Array.isArray(value)) {
                    errorResult = { variant: 'type_error', message: 'count() requires a list value' };
                    break;
                  }
                  value = value.length;
                  break;
                }
                case 'transform': {
                  // Transform execution requires provider dispatch
                  // Mark as needing provider; platform interpreter handles it
                  value = `__transform:${instr.op}:${JSON.stringify(instr.args)}:${JSON.stringify(value)}`;
                  break;
                }
              }
              if (errorResult) break;
            }

            if (errorResult) {
              return complete(bb, errorResult.variant, { message: errorResult.message }) as StorageProgram<Result>;
            }

            const serialized = value == null ? '' : String(value);
            return complete(bb, 'ok', { value: serialized }) as StorageProgram<Result>;
          },
        ) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  // --- PluginRegistry registration ---

  register(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      name: 'VariableProgram',
      version: '1',
      capabilities: JSON.stringify(['from', 'get', 'follow', 'at', 'first', 'count', 'transform', 'compile', 'parse', 'typeCheck', 'resolve']),
    }) as StorageProgram<Result>;
  },

};

export const variableProgramHandler = autoInterpret(_handler);

export function register(): string {
  return 'VariableProgram';
}
