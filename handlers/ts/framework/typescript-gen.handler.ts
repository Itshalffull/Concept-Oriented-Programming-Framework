// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TypeScriptGen Concept Implementation
//
// Generates TypeScript skeleton code from a ConceptManifest.
// Extracted from the original CodeGen concept as part of the
// codegen refactor (Section 10.1).
//
// Reads from ConceptManifest (language-neutral IR) rather than
// raw concept ASTs. Produces identical output to the original
// CodeGen for TypeScript targets.
//
// Generated files per Section 7.3:
//   - Type definitions file (types.ts)
//   - Handler interface file (handler.ts)
//   - Adapter file (adapter.ts)
//   - Conformance test file (conformance.test.ts) -- when invariants exist
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type {
  ConceptManifest,
  ResolvedType,
  InvariantStep,
  InvariantValue,
} from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

// --- ResolvedType -> TypeScript mapping (Section 3.3) ---

function resolvedTypeToTS(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToTS(t.primitive);
    case 'param':
      return 'string'; // type parameters are opaque string IDs
    case 'set':
      return `Set<${resolvedTypeToTS(t.inner)}>`;
    case 'list':
      return `${resolvedTypeToTS(t.inner)}[]`;
    case 'option':
      return `${resolvedTypeToTS(t.inner)} | null`;
    case 'map':
      return `Map<${resolvedTypeToTS(t.keyType)}, ${resolvedTypeToTS(t.inner)}>`;
    case 'record': {
      const fields = t.fields.map(f => `${f.name}: ${resolvedTypeToTS(f.type)}`);
      return `{ ${fields.join('; ')} }`;
    }
  }
}

function primitiveToTS(name: string): string {
  switch (name) {
    case 'String': return 'string';
    case 'Int': return 'number';
    case 'Float': return 'number';
    case 'Bool': return 'boolean';
    case 'Bytes': return 'Buffer';
    case 'DateTime': return 'Date';
    case 'ID': return 'string';
    default: return 'unknown';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Type Definitions File (Section 7.3 -- <concept>.types.ts) ---

function generateTypesFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}.types.stub.ts`,
    '',
  ];

  for (const action of manifest.actions) {
    // Input type
    const inputTypeName = `${conceptName}${capitalize(action.name)}Input`;
    lines.push(`export interface ${inputTypeName} {`);
    for (const p of action.params) {
      lines.push(`  ${p.name}: ${resolvedTypeToTS(p.type)};`);
    }
    lines.push(`}`);
    lines.push('');

    // Output type (discriminated union of variants)
    const outputTypeName = `${conceptName}${capitalize(action.name)}Output`;
    const variantTypes: string[] = [];

    for (const v of action.variants) {
      const fields = v.fields.map(p => `${p.name}: ${resolvedTypeToTS(p.type)}`);
      const fieldStr = fields.length > 0 ? `; ${fields.join('; ')}` : '';
      variantTypes.push(`{ variant: "${v.tag}"${fieldStr} }`);
    }

    lines.push(`export type ${outputTypeName} =`);
    for (let i = 0; i < variantTypes.length; i++) {
      const sep = i === 0 ? '  ' : '  | ';
      lines.push(`${sep}${variantTypes[i]}${i < variantTypes.length - 1 ? '' : ';'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// --- Handler Interface File (Section 7.3 -- <concept>.handler.ts) ---

function generateHandlerFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lowerName = conceptName.toLowerCase();
  const lines: string[] = [
    `// generated: ${lowerName}.handler.stub.ts`,
    `import type { ConceptStorage } from "@clef/runtime";`,
    `import type * as T from "./${lowerName}.types";`,
    '',
    `export interface ${conceptName}Handler {`,
  ];

  for (const action of manifest.actions) {
    const inputType = `T.${conceptName}${capitalize(action.name)}Input`;
    const outputType = `T.${conceptName}${capitalize(action.name)}Output`;
    lines.push(`  ${action.name}(input: ${inputType}, storage: ConceptStorage):`);
    lines.push(`    Promise<${outputType}>;`);
  }

  lines.push(`}`);
  return lines.join('\n');
}

// --- Adapter File (Section 7.3 -- <concept>.adapter.ts) ---

function generateAdapterFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lowerName = conceptName.toLowerCase();
  const lines: string[] = [
    `// generated: ${lowerName}.adapter.stub.ts`,
    `import type {`,
    `  ActionInvocation, ActionCompletion,`,
    `  ConceptTransport, ConceptQuery`,
    `} from "@clef/runtime";`,
    `import type { ${conceptName}Handler } from "./${lowerName}.handler";`,
    `import type { ConceptStorage } from "@clef/runtime";`,
    '',
    `export function create${conceptName}LiteAdapter(`,
    `  handler: ${conceptName}Handler,`,
    `  storage: ConceptStorage,`,
    `): ConceptTransport {`,
    `  return {`,
    `    queryMode: "lite",`,
    `    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {`,
    `      let result: { variant: string; [key: string]: unknown };`,
    `      switch (invocation.action) {`,
  ];

  for (const action of manifest.actions) {
    lines.push(`        case "${action.name}":`);
    lines.push(`          result = await handler.${action.name}(invocation.input, storage);`);
    lines.push(`          break;`);
  }

  lines.push(
    `        default:`,
    `          throw new Error(\`Unknown action: \${invocation.action}\`);`,
    `      }`,
    `      const { variant, ...output } = result;`,
    `      return {`,
    `        id: invocation.id,`,
    `        concept: invocation.concept,`,
    `        action: invocation.action,`,
    `        input: invocation.input,`,
    `        variant,`,
    `        output,`,
    `        flow: invocation.flow,`,
    `        timestamp: new Date().toISOString(),`,
    `      };`,
    `    },`,
    `    async query(request: ConceptQuery) {`,
    `      return storage.find(request.relation, request.args);`,
    `    },`,
    `    async health() {`,
    `      return { available: true, latency: 0 };`,
    `    },`,
    `  };`,
    `}`,
  );

  return lines.join('\n');
}

