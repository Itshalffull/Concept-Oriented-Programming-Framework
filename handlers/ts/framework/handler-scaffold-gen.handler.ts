// ============================================================
// HandlerScaffoldGen — Concept handler (.handler.ts) scaffold generator
//
// Generates TypeScript concept handler implementations from
// provided inputs: concept name, actions, and their signatures.
// Defaults to functional (StorageProgram) style; falls back to
// imperative style only when explicitly requested.
//
// See architecture doc:
//   - Section 6: Concept implementations
//   - Section 6.1: ConceptHandler interface
//   - Section 6.2: Storage patterns
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

interface ActionDef {
  name: string;
  params: Array<{ name: string; type: string }>;
  variants: Array<{
    name: string;
    params: Array<{ name: string; type: string }>;
  }>;
}

interface InvariantDef {
  kind: 'example' | 'forall' | 'always' | 'never' | 'eventually' | 'requires_ensures';
  name?: string;
  afterPatterns: Array<{
    actionName: string;
    inputArgs: Array<{ name: string; value: string }>;
    variantName: string;
    outputArgs: Array<{ name: string; value: string }>;
  }>;
  thenPatterns: Array<{
    type: 'action_result' | 'assertion';
    actionName?: string;
    variantName?: string;
    inputArgs?: Array<{ name: string; value: string }>;
    left?: { variable: string; field: string };
    operator?: string;
    right?: string | number | boolean;
  }>;
  targetAction?: string;
  contracts?: Array<{
    kind: 'requires' | 'ensures';
    variant?: string;
    assertion: string;
  }>;
}

function mapTsType(conceptType: string): string {
  switch (conceptType.toLowerCase()) {
    case 'string': return 'string';
    case 'int':
    case 'integer':
    case 'number':
    case 'float': return 'number';
    case 'bool':
    case 'boolean': return 'boolean';
    default:
      if (conceptType.startsWith('list ')) return `${mapTsType(conceptType.slice(5))}[]`;
      if (conceptType.startsWith('set ')) return `Set<${mapTsType(conceptType.slice(4))}>`;
      if (conceptType.startsWith('map ')) return `Map<string, unknown>`;
      return 'unknown';
  }
}

