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
//   - Conformance test file (conformance.test.ts) — when invariants exist
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ResolvedType,
  ActionSchema,
  VariantSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../runtime/types.js';

// --- ResolvedType → TypeScript mapping (Section 3.3) ---

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

// --- Type Definitions File (Section 7.3 — <concept>.types.ts) ---

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

// --- Handler Interface File (Section 7.3 — <concept>.handler.ts) ---

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

// --- Adapter File (Section 7.3 — <concept>.adapter.ts) ---

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

function generateConformanceTestFile(manifest: ConceptManifest): string | null {
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
    `import { interpret } from "../../../runtime/interpreter.ts";`,
    `import { ${handlerVar} } from "./${lowerName}.impl";`,
    '',
    `describe("${conceptName} conformance", () => {`,
    '',
  ];

  for (const inv of manifest.invariants) {
    lines.push(`  it("${inv.description}", async () => {`);
    lines.push(`    const storage = createInMemoryStorage();`);
    lines.push('');

    // Declare free variable bindings (Section 7.4 Rule 1)
    // Use 'let' so setup steps can rebind output variables
    for (const fv of inv.freeVariables) {
      lines.push(`    let ${fv.name} = "${fv.testValue}";`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    // Track which variables have been bound by setup step outputs
    const boundVars = new Set<string>();

    // After clause (Section 7.4 Rule 2)
    let stepNum = 1;
    lines.push(`    // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateStepCode(handlerVar, step, stepNum, boundVars));
      stepNum++;
    }
    lines.push('');

    // Then clause (Section 7.4 Rule 3)
    lines.push(`    // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateStepCode(handlerVar, step, stepNum, null));
      stepNum++;
    }

    lines.push(`  });`);
    lines.push('');
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
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  // Build the comment showing the original pattern
  const inputStr = step.inputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');
  const outputStr = step.expectedOutputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');
  lines.push(`    // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  // Build input object
  const inputFields = step.inputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');

  lines.push(`    const ${varName}Program = ${handlerVar}.${step.action}(`);
  lines.push(`      { ${inputFields} },`);
  lines.push(`    );`);
  lines.push(`    const ${varName} = await interpret(${varName}Program, storage);`);

  // Assert variant
  lines.push(`    expect(${varName}.variant).toBe("${step.expectedVariant}");`);

  // Assert output fields (Section 7.4 Rule 4)
  // ExecutionResult has { variant, output: Record<string, unknown>, trace }
  for (const out of step.expectedOutputs) {
    if (out.value.kind === 'literal') {
      lines.push(`    expect(${varName}.output.${out.name}).toBe(${JSON.stringify(out.value.value)});`);
    } else if (out.value.kind === 'variable') {
      if (out.value.name === '_') {
        // Wildcard — just assert the field exists
        lines.push(`    expect(${varName}.output.${out.name}).toBeDefined();`);
      } else if (boundVars && !boundVars.has(out.value.name)) {
        // Setup step with unbound variable — capture the output value
        boundVars.add(out.value.name);
        lines.push(`    ${out.value.name} = ${varName}.output.${out.name} as string;`);
      } else {
        // Assertion step or already-bound variable — assert consistency
        lines.push(`    expect(${varName}.output.${out.name}).toBe(${out.value.name});`);
      }
    } else {
      // Record or list — use deep equality
      lines.push(`    expect(${varName}.output.${out.name}).toEqual(${invariantValueToTS(out.value)});`);
    }
  }

  return lines;
}

// --- StorageProgram DSL Runtime File ---

function generateDslRuntimeFile(): string {
  return `// generated: storage-program.dsl.stub.ts
//
// StorageProgram DSL — Free Monad for Concept Handlers
// Provides typed lenses/optics, effect tracking, algebraic effects,
// transport effects, and functorial mapping for render programs.

// ── Lens Types ──────────────────────────────────────────────

export type LensSegment =
  | { kind: 'relation'; name: string }
  | { kind: 'key'; value: string }
  | { kind: 'field'; name: string };

export interface StateLens {
  readonly segments: readonly LensSegment[];
  readonly sourceType: string;
  readonly focusType: string;
}

// ── Lens Builders ───────────────────────────────────────────

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

// ── Effect Set ──────────────────────────────────────────────

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

// ── Instruction Types ───────────────────────────────────────

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

// ── StorageProgram ──────────────────────────────────────────

export interface StorageProgram<A> {
  readonly instructions: Instruction[];
  readonly terminated: boolean;
  readonly effects: EffectSet;
}

// ── Program Builders ────────────────────────────────────────

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

// ── Analysis Helpers ────────────────────────────────────────

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

// ── Render Program (Functorial Mapping) ─────────────────────

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

export const typescriptGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'TypeScriptGen',
      inputKind: 'ConceptManifest',
      outputKind: 'TypeScriptSource',
      capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests', 'dsl-runtime']),
    };
  },

  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const lowerName = manifest.name.toLowerCase();
      const files: { path: string; content: string }[] = [
        { path: `${lowerName}.types.stub.ts`, content: generateTypesFile(manifest) },
        { path: `${lowerName}.handler.stub.ts`, content: generateHandlerFile(manifest) },
        { path: `${lowerName}.adapter.stub.ts`, content: generateAdapterFile(manifest) },
        { path: `storage-program.dsl.stub.ts`, content: generateDslRuntimeFile() },
      ];

      // Add conformance tests if the manifest has invariants (Section 7.4)
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${lowerName}.conformance.stub.test.ts`, content: conformanceTest });
      }

      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return { variant: 'error', message, ...(stack ? { stack } : {}) };
    }
  },
};