// --- Conformance Test File (Section 7.4) ---

/**
 * Generate a conformance test file for a concept.
 *
 * @param testStyle - 'functional' (default): uses interpret() on the raw StorageProgram,
 *   accesses results via result.output.field. 'imperative': passes storage as second arg
 *   to the handler (works via autoInterpret), accesses results via (result as any).field.
 */
function generateConformanceTestFile(
  manifest: ConceptManifest,
  testStyle: 'functional' | 'imperative' = 'functional',
): string | null {
  if (manifest.invariants.length === 0) {
    return null;
  }

  const conceptName = manifest.name;
  const lowerName = conceptName.toLowerCase();
  const handlerVar = `${lowerName}Handler`;

  const lines: string[] = [
    `// generated: ${lowerName}.conformance.stub.test.ts`,
    `import { describe, it, expect } from "vitest";`,
    `import { createInMemoryStorage } from "@clef/runtime";`,
  ];
  if (testStyle === 'functional') {
    lines.push(`import { interpret } from "../../../runtime/interpreter.ts";`);
  }
  lines.push(
    `import { ${handlerVar} } from "./${lowerName}.impl";`,
    '',
    `describe("${conceptName} conformance", () => {`,
    '',
  );

  let invNum = 0;
  for (const inv of manifest.invariants) {
    // Skip invariants with no operational steps (e.g., 'always' universal properties)
    // — these can't be tested via action calls
    if (inv.setup.length === 0 && inv.assertions.length === 0) {
      continue;
    }

    invNum++;
    lines.push(`  it("invariant ${invNum}: ${inv.description}", async () => {`);
    lines.push(`    const storage = createInMemoryStorage();`);
    lines.push('');

    // Declare free variable bindings (Section 7.4 Rule 1)
    for (const fv of inv.freeVariables) {
      lines.push(`    let ${fv.name} = "${fv.testValue}";`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    const boundVars = new Set<string>();

    // After clause (Section 7.4 Rule 2)
    let stepNum = 1;
    lines.push(`    // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateStepCode(handlerVar, step, stepNum, boundVars, testStyle));
      stepNum++;
    }
    lines.push('');

    // Then clause (Section 7.4 Rule 3)
    lines.push(`    // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateStepCode(handlerVar, step, stepNum, null, testStyle));
      stepNum++;
    }

    lines.push(`  });`);
    lines.push('');
  }

  // If all invariants were skipped (e.g., only 'always' properties), return null
  if (invNum === 0) {
    return null;
  }

  lines.push(`});`);
  return lines.join('\n');
}

function invariantValueToTS(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal':
      return JSON.stringify(v.value);
    case 'variable':
      return v.name;
    case 'record': {
      const fields = v.fields.map(f => `${f.name}: ${invariantValueToTS(f.value)}`);
      return `{ ${fields.join(', ')} }`;
    }
    case 'list': {
      const items = v.items.map(item => invariantValueToTS(item));
      return `[${items.join(', ')}]`;
    }
  }
}

function generateStepCode(
  handlerVar: string,
  step: InvariantStep,
  stepNum: number,
  boundVars: Set<string> | null,
  testStyle: 'functional' | 'imperative' = 'functional',
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  const inputStr = step.inputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');
  const outputStr = step.expectedOutputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');
  lines.push(`    // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  const inputFields = step.inputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');

  if (testStyle === 'functional') {
    // Functional: call handler to get StorageProgram, then interpret
    lines.push(`    const ${varName}Program = ${handlerVar}.${step.action}(`);
    lines.push(`      { ${inputFields} },`);
    lines.push(`    );`);
    lines.push(`    const ${varName} = await interpret(${varName}Program, storage);`);
  } else {
    // Imperative: pass storage as second arg (autoInterpret compat)
    lines.push(`    const ${varName} = await ${handlerVar}.${step.action}(`);
    lines.push(`      { ${inputFields} },`);
    lines.push(`      storage,`);
    lines.push(`    );`);
  }

  lines.push(`    expect(${varName}.variant).toBe("${step.expectedVariant}");`);

  // Output field access differs between styles:
  // - functional: result.output.field (interpret returns { variant, output })
  // - imperative: (result as any).field (autoInterpret flattens { variant, ...output })
  const fieldAccess = testStyle === 'functional'
    ? (field: string) => `${varName}.output.${field}`
    : (field: string) => `(${varName} as any).${field}`;

  for (const out of step.expectedOutputs) {
    if (out.value.kind === 'literal') {
      lines.push(`    expect(${fieldAccess(out.name)}).toBe(${JSON.stringify(out.value.value)});`);
    } else if (out.value.kind === 'variable') {
      if (out.value.name === '_') {
        lines.push(`    expect(${fieldAccess(out.name)}).toBeDefined();`);
      } else if (boundVars && !boundVars.has(out.value.name)) {
        boundVars.add(out.value.name);
        lines.push(`    ${out.value.name} = ${fieldAccess(out.name)} as string;`);
      } else {
        lines.push(`    expect(${fieldAccess(out.name)}).toBe(${out.value.name});`);
      }
    } else {
      lines.push(`    expect(${fieldAccess(out.name)}).toEqual(${invariantValueToTS(out.value)});`);
    }
  }

  return lines;
}

// --- StorageProgram DSL Runtime File ---

function generateDslRuntimeFile(): string {
  return `// generated: storage-program.dsl.stub.ts
//
// StorageProgram DSL -- Free Monad for Concept Handlers
// Provides typed lenses/optics, effect tracking, algebraic effects,
// transport effects, and functorial mapping for render programs.

// -- Lens Types --

export type LensSegment =
  | { kind: 'relation'; name: string }
  | { kind: 'key'; value: string }
  | { kind: 'field'; name: string };

export interface StateLens {
  readonly segments: readonly LensSegment[];
  readonly sourceType: string;
  readonly focusType: string;
}

// -- Lens Builders --

export function relation(name: string): StateLens {
  return { segments: [{ kind: 'relation', name }], sourceType: 'store', focusType: \`relation<\${name}>\` };
}

export function at(lens: StateLens, key: string): StateLens {
  return { segments: [...lens.segments, { kind: 'key', value: key }], sourceType: lens.sourceType, focusType: 'record' };
}

export function field(lens: StateLens, name: string): StateLens {
  return { segments: [...lens.segments, { kind: 'field', name }], sourceType: lens.sourceType, focusType: name };
}

export function composeLens(outer: StateLens, inner: StateLens): StateLens {
  return { segments: [...outer.segments, ...inner.segments], sourceType: outer.sourceType, focusType: inner.focusType };
}

// -- Effect Set --

export interface EffectSet {
  readonly reads: ReadonlySet<string>;
  readonly writes: ReadonlySet<string>;
  readonly completionVariants: ReadonlySet<string>;
  readonly performs: ReadonlySet<string>;
}

export type Purity = 'pure' | 'read-only' | 'read-write';

export function emptyEffects(): EffectSet {
  return { reads: new Set(), writes: new Set(), completionVariants: new Set(), performs: new Set() };
}

export function mergeEffects(a: EffectSet, b: EffectSet): EffectSet {
  return {
    reads: new Set([...a.reads, ...b.reads]),
    writes: new Set([...a.writes, ...b.writes]),
    completionVariants: new Set([...a.completionVariants, ...b.completionVariants]),
    performs: new Set([...a.performs, ...b.performs]),
  };
}

export function purityOf(effects: EffectSet): Purity {
  if (effects.writes.size > 0) return 'read-write';
  if (effects.reads.size > 0) return 'read-only';
  return 'pure';
}

// -- Instruction Types --

export type Bindings = Record<string, unknown>;

export type Instruction =
  | { tag: 'get'; relation: string; key: string; bindAs: string }
  | { tag: 'find'; relation: string; criteria: Record<string, unknown>; bindAs: string }
  | { tag: 'put'; relation: string; key: string; value: Record<string, unknown> }
  | { tag: 'merge'; relation: string; key: string; fields: Record<string, unknown> }
  | { tag: 'del'; relation: string; key: string }
  | { tag: 'getLens'; lens: StateLens; bindAs: string }
  | { tag: 'putLens'; lens: StateLens; value: Record<string, unknown> }
  | { tag: 'modifyLens'; lens: StateLens; fn: (bindings: Bindings) => Record<string, unknown> }
  | { tag: 'perform'; protocol: string; operation: string; payload: Record<string, unknown>; bindAs: string }
  | { tag: 'branch'; condition: (bindings: Bindings) => boolean; thenBranch: StorageProgram<unknown>; elseBranch: StorageProgram<unknown> }
  | { tag: 'pure'; value: unknown }
  | { tag: 'pureFrom'; fn: (bindings: Bindings) => unknown }
  | { tag: 'bind'; first: StorageProgram<unknown>; bindAs: string; second: StorageProgram<unknown> };

// -- StorageProgram --

export interface StorageProgram<A> {
  readonly instructions: Instruction[];
  readonly terminated: boolean;
  readonly effects: EffectSet;
}

// -- Program Builders --

export function createProgram(): StorageProgram<void> {
  return { instructions: [], terminated: false, effects: emptyEffects() };
}

export function get(p: StorageProgram<unknown>, relation: string, key: string, bindAs: string): StorageProgram<unknown> {
  const reads = new Set(p.effects.reads); reads.add(relation);
  return { instructions: [...p.instructions, { tag: 'get', relation, key, bindAs }], terminated: false, effects: { ...p.effects, reads } };
}

export function put(p: StorageProgram<unknown>, relation: string, key: string, value: Record<string, unknown>): StorageProgram<void> {
  const writes = new Set(p.effects.writes); writes.add(relation);
  return { instructions: [...p.instructions, { tag: 'put', relation, key, value }], terminated: false, effects: { ...p.effects, writes } };
}

export function getLens(p: StorageProgram<unknown>, lens: StateLens, bindAs: string): StorageProgram<unknown> {
  const rel = (lens.segments[0] as { name: string }).name;
  const reads = new Set(p.effects.reads); reads.add(rel);
  return { instructions: [...p.instructions, { tag: 'getLens', lens, bindAs }], terminated: false, effects: { ...p.effects, reads } };
}

export function putLens(p: StorageProgram<unknown>, lens: StateLens, value: Record<string, unknown>): StorageProgram<void> {
  const rel = (lens.segments[0] as { name: string }).name;
  const writes = new Set(p.effects.writes); writes.add(rel);
  return { instructions: [...p.instructions, { tag: 'putLens', lens, value }], terminated: false, effects: { ...p.effects, writes } };
}

export function modifyLens(p: StorageProgram<unknown>, lens: StateLens, fn: (b: Bindings) => Record<string, unknown>): StorageProgram<void> {
  const rel = (lens.segments[0] as { name: string }).name;
  const reads = new Set(p.effects.reads); reads.add(rel);
  const writes = new Set(p.effects.writes); writes.add(rel);
  return { instructions: [...p.instructions, { tag: 'modifyLens', lens, fn }], terminated: false, effects: { ...p.effects, reads, writes } };
}

export function perform(p: StorageProgram<unknown>, protocol: string, operation: string, payload: Record<string, unknown>, bindAs: string): StorageProgram<unknown> {
  const performs = new Set(p.effects.performs); performs.add(\`\${protocol}:\${operation}\`);
  return { instructions: [...p.instructions, { tag: 'perform', protocol, operation, payload, bindAs }], terminated: false, effects: { ...p.effects, performs } };
}

export function pure<A>(p: StorageProgram<unknown>, value: A): StorageProgram<A> {
  return { instructions: [...p.instructions, { tag: 'pure', value }], terminated: true, effects: p.effects };
}

export function complete<A extends Record<string, unknown>>(p: StorageProgram<unknown>, variant: string, output: A): StorageProgram<{ variant: string } & A> {
  const completionVariants = new Set(p.effects.completionVariants); completionVariants.add(variant);
  return { instructions: [...p.instructions, { tag: 'pure', value: { variant, ...output } }], terminated: true, effects: { ...p.effects, completionVariants } };
}

export function branch<A>(p: StorageProgram<unknown>, condition: (b: Bindings) => boolean, then_: StorageProgram<A>, else_: StorageProgram<A>): StorageProgram<A> {
  return { instructions: [...p.instructions, { tag: 'branch', condition, thenBranch: then_, elseBranch: else_ }], terminated: false, effects: mergeEffects(p.effects, mergeEffects(then_.effects, else_.effects)) };
}

// -- Analysis Helpers --

export function extractCompletionVariants(p: StorageProgram<unknown>): Set<string> {
  const variants = new Set<string>();
  for (const i of p.instructions) {
    if (i.tag === 'pure' && i.value && typeof i.value === 'object' && 'variant' in (i.value as Record<string, unknown>))
      variants.add((i.value as Record<string, unknown>).variant as string);
    if (i.tag === 'branch') { for (const v of extractCompletionVariants(i.thenBranch)) variants.add(v); for (const v of extractCompletionVariants(i.elseBranch)) variants.add(v); }
    if (i.tag === 'bind') { for (const v of extractCompletionVariants(i.first)) variants.add(v); for (const v of extractCompletionVariants(i.second)) variants.add(v); }
  }
  return variants;
}

export function extractPerformSet(p: StorageProgram<unknown>): Set<string> {
  const performs = new Set<string>();
  for (const i of p.instructions) {
    if (i.tag === 'perform') performs.add(\`\${i.protocol}:\${i.operation}\`);
    if (i.tag === 'branch') { for (const v of extractPerformSet(i.thenBranch)) performs.add(v); for (const v of extractPerformSet(i.elseBranch)) performs.add(v); }
    if (i.tag === 'bind') { for (const v of extractPerformSet(i.first)) performs.add(v); for (const v of extractPerformSet(i.second)) performs.add(v); }
  }
  return performs;
}

export function validatePurity(p: StorageProgram<unknown>, declared: Purity): string | null {
  if (declared === 'pure' && (p.effects.reads.size > 0 || p.effects.writes.size > 0))
    return \`Declared pure but has storage effects\`;
  if (declared === 'read-only' && p.effects.writes.size > 0)
    return \`Declared read-only but writes to: \${[...p.effects.writes].join(', ')}\`;
  return null;
}

// -- Render Program (Functorial Mapping) --

export type RenderInstruction =
  | { tag: 'token'; path: string; value: unknown }
  | { tag: 'aria'; role?: string; label?: string; attributes?: Record<string, string> }
  | { tag: 'bind'; field: string; expr: string }
  | { tag: 'element'; name: string; attributes?: Record<string, string> }
  | { tag: 'focus'; strategy: string; target?: string }
  | { tag: 'keyboard'; key: string; action: string; modifiers?: string[] }
  | { tag: 'pure'; value: unknown };

export interface RenderProgram {
  readonly instructions: RenderInstruction[];
  readonly terminated: boolean;
}

export function mapRenderProgram(
  program: RenderProgram,
  transform: (instr: RenderInstruction) => RenderInstruction,
): RenderProgram {
  return { instructions: program.instructions.map(transform), terminated: program.terminated };
}
`;
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'TypeScriptGen',
      inputKind: 'ConceptManifest',
      outputKind: 'TypeScriptSource',
      capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests', 'dsl-runtime']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const manifest = input.manifest as ConceptManifest;
    const testStyle = (input.testStyle as 'functional' | 'imperative') || 'functional';
    if (!manifest || !manifest.name) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid manifest: missing concept name' }) as StorageProgram<Result>;
    }
    try {
      const lowerName = manifest.name.toLowerCase();
      const files: { path: string; content: string }[] = [
        { path: `${lowerName}.types.stub.ts`, content: generateTypesFile(manifest) },
        { path: `${lowerName}.handler.stub.ts`, content: generateHandlerFile(manifest) },
        { path: `${lowerName}.adapter.stub.ts`, content: generateAdapterFile(manifest) },
        { path: `storage-program.dsl.stub.ts`, content: generateDslRuntimeFile() },
      ];
      const conformanceTest = generateConformanceTestFile(manifest, testStyle);
      if (conformanceTest) {
        files.push({ path: `${lowerName}.conformance.stub.test.ts`, content: conformanceTest });
      }
      const p = createProgram();
      return complete(p, 'ok', { files }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const p = createProgram();
      return complete(p, 'error', { message, ...(stack ? { stack } : {}) }) as StorageProgram<Result>;
    }
  },
};

export const typescriptGenHandler = autoInterpret(_handler);

/**
 * Detect handler style from the @clef-handler annotation in a handler file.
 * Reads the first 10 lines and looks for `// @clef-handler style=functional|imperative`.
 * Returns 'functional' if not found (default).
 *
 * This is a utility for callers of the generator — the generator itself accepts
 * testStyle as an input parameter and doesn't read files.
 */
export function detectHandlerStyle(fileContent: string): 'functional' | 'imperative' {
  const lines = fileContent.split('\n').slice(0, 10);
  for (const line of lines) {
    const match = line.match(/@clef-handler\s+style\s*=\s*(functional|imperative)/);
    if (match) {
      return match[1] as 'functional' | 'imperative';
    }
  }
  return 'functional';
}
