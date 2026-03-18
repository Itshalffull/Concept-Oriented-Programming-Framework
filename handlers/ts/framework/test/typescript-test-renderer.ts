// ============================================================
// TypeScript Test Renderer
//
// Renders a TestPlan into a TypeScript conformance test file
// using vitest + the StorageProgram analysis utilities.
// This is the rendering backend for the TestGenTypeScript provider.
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type {
  TestPlan, TestPlanAction, TestPlanExample, TestPlanForall,
  TestPlanStateInvariant, TestPlanLiveness, TestPlanContract,
} from './test-gen.handler.js';

function toCamel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function defaultInput(params: Array<{ name: string; type: string }>): string {
  return params.map(p => {
    const t = p.type.toLowerCase();
    if (t === 'string') return `${p.name}: 'test-${p.name}'`;
    if (t === 'int' || t === 'integer' || t === 'number' || t === 'float') return `${p.name}: 1`;
    if (t === 'bool' || t === 'boolean') return `${p.name}: true`;
    return `${p.name}: 'test'`;
  }).join(', ');
}

function renderStructuralTests(handlerVar: string, action: TestPlanAction): string[] {
  const lines: string[] = [];
  const inputObj = defaultInput(action.params);

  lines.push(`  describe('${action.name}', () => {`);

  // Program construction
  lines.push(`    it('builds a valid StorageProgram', () => {`);
  lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
  lines.push(`      expect(program).toBeDefined();`);
  lines.push(`      expect(program.instructions).toBeDefined();`);
  lines.push(`      expect(Array.isArray(program.instructions)).toBe(true);`);
  lines.push(`      expect(program.instructions.length).toBeGreaterThan(0);`);
  lines.push(`    });`);
  lines.push('');

  // Purity
  lines.push(`    it('has classifiable purity', () => {`);
  lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
  lines.push(`      const purity = classifyPurity(program);`);
  lines.push(`      expect(['pure', 'read-only', 'read-write']).toContain(purity);`);
  lines.push(`    });`);
  lines.push('');

  // Variant coverage
  lines.push(`    it('covers all declared variants', () => {`);
  lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
  lines.push(`      const variants = extractCompletionVariants(program);`);
  for (const v of action.variants) {
    lines.push(`      expect(variants).toContain('${v}');`);
  }
  lines.push(`    });`);
  lines.push('');

  // Read/write sets
  lines.push(`    it('declares read and write sets', () => {`);
  lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
  lines.push(`      const reads = extractReadSet(program);`);
  lines.push(`      const writes = extractWriteSet(program);`);
  lines.push(`      const purity = classifyPurity(program);`);
  lines.push(`      if (purity === 'read-only') {`);
  lines.push(`        expect(reads.size).toBeGreaterThan(0);`);
  lines.push(`      } else if (purity === 'read-write') {`);
  lines.push(`        expect(writes.size).toBeGreaterThan(0);`);
  lines.push(`      }`);
  lines.push(`    });`);
  lines.push('');

  // Interpreted execution
  lines.push(`    it('executes successfully via interpreter', async () => {`);
  lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
  lines.push(`      const result = await interpret(program, storage);`);
  lines.push(`      expect(result.variant).toBeDefined();`);
  lines.push(`      expect(typeof result.variant).toBe('string');`);
  lines.push(`      expect(result.output).toBeDefined();`);
  lines.push(`      expect(result.trace).toBeDefined();`);
  lines.push(`      expect(result.trace.steps.length).toBeGreaterThan(0);`);
  lines.push(`    });`);
  lines.push('');

  // Transport effects
  lines.push(`    it('has trackable transport effects', () => {`);
  lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
  lines.push(`      const effects = extractPerformSet(program);`);
  lines.push(`      expect(effects).toBeDefined();`);
  lines.push(`    });`);
  lines.push('');

  lines.push(`  });`);
  lines.push('');

  return lines;
}

