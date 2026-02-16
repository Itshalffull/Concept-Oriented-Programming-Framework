// ============================================================
// Stage 1 — CodeGen Concept Implementation
//
// Generates language-specific skeleton code from concept ASTs.
// Currently supports TypeScript. Follows the architecture doc
// Section 7.3 for the generated code structure:
//   - Type definitions file (types.ts)
//   - Handler interface file (handler.ts)
//   - Adapter file (adapter.ts)
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptAST, TypeExpr, ActionDecl, InvariantDecl, ActionPattern, ArgPattern } from '../../../kernel/src/types.js';

// --- TypeScript Type Mapping (Section 3.3) ---

function typeExprToTS(t: TypeExpr): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToTS(t.name);
    case 'param':
      return 'string'; // type parameters are opaque string IDs
    case 'set':
      return `Set<${typeExprToTS(t.inner)}>`;
    case 'list':
      return `${typeExprToTS(t.inner)}[]`;
    case 'option':
      return `${typeExprToTS(t.inner)} | null`;
    case 'relation':
      return `Map<${typeExprToTS(t.from)}, ${typeExprToTS(t.to)}>`;
    case 'record': {
      const fields = t.fields.map(f => `${f.name}: ${typeExprToTS(f.type)}`);
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

function generateTypesFile(ast: ConceptAST): string {
  const conceptName = ast.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}.types.ts`,
    '',
  ];

  for (const action of ast.actions) {
    // Input type
    const inputTypeName = `${conceptName}${capitalize(action.name)}Input`;
    lines.push(`export interface ${inputTypeName} {`);
    for (const p of action.params) {
      lines.push(`  ${p.name}: ${typeExprToTS(p.type)};`);
    }
    lines.push(`}`);
    lines.push('');

    // Output type (discriminated union of variants)
    const outputTypeName = `${conceptName}${capitalize(action.name)}Output`;
    const variantTypes: string[] = [];

    for (const v of action.variants) {
      const fields = v.params.map(p => `${p.name}: ${typeExprToTS(p.type)}`);
      const fieldStr = fields.length > 0 ? `; ${fields.join('; ')}` : '';
      variantTypes.push(`{ variant: "${v.name}"${fieldStr} }`);
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

function generateHandlerFile(ast: ConceptAST): string {
  const conceptName = ast.name;
  const lowerName = conceptName.toLowerCase();
  const lines: string[] = [
    `// generated: ${lowerName}.handler.ts`,
    `import type { ConceptStorage } from "@copf/runtime";`,
    `import type * as T from "./${lowerName}.types";`,
    '',
    `export interface ${conceptName}Handler {`,
  ];

  for (const action of ast.actions) {
    const inputType = `T.${conceptName}${capitalize(action.name)}Input`;
    const outputType = `T.${conceptName}${capitalize(action.name)}Output`;
    lines.push(`  ${action.name}(input: ${inputType}, storage: ConceptStorage):`);
    lines.push(`    Promise<${outputType}>;`);
  }

  lines.push(`}`);
  return lines.join('\n');
}

// --- Adapter File (Section 7.3 — <concept>.adapter.ts) ---