function buildFunctionalHandlerImpl(input: Record<string, unknown>): string {
  const conceptName = (input.conceptName as string) || 'MyConcept';
  const actions = (input.actions as ActionDef[]) || [
    {
      name: 'create',
      params: [{ name: 'name', type: 'String' }],
      variants: [
        { name: 'ok', params: [{ name: 'item', type: 'String' }] },
        { name: 'error', params: [{ name: 'message', type: 'String' }] },
      ],
    },
  ];
  const relation = (input.relation as string) || toCamel(conceptName) + 's';

  const lines: string[] = [
    '// ============================================================',
    `// ${conceptName} Concept Implementation (Functional)`,
    '//',
    `// Functional handler for the ${conceptName} concept.`,
    '// Returns StorageProgram descriptions instead of executing effects directly.',
    '// ============================================================',
    '',
    "import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';",
    "import { createProgram, get, find, put, merge, del, branch, complete, pure } from '../../../runtime/storage-program.js';",
    '',
    `export const ${toCamel(conceptName)}Handler: FunctionalConceptHandler = {`,
  ];

  for (const action of actions) {
    const paramExtractions = action.params.map(p => {
      const tsType = mapTsType(p.type);
      return `    const ${p.name} = input.${p.name} as ${tsType};`;
    });

    lines.push(`  ${action.name}(input: Record<string, unknown>) {`);
    lines.push(...paramExtractions);
    lines.push('');
    lines.push('    let p = createProgram();');
    lines.push(`    // TODO: Implement ${action.name} logic using StorageProgram DSL`);
    lines.push(`    // Example: p = get(p, '${relation}', id, 'existing');`);
    lines.push('');

    // Find ok variant for return type
    const okVariant = action.variants.find(v => v.name === 'ok');
    if (okVariant) {
      const okParams = okVariant.params
        .map(p => `${p.name}: ${p.name === 'message' ? "'Success'" : 'undefined /* TODO */'}`)
        .join(', ');
      lines.push(`    return complete(p, 'ok', { ${okParams} });`);
    } else {
      lines.push("    return complete(p, 'ok', {});");
    }

    lines.push('  },');
    lines.push('');
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function buildImperativeHandlerImpl(input: Record<string, unknown>): string {
  const conceptName = (input.conceptName as string) || 'MyConcept';
  const actions = (input.actions as ActionDef[]) || [
    {
      name: 'create',
      params: [{ name: 'name', type: 'String' }],
      variants: [
        { name: 'ok', params: [{ name: 'item', type: 'String' }] },
        { name: 'error', params: [{ name: 'message', type: 'String' }] },
      ],
    },
  ];
  const inputKind = (input.inputKind as string) || conceptName;
  const outputKind = (input.outputKind as string) || `${conceptName}Result`;
  const capabilities = (input.capabilities as string[]) || [];
  const relation = (input.relation as string) || toCamel(conceptName) + 's';

  const lines: string[] = [
    '// ============================================================',
    `// ${conceptName} Concept Implementation (Imperative)`,
    '//',
    `// Imperative handler for the ${conceptName} concept.`,
    '// Use functional style (StorageProgram) for new concepts unless',
    '// the target language or concept constraints prevent it.',
    '// ============================================================',
    '',
    "import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';",
    '',
    `export const ${toCamel(conceptName)}Handler: ConceptHandler = {`,
    '  async register() {',
    '    return {',
    "      variant: 'ok',",
    `      name: '${conceptName}',`,
    `      inputKind: '${inputKind}',`,
    `      outputKind: '${outputKind}',`,
    `      capabilities: JSON.stringify(${JSON.stringify(capabilities)}),`,
    '    };',
    '  },',
    '',
  ];

  for (const action of actions) {
    const paramExtractions = action.params.map(p => {
      const tsType = mapTsType(p.type);
      return `    const ${p.name} = input.${p.name} as ${tsType};`;
    });

    lines.push(`  async ${action.name}(input: Record<string, unknown>, storage: ConceptStorage) {`);
    lines.push(...paramExtractions);
    lines.push('');

    // Validation
    const requiredParams = action.params.filter(p => p.type === 'String' || p.type === 'string');
    if (requiredParams.length > 0) {
      for (const p of requiredParams) {
        lines.push(`    if (!${p.name}) {`);
        lines.push(`      return { variant: 'error', message: '${p.name} is required' };`);
        lines.push('    }');
      }
      lines.push('');
    }

    lines.push('    try {');
    lines.push(`      // TODO: Implement ${action.name} logic`);

    // Find ok variant for return type
    const okVariant = action.variants.find(v => v.name === 'ok');
    if (okVariant) {
      const okParams = okVariant.params
        .map(p => `${p.name}: ${p.name === 'message' ? "'Success'" : 'undefined /* TODO */'}`)
        .join(', ');
      lines.push(`      return { variant: 'ok', ${okParams} };`);
    } else {
      lines.push("      return { variant: 'ok' };");
    }

    lines.push('    } catch (err: unknown) {');
    lines.push("      const message = err instanceof Error ? err.message : String(err);");
    lines.push("      return { variant: 'error', message };");
    lines.push('    }');
    lines.push('  },');
    lines.push('');
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function buildConformanceTest(input: Record<string, unknown>): string {
  const conceptName = (input.conceptName as string) || 'MyConcept';
  const actions = (input.actions as ActionDef[]) || [];
  const invariants = (input.invariants as InvariantDef[]) || [];
  const style = (input.style as string) || 'functional';
  const kebab = toKebab(conceptName);

  if (style === 'imperative') {
    return buildImperativeConformanceTest(conceptName, actions, kebab);
  }
  return buildFunctionalConformanceTest(conceptName, actions, kebab, invariants);
}

function buildFunctionalConformanceTest(conceptName: string, actions: ActionDef[], kebab: string, invariants: InvariantDef[] = []): string {
  const handlerVar = toCamel(conceptName) + 'Handler';
  const lines: string[] = [
    `// ${conceptName} Functional Handler Conformance Tests`,
    '//',
    '// Validates StorageProgram construction, purity, variant coverage,',
    '// read/write sets, interpreted execution, and invariant conformance.',
    '',
    "import { describe, it, expect, beforeEach } from 'vitest';",
    `import { ${handlerVar} } from '../handlers/ts/${kebab}.handler.js';`,
    "import {",
    "  classifyPurity,",
    "  extractCompletionVariants,",
    "  extractReadSet,",
    "  extractWriteSet,",
    "  extractPerformSet,",
    "} from '../runtime/storage-program.js';",
    "import { interpret } from '../runtime/interpreter.js';",
    "import { createInMemoryStorage } from '../runtime/adapters/storage.js';",
    '',
    `describe('${conceptName} functional handler', () => {`,
    '  let storage: ReturnType<typeof createInMemoryStorage>;',
    '',
    '  beforeEach(() => {',
    '    storage = createInMemoryStorage();',
    '  });',
    '',
  ];

  for (const action of actions) {
    const inputObj = action.params.map(p => {
      if (p.type === 'String' || p.type === 'string') return `${p.name}: 'test-${p.name}'`;
      if (p.type === 'Int' || p.type === 'number') return `${p.name}: 1`;
      if (p.type === 'Bool' || p.type === 'boolean') return `${p.name}: true`;
      return `${p.name}: 'test'`;
    }).join(', ');

    lines.push(`  describe('${action.name}', () => {`);

    // Test 1: Program construction
    lines.push(`    it('builds a valid StorageProgram', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push("      expect(program).toBeDefined();");
    lines.push("      expect(program.instructions).toBeDefined();");
    lines.push("      expect(Array.isArray(program.instructions)).toBe(true);");
    lines.push("      expect(program.instructions.length).toBeGreaterThan(0);");
    lines.push('    });');
    lines.push('');

    // Test 2: Purity classification
    lines.push(`    it('has classifiable purity', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push("      const purity = classifyPurity(program);");
    lines.push("      expect(['pure', 'read-only', 'read-write']).toContain(purity);");
    lines.push('    });');
    lines.push('');

    // Test 3: Variant coverage
    lines.push(`    it('covers all declared variants', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push("      const variants = extractCompletionVariants(program);");
    for (const v of action.variants) {
      lines.push(`      expect(variants).toContain('${v.name}');`);
    }
    lines.push('    });');
    lines.push('');

    // Test 4: Read/write sets are non-empty for storage-accessing actions
    lines.push(`    it('declares read and write sets', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push("      const reads = extractReadSet(program);");
    lines.push("      const writes = extractWriteSet(program);");
    lines.push("      const purity = classifyPurity(program);");
    lines.push("      if (purity === 'read-only') {");
    lines.push("        expect(reads.size).toBeGreaterThan(0);");
    lines.push("      } else if (purity === 'read-write') {");
    lines.push("        expect(writes.size).toBeGreaterThan(0);");
    lines.push("      }");
    lines.push('    });');
    lines.push('');

    // Test 5: Interpreted execution
    lines.push(`    it('executes successfully via interpreter', async () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push("      const result = await interpret(program, storage);");
    lines.push("      expect(result.variant).toBeDefined();");
    lines.push("      expect(typeof result.variant).toBe('string');");
    lines.push("      expect(result.output).toBeDefined();");
    lines.push("      expect(result.trace).toBeDefined();");
    lines.push("      expect(result.trace.steps.length).toBeGreaterThan(0);");
    lines.push('    });');
    lines.push('');

    // Test 6: Transport effects are trackable
    lines.push(`    it('has trackable transport effects', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push("      const effects = extractPerformSet(program);");
    lines.push("      expect(effects).toBeDefined();");
    lines.push("      // effects may be empty if action uses no transport");
    lines.push('    });');
    lines.push('');

    lines.push('  });');
    lines.push('');
  }

  // Generate tests from example invariants
  const examples = invariants.filter(inv => inv.kind === 'example' && inv.afterPatterns.length > 0);
  if (examples.length > 0) {
    lines.push(`  describe('invariant examples', () => {`);

    for (const example of examples) {
      const testName = example.name || 'unnamed example';
      lines.push(`    it(${JSON.stringify(testName)}, async () => {`);
      lines.push('      const storage = createInMemoryStorage();');

      // Execute each afterPattern step in sequence
      for (const step of example.afterPatterns) {
        const stepInput = step.inputArgs
          .map(a => `${a.name}: ${JSON.stringify(a.value)}`)
          .join(', ');
        lines.push(`      const ${step.actionName}Result = await interpret(`);
        lines.push(`        ${handlerVar}.${step.actionName}({ ${stepInput} }),`);
        lines.push('        storage,');
        lines.push('      );');
        if (step.variantName) {
          lines.push(`      expect(${step.actionName}Result.variant).toBe(${JSON.stringify(step.variantName)});`);
        }
        // Bind output variables
        for (const out of step.outputArgs) {
          lines.push(`      const ${out.name} = ${step.actionName}Result.output[${JSON.stringify(out.name)}];`);
        }
      }

      // Verify thenPatterns
      for (const then of example.thenPatterns) {
        if (then.type === 'action_result' && then.actionName) {
          const thenInput = (then.inputArgs || [])
            .map(a => `${a.name}: ${JSON.stringify(a.value)}`)
            .join(', ');
          lines.push(`      const thenResult = await interpret(`);
          lines.push(`        ${handlerVar}.${then.actionName}({ ${thenInput} }),`);
          lines.push('        storage,');
          lines.push('      );');
          if (then.variantName) {
            lines.push(`      expect(thenResult.variant).toBe(${JSON.stringify(then.variantName)});`);
          }
        } else if (then.type === 'assertion' && then.left && then.operator && then.right !== undefined) {
          const leftExpr = `${then.left.variable}Result.output[${JSON.stringify(then.left.field)}]`;
          const op = then.operator === '=' ? 'toBe' :
                     then.operator === '!=' ? 'not.toBe' :
                     then.operator === '>' ? 'toBeGreaterThan' :
                     then.operator === '<' ? 'toBeLessThan' :
                     then.operator === '>=' ? 'toBeGreaterThanOrEqual' :
                     then.operator === '<=' ? 'toBeLessThanOrEqual' : 'toBe';
          lines.push(`      expect(${leftExpr}).${op}(${JSON.stringify(then.right)});`);
        }
      }

      lines.push('    });');
      lines.push('');
    }
    lines.push('  });');
    lines.push('');
  }

  // Generate tests from requires_ensures contracts
  const contracts = invariants.filter(inv => inv.kind === 'requires_ensures' && inv.targetAction);
  if (contracts.length > 0) {
    lines.push(`  describe('action contracts', () => {`);

    for (const contract of contracts) {
      const action = actions.find(a => a.name === contract.targetAction);
      if (!action) continue;

      for (const c of contract.contracts || []) {
        if (c.kind === 'requires') {
          lines.push(`    it('${contract.targetAction} requires: ${c.assertion}', async () => {`);
          lines.push('      const storage = createInMemoryStorage();');
          lines.push(`      // Violate precondition: ${c.assertion}`);
          lines.push(`      const program = ${handlerVar}.${contract.targetAction}({});`);
          lines.push('      const result = await interpret(program, storage);');
          lines.push("      // Should fail or return error variant when precondition violated");
          lines.push("      expect(['error', 'invalid', 'missing', 'notFound']).toContain(result.variant);");
          lines.push('    });');
          lines.push('');
        } else if (c.kind === 'ensures' && c.variant) {
          lines.push(`    it('${contract.targetAction} ensures on ${c.variant}: ${c.assertion}', async () => {`);
          lines.push('      const storage = createInMemoryStorage();');
          const inputObj = action.params.map(p => {
            if (p.type === 'String' || p.type === 'string') return `${p.name}: 'test-${p.name}'`;
            if (p.type === 'Int' || p.type === 'number') return `${p.name}: 1`;
            if (p.type === 'Bool' || p.type === 'boolean') return `${p.name}: true`;
            return `${p.name}: 'test'`;
          }).join(', ');
          lines.push(`      const program = ${handlerVar}.${contract.targetAction}({ ${inputObj} });`);
          lines.push('      const result = await interpret(program, storage);');
          lines.push(`      if (result.variant === ${JSON.stringify(c.variant)}) {`);
          lines.push(`        // Postcondition: ${c.assertion}`);
          lines.push('        expect(result.output).toBeDefined();');
          lines.push('      }');
          lines.push('    });');
          lines.push('');
        }
      }
    }

    lines.push('  });');
    lines.push('');
  }

  // Generate tests from always/never invariants
  const alwaysInvariants = invariants.filter(inv => inv.kind === 'always');
  const neverInvariants = invariants.filter(inv => inv.kind === 'never');

  if (alwaysInvariants.length > 0 || neverInvariants.length > 0) {
    lines.push(`  describe('state invariants', () => {`);

    for (const inv of alwaysInvariants) {
      const invName = inv.name || 'unnamed always invariant';
      lines.push(`    it('always: ${invName}', async () => {`);
      lines.push('      const storage = createInMemoryStorage();');
      lines.push('      // Execute a representative action sequence');
      // Use first action as representative
      if (actions.length > 0) {
        const action = actions[0];
        const inputObj = action.params.map(p => {
          if (p.type === 'String' || p.type === 'string') return `${p.name}: 'test-${p.name}'`;
          if (p.type === 'Int' || p.type === 'number') return `${p.name}: 1`;
          if (p.type === 'Bool' || p.type === 'boolean') return `${p.name}: true`;
          return `${p.name}: 'test'`;
        }).join(', ');
        lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
        lines.push('      const result = await interpret(program, storage);');
        lines.push('      expect(result.variant).toBeDefined();');
      }
      lines.push(`      // Invariant: ${invName}`);
      lines.push('      // State predicate should hold after any action');
      lines.push('    });');
      lines.push('');
    }

    for (const inv of neverInvariants) {
      const invName = inv.name || 'unnamed never invariant';
      lines.push(`    it('never: ${invName}', async () => {`);
      lines.push('      const storage = createInMemoryStorage();');
      if (actions.length > 0) {
        const action = actions[0];
        const inputObj = action.params.map(p => {
          if (p.type === 'String' || p.type === 'string') return `${p.name}: 'test-${p.name}'`;
          if (p.type === 'Int' || p.type === 'number') return `${p.name}: 1`;
          if (p.type === 'Bool' || p.type === 'boolean') return `${p.name}: true`;
          return `${p.name}: 'test'`;
        }).join(', ');
        lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
        lines.push('      const result = await interpret(program, storage);');
        lines.push('      expect(result.variant).toBeDefined();');
      }
      lines.push(`      // Safety: ${invName}`);
      lines.push('      // Bad state should never be reachable');
      lines.push('    });');
      lines.push('');
    }

    lines.push('  });');
    lines.push('');
  }

  // Generate property-based tests from forall invariants
  const forallInvariants = invariants.filter(inv => inv.kind === 'forall');
  if (forallInvariants.length > 0) {
    lines.push(`  describe('forall properties', () => {`);

    for (const inv of forallInvariants) {
      const invName = inv.name || 'unnamed forall property';
      lines.push(`    it('forall: ${invName}', async () => {`);
      lines.push('      const storage = createInMemoryStorage();');

      // Generate quantifier domain values to test against
      if (inv.quantifiers && inv.quantifiers.length > 0) {
        for (const q of inv.quantifiers as Array<{ variable: string; domain: { type: string; values?: string[]; name?: string } }>) {
          if (q.domain.type === 'set_literal' && q.domain.values) {
            lines.push(`      const ${q.variable}Values = ${JSON.stringify(q.domain.values)};`);
            lines.push(`      for (const ${q.variable} of ${q.variable}Values) {`);
          } else if (q.domain.type === 'state_field' && q.domain.name) {
            lines.push(`      // Quantified over state field: ${q.domain.name}`);
            lines.push(`      // Test with representative values`);
            lines.push(`      const ${q.variable}Values = ['test-a', 'test-b', 'test-c'];`);
            lines.push(`      for (const ${q.variable} of ${q.variable}Values) {`);
          } else {
            lines.push(`      const ${q.variable}Values = ['test-val'];`);
            lines.push(`      for (const ${q.variable} of ${q.variable}Values) {`);
          }
        }
      }

      // Execute afterPatterns inside the loop
      for (const step of inv.afterPatterns) {
        const stepInput = step.inputArgs
          .map(a => `${a.name}: ${JSON.stringify(a.value)}`)
          .join(', ');
        lines.push(`        const result = await interpret(`);
        lines.push(`          ${handlerVar}.${step.actionName}({ ${stepInput} }),`);
        lines.push('          storage,');
        lines.push('        );');
        lines.push('        expect(result.variant).toBeDefined();');
      }

      // Close quantifier loops
      if (inv.quantifiers) {
        for (const _q of inv.quantifiers) {
          lines.push('      }');
        }
      }

      lines.push('    });');
      lines.push('');
    }

    lines.push('  });');
    lines.push('');
  }

  // Generate bounded liveness tests from eventually invariants
  const eventuallyInvariants = invariants.filter(inv => inv.kind === 'eventually');
  if (eventuallyInvariants.length > 0) {
    lines.push(`  describe('eventually (bounded liveness)', () => {`);

    for (const inv of eventuallyInvariants) {
      const invName = inv.name || 'unnamed eventually property';
      lines.push(`    it('eventually: ${invName}', async () => {`);
      lines.push('      const storage = createInMemoryStorage();');
      lines.push('      let reached = false;');
      lines.push('      const MAX_STEPS = 10;');
      lines.push('');

      // Execute afterPatterns as setup
      for (const step of inv.afterPatterns) {
        const stepInput = step.inputArgs
          .map(a => `${a.name}: ${JSON.stringify(a.value)}`)
          .join(', ');
        lines.push(`      const setupResult = await interpret(`);
        lines.push(`        ${handlerVar}.${step.actionName}({ ${stepInput} }),`);
        lines.push('        storage,');
        lines.push('      );');
        lines.push('      expect(setupResult.variant).toBeDefined();');
      }

      // Check thenPatterns in a bounded loop
      if (inv.thenPatterns.length > 0 && inv.thenPatterns[0].actionName) {
        const then = inv.thenPatterns[0];
        const thenInput = (then.inputArgs || [])
          .map(a => `${a.name}: ${JSON.stringify(a.value)}`)
          .join(', ');
        lines.push('');
        lines.push('      for (let step = 0; step < MAX_STEPS && !reached; step++) {');
        lines.push(`        const result = await interpret(`);
        lines.push(`          ${handlerVar}.${then.actionName}({ ${thenInput} }),`);
        lines.push('          storage,');
        lines.push('        );');
        if (then.variantName) {
          lines.push(`        if (result.variant === ${JSON.stringify(then.variantName)}) reached = true;`);
        } else {
          lines.push("        if (result.variant === 'ok') reached = true;");
        }
        lines.push('      }');
      } else {
        lines.push('      reached = true; // No then-action to check; pass vacuously');
      }

      lines.push(`      expect(reached).toBe(true); // Liveness: ${invName}`);
      lines.push('    });');
      lines.push('');
    }

    lines.push('  });');
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function buildImperativeConformanceTest(conceptName: string, actions: ActionDef[], kebab: string): string {
  const lines: string[] = [
    "import { describe, it, expect } from 'vitest';",
    `import { ${toCamel(conceptName)}Handler } from '../handlers/ts/${kebab}.handler.js';`,
    "import { createInMemoryStorage } from '../runtime/adapters/storage.js';",
    '',
    `describe('${conceptName} handler', () => {`,
    '  it(\'should register with correct metadata\', async () => {',
    '    const storage = createInMemoryStorage();',
    '    const result = await ' + toCamel(conceptName) + 'Handler.register!({}, storage);',
    "    expect(result.variant).toBe('ok');",
    `    expect(result.name).toBe('${conceptName}');`,
    '  });',
    '',
  ];

  for (const action of actions) {
    lines.push(`  it('should handle ${action.name}', async () => {`);
    lines.push('    const storage = createInMemoryStorage();');
    const inputObj = action.params.map(p => {
      if (p.type === 'String' || p.type === 'string') return `${p.name}: 'test'`;
      if (p.type === 'Int' || p.type === 'number') return `${p.name}: 1`;
      if (p.type === 'Bool' || p.type === 'boolean') return `${p.name}: true`;
      return `${p.name}: undefined`;
    }).join(', ');
    lines.push(`    const result = await ${toCamel(conceptName)}Handler.${action.name}({ ${inputObj} }, storage);`);
    lines.push("    expect(result.variant).toBeDefined();");
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

export const handlerScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'HandlerScaffoldGen',
      inputKind: 'HandlerConfig',
      outputKind: 'HandlerImpl',
      capabilities: JSON.stringify(['impl-ts', 'conformance-test', 'storage-patterns']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const conceptName = (input.conceptName as string) || 'MyConcept';
    const style = (input.style as string) || 'functional';

    if (!conceptName || typeof conceptName !== 'string') {
      return { variant: 'error', message: 'Concept name is required' };
    }

    try {
      const kebab = toKebab(conceptName);
      const handlerCode = style === 'imperative'
        ? buildImperativeHandlerImpl(input)
        : buildFunctionalHandlerImpl(input);

      const files: { path: string; content: string }[] = [
        {
          path: `handlers/ts/${kebab}.stub.handler.ts`,
          content: handlerCode,
        },
      ];

      // Generate conformance test if actions are provided
      if (input.actions) {
        const testCode = buildConformanceTest(input);
        files.push({
          path: `tests/conformance/${kebab}.stub.conformance.test.ts`,
          content: testCode,
        });
      }

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return { variant: 'error', message, ...(stack ? { stack } : {}) };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await handlerScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    return {
      variant: 'ok',
      files,
      wouldWrite: files.length,
      wouldSkip: 0,
    };
  },
};