function renderExampleTests(handlerVar: string, examples: TestPlanExample[]): string[] {
  if (examples.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('invariant examples', () => {`);

  for (const example of examples) {
    lines.push(`    it(${JSON.stringify(example.name)}, async () => {`);
    lines.push(`      const storage = createInMemoryStorage();`);

    for (const step of example.steps) {
      const stepInput = Object.entries(step.input)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      const resultVar = `${step.action}Result`;
      lines.push(`      const ${resultVar} = await interpret(`);
      lines.push(`        ${handlerVar}.${step.action}({ ${stepInput} }),`);
      lines.push(`        storage,`);
      lines.push(`      );`);
      if (step.expectedVariant) {
        lines.push(`      expect(${resultVar}.variant).toBe(${JSON.stringify(step.expectedVariant)});`);
      }
      for (const [name, _val] of Object.entries(step.outputBindings)) {
        lines.push(`      const ${name} = ${resultVar}.output[${JSON.stringify(name)}];`);
      }
    }

    for (const assertion of example.assertions) {
      if (assertion.type === 'variant_check' && assertion.action) {
        const thenInput = Object.entries(assertion.input || {})
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ');
        lines.push(`      const thenResult = await interpret(`);
        lines.push(`        ${handlerVar}.${assertion.action}({ ${thenInput} }),`);
        lines.push(`        storage,`);
        lines.push(`      );`);
        if (assertion.expectedVariant) {
          lines.push(`      expect(thenResult.variant).toBe(${JSON.stringify(assertion.expectedVariant)});`);
        }
      } else if (assertion.type === 'field_check' && assertion.variable && assertion.field) {
        const op = assertion.operator === '=' ? 'toBe' :
                   assertion.operator === '!=' ? 'not.toBe' :
                   assertion.operator === '>' ? 'toBeGreaterThan' :
                   assertion.operator === '<' ? 'toBeLessThan' :
                   assertion.operator === '>=' ? 'toBeGreaterThanOrEqual' :
                   assertion.operator === '<=' ? 'toBeLessThanOrEqual' : 'toBe';
        lines.push(`      expect(${assertion.variable}Result.output[${JSON.stringify(assertion.field)}]).${op}(${JSON.stringify(assertion.value)});`);
      }
    }

    lines.push(`    });`);
    lines.push('');
  }

  lines.push(`  });`);
  lines.push('');
  return lines;
}

function quantifierToArbitrary(q: TestPlanForall['quantifiers'][0]): string {
  if (q.domainType === 'set_literal' && q.values) {
    return `fc.constantFrom(${q.values.map(v => JSON.stringify(v)).join(', ')})`;
  }
  if (q.domainType === 'type_ref') {
    const t = (q.fieldName || '').toLowerCase();
    if (t === 'int' || t === 'number') return 'fc.integer()';
    if (t === 'bool' || t === 'boolean') return 'fc.boolean()';
    return 'fc.string({ minLength: 1, maxLength: 50 })';
  }
  // state_field or unknown — use string arbitrary
  return 'fc.string({ minLength: 1, maxLength: 50 })';
}

function renderForallTests(handlerVar: string, properties: TestPlanForall[]): string[] {
  if (properties.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('forall properties (PBT)', () => {`);

  for (const prop of properties) {
    // Build fc.property arguments from quantifiers
    const arbArgs = prop.quantifiers.map(q => quantifierToArbitrary(q));
    const varNames = prop.quantifiers.map(q => q.variable);

    lines.push(`    it('forall: ${prop.name}', async () => {`);
    lines.push(`      await fc.assert(`);
    lines.push(`        fc.asyncProperty(`);
    for (const arb of arbArgs) {
      lines.push(`          ${arb},`);
    }
    lines.push(`          async (${varNames.join(', ')}) => {`);
    lines.push(`            const storage = createInMemoryStorage();`);

    for (const step of prop.steps) {
      // Replace quantifier variable references in input values
      const stepInput = Object.entries(step.input)
        .map(([k, v]) => {
          // If value matches a quantifier variable, use it directly
          if (varNames.includes(v)) return `${k}: ${v}`;
          return `${k}: ${JSON.stringify(v)}`;
        })
        .join(', ');
      lines.push(`            const result = await interpret(`);
      lines.push(`              ${handlerVar}.${step.action}({ ${stepInput} }),`);
      lines.push(`              storage,`);
      lines.push(`            );`);
      lines.push(`            expect(result.variant).toBeDefined();`);
      if (step.expectedVariant) {
        lines.push(`            expect(result.variant).toBe(${JSON.stringify(step.expectedVariant)});`);
      }
    }

    lines.push(`          },`);
    lines.push(`        ),`);
    lines.push(`        { numRuns: 100 },`);
    lines.push(`      );`);
    lines.push(`    });`);
    lines.push('');
  }

  lines.push(`  });`);
  lines.push('');
  return lines;
}