function generateAdapterFile(ast: ConceptAST): string {
  const conceptName = ast.name;
  const lowerName = conceptName.toLowerCase();
  const lines: string[] = [
    `// generated: ${lowerName}.adapter.ts`,
    `import type {`,
    `  ActionInvocation, ActionCompletion,`,
    `  ConceptTransport, ConceptQuery`,
    `} from "@copf/runtime";`,
    `import type { ${conceptName}Handler } from "./${lowerName}.handler";`,
    `import type { ConceptStorage } from "@copf/runtime";`,
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

/**
 * Generate conformance tests from the invariant section of a concept spec.
 *
 * Rules from Section 7.4:
 * 1. Free variables are assigned deterministic IDs: "u-test-invariant-001", etc.
 * 2. The `after` clause becomes action calls with variant assertions.
 * 3. The `then` clause becomes assertion calls checking variant + fields.
 * 4. Literal values are asserted exactly; variables checked for consistency.
 * 5. Multiple invariants produce multiple test cases with isolated storage.
 */
function generateConformanceTestFile(ast: ConceptAST): string | null {
  if (!ast.invariants || ast.invariants.length === 0) {
    return null;
  }

  const conceptName = ast.name;
  const lowerName = conceptName.toLowerCase();
  const handlerVar = `${lowerName}Handler`;

  const lines: string[] = [
    `// generated: ${lowerName}.conformance.test.ts`,
    `import { describe, it, expect } from "vitest";`,
    `import { createInMemoryStorage } from "@copf/runtime";`,
    `import { ${handlerVar} } from "./${lowerName}.impl";`,
    '',
    `describe("${conceptName} conformance", () => {`,
    '',
  ];

  for (let i = 0; i < ast.invariants.length; i++) {
    const inv = ast.invariants[i];

    // Collect all free variables (in order of first appearance)
    const freeVars: string[] = [];
    const seenVars = new Set<string>();

    function collectVarsFromPattern(pattern: ActionPattern) {
      for (const arg of pattern.inputArgs) {
        if (arg.value.type === 'variable' && !seenVars.has(arg.value.name)) {
          seenVars.add(arg.value.name);
          freeVars.push(arg.value.name);
        }
      }
      for (const arg of pattern.outputArgs) {
        if (arg.value.type === 'variable' && !seenVars.has(arg.value.name)) {
          seenVars.add(arg.value.name);
          freeVars.push(arg.value.name);
        }
      }
    }

    for (const p of inv.afterPatterns) collectVarsFromPattern(p);
    for (const p of inv.thenPatterns) collectVarsFromPattern(p);

    // Build description from invariant structure
    const afterNames = inv.afterPatterns.map(p => p.actionName).join(', ');
    const thenNames = inv.thenPatterns.map(p => p.actionName).join(', ');
    const desc = `invariant ${i + 1}: after ${afterNames}, ${thenNames} behaves correctly`;

    lines.push(`  it("${desc}", async () => {`);
    lines.push(`    const storage = createInMemoryStorage();`);
    lines.push('');

    // Declare free variable bindings (Section 7.4 Rule 1)
    for (let v = 0; v < freeVars.length; v++) {
      const padded = String(v + 1).padStart(3, '0');
      lines.push(`    const ${freeVars[v]} = "u-test-invariant-${padded}";`);
    }
    if (freeVars.length > 0) lines.push('');

    // After clause (Section 7.4 Rule 2)
    let stepNum = 1;
    lines.push(`    // --- AFTER clause ---`);
    for (const pattern of inv.afterPatterns) {
      lines.push(...generatePatternCall(
        handlerVar, pattern, freeVars, stepNum, 'after',
      ));
      stepNum++;
    }
    lines.push('');

    // Then clause (Section 7.4 Rule 3)
    lines.push(`    // --- THEN clause ---`);
    for (const pattern of inv.thenPatterns) {
      lines.push(...generatePatternCall(
        handlerVar, pattern, freeVars, stepNum, 'then',
      ));
      stepNum++;
    }

    lines.push(`  });`);
    lines.push('');
  }

  lines.push(`});`);
  return lines.join('\n');
}

function generatePatternCall(
  handlerVar: string,
  pattern: ActionPattern,
  freeVars: string[],
  stepNum: number,
  clause: 'after' | 'then',
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  // Build the comment showing the original pattern
  const inputStr = pattern.inputArgs.map(a => {
    if (a.value.type === 'literal') return `${a.name}: ${JSON.stringify(a.value.value)}`;
    return `${a.name}: ${a.value.name}`;
  }).join(', ');
  const outputStr = pattern.outputArgs.map(a => {
    if (a.value.type === 'literal') return `${a.name}: ${JSON.stringify(a.value.value)}`;
    return `${a.name}: ${a.value.name}`;
  }).join(', ');
  lines.push(`    // ${pattern.actionName}(${inputStr}) -> ${pattern.variantName}(${outputStr})`);

  // Build input object
  const inputFields = pattern.inputArgs.map(a => {
    if (a.value.type === 'literal') return `${a.name}: ${JSON.stringify(a.value.value)}`;
    return `${a.name}: ${a.value.name}`;
  }).join(', ');

  lines.push(`    const ${varName} = await ${handlerVar}.${pattern.actionName}(`);
  lines.push(`      { ${inputFields} },`);
  lines.push(`      storage,`);
  lines.push(`    );`);

  // Assert variant
  lines.push(`    expect(${varName}.variant).toBe("${pattern.variantName}");`);

  // Assert output fields (Section 7.4 Rule 4)
  for (const arg of pattern.outputArgs) {
    if (arg.value.type === 'literal') {
      lines.push(`    expect((${varName} as any).${arg.name}).toBe(${JSON.stringify(arg.value.value)});`);
    } else {
      // Variable reference — assert consistency
      lines.push(`    expect((${varName} as any).${arg.name}).toBe(${arg.value.name});`);
    }
  }

  return lines;
}

// --- Handler ---

export const codeGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const ast = input.ast as ConceptAST;
    const language = input.language as string;

    if (!ast || !ast.name) {
      return { variant: 'error', message: 'Invalid AST: missing concept name' };
    }

    if (language !== 'typescript') {
      return { variant: 'error', message: `Unsupported language: ${language}. Only "typescript" is supported in Stage 1.` };
    }

    try {
      const lowerName = ast.name.toLowerCase();
      const files: { path: string; content: string }[] = [
        { path: `${lowerName}.types.ts`, content: generateTypesFile(ast) },
        { path: `${lowerName}.handler.ts`, content: generateHandlerFile(ast) },
        { path: `${lowerName}.adapter.ts`, content: generateAdapterFile(ast) },
      ];

      // Add conformance tests if the spec has invariants (Section 7.4)
      const conformanceTest = generateConformanceTestFile(ast);
      if (conformanceTest) {
        files.push({ path: `${lowerName}.conformance.test.ts`, content: conformanceTest });
      }

      // Store the output keyed by spec reference
      await storage.put('outputs', spec, { spec, files });

      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
