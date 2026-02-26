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
    `// generated: ${conceptName.toLowerCase()}.types.ts`,
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
    `// generated: ${lowerName}.handler.ts`,
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
    `// generated: ${lowerName}.adapter.ts`,
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
    `      const result = await (handler as any)[invocation.action](`,
    `        invocation.input,`,
    `        storage`,
    `      );`,
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
  ];

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
    `// generated: ${lowerName}.conformance.test.ts`,
    `import { describe, it, expect } from "vitest";`,
    `import { createInMemoryStorage } from "@clef/runtime";`,
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
    for (const fv of inv.freeVariables) {
      lines.push(`    const ${fv.name} = "${fv.testValue}";`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    // After clause (Section 7.4 Rule 2)
    let stepNum = 1;
    lines.push(`    // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateStepCode(handlerVar, step, stepNum));
      stepNum++;
    }
    lines.push('');

    // Then clause (Section 7.4 Rule 3)
    lines.push(`    // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateStepCode(handlerVar, step, stepNum));
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
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  // Build the comment showing the original pattern
  const inputStr = step.inputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');
  const outputStr = step.expectedOutputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');
  lines.push(`    // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  // Build input object
  const inputFields = step.inputs.map(a => `${a.name}: ${invariantValueToTS(a.value)}`).join(', ');

  lines.push(`    const ${varName} = await ${handlerVar}.${step.action}(`);
  lines.push(`      { ${inputFields} },`);
  lines.push(`      storage,`);
  lines.push(`    );`);

  // Assert variant
  lines.push(`    expect(${varName}.variant).toBe("${step.expectedVariant}");`);

  // Assert output fields (Section 7.4 Rule 4)
  for (const out of step.expectedOutputs) {
    if (out.value.kind === 'literal') {
      lines.push(`    expect((${varName} as any).${out.name}).toBe(${JSON.stringify(out.value.value)});`);
    } else if (out.value.kind === 'variable') {
      if (out.value.name === '_') {
        // Wildcard — just assert the field exists
        lines.push(`    expect((${varName} as any).${out.name}).toBeDefined();`);
      } else {
        // Variable reference — assert consistency
        lines.push(`    expect((${varName} as any).${out.name}).toBe(${out.value.name});`);
      }
    } else {
      // Record or list — use deep equality
      lines.push(`    expect((${varName} as any).${out.name}).toEqual(${invariantValueToTS(out.value)});`);
    }
  }

  return lines;
}

// --- Handler ---

export const typescriptGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'TypeScriptGen',
      inputKind: 'ConceptManifest',
      outputKind: 'TypeScriptSource',
      capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests']),
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
        { path: `${lowerName}.types.ts`, content: generateTypesFile(manifest) },
        { path: `${lowerName}.handler.ts`, content: generateHandlerFile(manifest) },
        { path: `${lowerName}.adapter.ts`, content: generateAdapterFile(manifest) },
      ];

      // Add conformance tests if the manifest has invariants (Section 7.4)
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${lowerName}.conformance.test.ts`, content: conformanceTest });
      }

      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