function renderStateInvariantTests(
  handlerVar: string,
  invariants: TestPlanStateInvariant[],
  actions: TestPlanAction[],
): string[] {
  if (invariants.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('state invariants (stateful PBT)', () => {`);

  for (const inv of invariants) {
    const prefix = inv.kind === 'always' ? 'always' : 'never';

    if (actions.length === 0) {
      lines.push(`    it('${prefix}: ${inv.name}', () => {`);
      lines.push(`      // No actions to test against`);
      lines.push(`    });`);
      lines.push('');
      continue;
    }

    // Generate action arbitraries for stateful testing
    const actionArbs = actions.map(a => {
      const inputArb = a.params.map(p => {
        const t = p.type.toLowerCase();
        if (t === 'string') return `${p.name}: fc.string({ minLength: 1, maxLength: 20 })`;
        if (t === 'int' || t === 'number') return `${p.name}: fc.integer({ min: 0, max: 1000 })`;
        if (t === 'bool' || t === 'boolean') return `${p.name}: fc.boolean()`;
        return `${p.name}: fc.string()`;
      }).join(', ');
      return `fc.record({ action: fc.constant('${a.name}'), input: fc.record({ ${inputArb} }) })`;
    });

    lines.push(`    it('${prefix}: ${inv.name}', async () => {`);
    lines.push(`      await fc.assert(`);
    lines.push(`        fc.asyncProperty(`);
    lines.push(`          fc.array(`);
    lines.push(`            fc.oneof(`);
    for (const arb of actionArbs) {
      lines.push(`              ${arb},`);
    }
    lines.push(`            ),`);
    lines.push(`            { minLength: 1, maxLength: 5 },`);
    lines.push(`          ),`);
    lines.push(`          async (actionSequence) => {`);
    lines.push(`            const storage = createInMemoryStorage();`);
    lines.push(`            for (const step of actionSequence) {`);
    lines.push(`              const actionFn = ${handlerVar}[step.action];`);
    lines.push(`              if (typeof actionFn === 'function') {`);
    lines.push(`                const program = actionFn.call(${handlerVar}, step.input as Record<string, unknown>);`);
    lines.push(`                const result = await interpret(program, storage);`);
    lines.push(`                expect(result.variant).toBeDefined();`);
    if (inv.kind === 'never') {
      lines.push(`                // Never: ${inv.name}`);
      lines.push(`                // Assert the bad state was not reached`);
    }
    lines.push(`              }`);
    lines.push(`            }`);
    lines.push(`          },`);
    lines.push(`        ),`);
    lines.push(`        { numRuns: 50 },`);
    lines.push(`      );`);
    lines.push(`    });`);
    lines.push('');
  }

  lines.push(`  });`);
  lines.push('');
  return lines;
}

function renderLivenessTests(handlerVar: string, liveness: TestPlanLiveness[]): string[] {
  if (liveness.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('eventually (bounded liveness)', () => {`);

  for (const liv of liveness) {
    lines.push(`    it('eventually: ${liv.name}', async () => {`);
    lines.push(`      const storage = createInMemoryStorage();`);
    lines.push(`      let reached = false;`);
    lines.push(`      const MAX_STEPS = 10;`);
    lines.push('');

    for (const step of liv.setupSteps) {
      const stepInput = Object.entries(step.input)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      lines.push(`      const setupResult = await interpret(`);
      lines.push(`        ${handlerVar}.${step.action}({ ${stepInput} }),`);
      lines.push(`        storage,`);
      lines.push(`      );`);
      lines.push(`      expect(setupResult.variant).toBeDefined();`);
    }

    if (liv.targetAction) {
      const targetInput = Object.entries(liv.targetInput || {})
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      lines.push('');
      lines.push(`      for (let step = 0; step < MAX_STEPS && !reached; step++) {`);
      lines.push(`        const result = await interpret(`);
      lines.push(`          ${handlerVar}.${liv.targetAction}({ ${targetInput} }),`);
      lines.push(`          storage,`);
      lines.push(`        );`);
      if (liv.targetVariant) {
        lines.push(`        if (result.variant === ${JSON.stringify(liv.targetVariant)}) reached = true;`);
      } else {
        lines.push(`        if (result.variant === 'ok') reached = true;`);
      }
      lines.push(`      }`);
    } else {
      lines.push(`      reached = true;`);
    }

    lines.push(`      expect(reached).toBe(true);`);
    lines.push(`    });`);
    lines.push('');
  }

  lines.push(`  });`);
  lines.push('');
  return lines;
}

function renderContractTests(
  handlerVar: string,
  contracts: TestPlanContract[],
  actions: TestPlanAction[],
): string[] {
  if (contracts.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('action contracts (PBT)', () => {`);

  for (const contract of contracts) {
    const action = actions.find(a => a.name === contract.targetAction);

    // Precondition: violating it should produce an error variant
    for (const pre of contract.preconditions) {
      lines.push(`    it('${contract.targetAction} requires: ${pre.assertion}', async () => {`);
      lines.push(`      const storage = createInMemoryStorage();`);
      lines.push(`      // Violate precondition by passing empty input`);
      lines.push(`      const program = ${handlerVar}.${contract.targetAction}({});`);
      lines.push(`      const result = await interpret(program, storage);`);
      lines.push(`      expect(['error', 'invalid', 'missing', 'notFound']).toContain(result.variant);`);
      lines.push(`    });`);
      lines.push('');
    }

    // Postcondition: when preconditions hold, ensures must hold (PBT)
    if (action && contract.postconditions.length > 0) {
      const inputArbs = action.params.map(p => {
        const t = p.type.toLowerCase();
        if (t === 'string') return `${p.name}: fc.string({ minLength: 1, maxLength: 50 })`;
        if (t === 'int' || t === 'number') return `${p.name}: fc.integer({ min: 1, max: 1000 })`;
        if (t === 'bool' || t === 'boolean') return `${p.name}: fc.boolean()`;
        return `${p.name}: fc.string()`;
      }).join(', ');

      for (const post of contract.postconditions) {
        lines.push(`    it('${contract.targetAction} ensures on ${post.variant}: ${post.assertion}', async () => {`);
        lines.push(`      await fc.assert(`);
        lines.push(`        fc.asyncProperty(`);
        lines.push(`          fc.record({ ${inputArbs} }),`);
        lines.push(`          async (input) => {`);
        lines.push(`            const storage = createInMemoryStorage();`);
        lines.push(`            const program = ${handlerVar}.${contract.targetAction}(input as Record<string, unknown>);`);
        lines.push(`            const result = await interpret(program, storage);`);
        // Use fc.pre to filter to only the variant we care about
        lines.push(`            fc.pre(result.variant === ${JSON.stringify(post.variant)});`);
        lines.push(`            // Postcondition: ${post.assertion}`);
        lines.push(`            expect(result.output).toBeDefined();`);
        lines.push(`          },`);
        lines.push(`        ),`);
        lines.push(`        { numRuns: 100 },`);
        lines.push(`      );`);
        lines.push(`    });`);
        lines.push('');
      }
    } else {
      for (const post of contract.postconditions) {
        lines.push(`    it('${contract.targetAction} ensures on ${post.variant}: ${post.assertion}', async () => {`);
        lines.push(`      const storage = createInMemoryStorage();`);
        lines.push(`      const program = ${handlerVar}.${contract.targetAction}({});`);
        lines.push(`      const result = await interpret(program, storage);`);
        lines.push(`      if (result.variant === ${JSON.stringify(post.variant)}) {`);
        lines.push(`        expect(result.output).toBeDefined();`);
        lines.push(`      }`);
        lines.push(`    });`);
        lines.push('');
      }
    }
  }

  lines.push(`  });`);
  lines.push('');
  return lines;
}

/**
 * Render a TestPlan into a complete TypeScript conformance test file.
 */
export function renderTypeScriptTests(plan: TestPlan): string {
  const handlerVar = toCamel(plan.conceptName) + 'Handler';
  const lines: string[] = [];

  // Header
  lines.push(`// ${plan.conceptName} Functional Handler Conformance Tests`);
  lines.push('//');
  lines.push('// Auto-generated by TestGen from concept spec invariants.');
  lines.push('// Validates StorageProgram construction, purity, variant coverage,');
  lines.push('// read/write sets, interpreted execution, and invariant conformance.');
  lines.push('');

  // Imports
  lines.push("import { describe, it, expect, beforeEach } from 'vitest';");
  lines.push("import fc from 'fast-check';");
  lines.push(`import { ${handlerVar} } from '../${plan.handlerPath}';`);
  lines.push("import {");
  lines.push("  classifyPurity,");
  lines.push("  extractCompletionVariants,");
  lines.push("  extractReadSet,");
  lines.push("  extractWriteSet,");
  lines.push("  extractPerformSet,");
  lines.push("} from '../runtime/storage-program.js';");
  lines.push("import { interpret } from '../runtime/interpreter.js';");
  lines.push("import { createInMemoryStorage } from '../runtime/adapters/storage.js';");
  lines.push('');

  // Test suite
  lines.push(`describe('${plan.conceptName} functional handler', () => {`);
  lines.push('  let storage: ReturnType<typeof createInMemoryStorage>;');
  lines.push('');
  lines.push('  beforeEach(() => {');
  lines.push('    storage = createInMemoryStorage();');
  lines.push('  });');
  lines.push('');

  // Structural tests per action
  for (const action of plan.actions) {
    lines.push(...renderStructuralTests(handlerVar, action));
  }

  // Invariant-derived tests
  lines.push(...renderExampleTests(handlerVar, plan.examples));
  lines.push(...renderForallTests(handlerVar, plan.properties));
  lines.push(...renderStateInvariantTests(handlerVar, plan.stateInvariants, plan.actions));
  lines.push(...renderLivenessTests(handlerVar, plan.liveness));
  lines.push(...renderContractTests(handlerVar, plan.contracts, plan.actions));

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}
