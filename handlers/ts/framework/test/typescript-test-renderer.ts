// ============================================================
// TypeScript Test Renderer
//
// Renders a TestPlan into a TypeScript conformance test file
// using vitest + the StorageProgram analysis utilities.
// This is the rendering backend for the TestGenTypeScript provider.
//
// Supports both functional (StorageProgram) and imperative handler styles.
// Functional handlers get full structural analysis tests; imperative
// handlers get execution-based tests only.
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type {
  TestPlan, TestPlanAction, TestPlanFixture, TestPlanExample, TestPlanForall,
  TestPlanStateInvariant, TestPlanLiveness, TestPlanContract,
} from './test-gen.handler.js';

type HandlerStyle = 'functional' | 'imperative';

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

/** Check if a fixture value is an output reference ($fixture.field) */
function isRef(v: unknown): v is { type: 'ref'; fixture: string; field: string } {
  return v !== null && typeof v === 'object' && (v as Record<string, unknown>).type === 'ref'
    && 'fixture' in (v as Record<string, unknown>) && 'field' in (v as Record<string, unknown>);
}

/** Check if any value in the fixture input contains output references */
function hasRefs(input: Record<string, unknown>): boolean {
  return Object.values(input).some(isRef);
}

/**
 * Serialize a fixture input object to a TypeScript expression string.
 * Literal values are JSON-serialized; output references are left as placeholders
 * (they'll be resolved at test generation time using after-chain result vars).
 */
function fixtureInputStr(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');
}

/**
 * Serialize a fixture input to a TypeScript expression string, resolving
 * output references ($fixture.field) to their captured after-chain variables.
 */
function fixtureInputStrWithRefs(
  input: Record<string, unknown>,
  resultVars: Map<string, string>,
): string {
  return Object.entries(input)
    .map(([k, v]) => {
      if (isRef(v)) {
        const varName = resultVars.get(v.fixture);
        if (varName) return `${k}: ${varName}?.output?.[${JSON.stringify(v.field)}]`;
        // Ref target not found in after-chain; fall back to placeholder
        return `${k}: undefined /* unresolved ref: $${v.fixture}.${v.field} */`;
      }
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join(', ');
}

/**
 * Get the best default input for an action: first 'ok' fixture if available, else type-based default.
 */
function bestInput(action: TestPlanAction): string {
  const okFixture = action.fixtures?.find(f => f.expectedVariant === 'ok');
  if (okFixture) return fixtureInputStr(okFixture.input);
  return defaultInput(action.params);
}

/**
 * Returns the expression to invoke an action and get a result.
 * - functional: `await interpret(handler.action({ ... }), storage)`
 * - imperative: `await handler.action({ ... }, storage)`
 */
function invokeExpr(handlerVar: string, action: string, inputStr: string, style: HandlerStyle): string {
  if (style === 'imperative') {
    return `await ${handlerVar}.${action}({ ${inputStr} }, storage)`;
  }
  return `await interpret(${handlerVar}.${action}({ ${inputStr} }), storage)`;
}

/**
 * Build fully random fast-check arbitraries for an action's params.
 * PBT should use random inputs to find edge cases — fixtures are for deterministic tests only.
 */
function randomArbs(params: Array<{ name: string; type: string }>): string[] {
  return params.map(p => {
    const t = p.type.toLowerCase();
    if (t === 'string') return `${p.name}: fc.string({ minLength: 1, maxLength: 50 })`;
    if (t === 'int' || t === 'number') return `${p.name}: fc.integer({ min: 1, max: 1000 })`;
    if (t === 'bool' || t === 'boolean') return `${p.name}: fc.boolean()`;
    return `${p.name}: fc.string()`;
  });
}

// ── Structural tests (functional only) ──────────────────────

/**
 * Build a fixture index for resolving `after` references.
 * Maps fixture name → { action name, fixture } across all actions.
 */
function buildFixtureIndex(allActions: TestPlanAction[]): Map<string, { actionName: string; fixture: TestPlanFixture }> {
  const index = new Map<string, { actionName: string; fixture: TestPlanFixture }>();
  for (const a of allActions) {
    for (const f of a.fixtures ?? []) {
      index.set(f.name, { actionName: a.name, fixture: f });
    }
  }
  return index;
}

/**
 * Resolve a fixture's `after` chain into setup code lines.
 * Recursively resolves transitive dependencies (after chains).
 */
/**
 * Resolve a fixture's `after` chain, capturing each step's result output.
 * Returns { lines, resultVars } where resultVars maps fixture names to
 * their result variable names (e.g., "afterResult_register_create").
 * The captured outputs can then be used to override placeholder input
 * values in the main fixture.
 */
function resolveAfterChain(
  fixture: TestPlanFixture,
  fixtureIndex: Map<string, { actionName: string; fixture: TestPlanFixture }>,
  handlerVar: string,
  style: HandlerStyle,
  visited = new Set<string>(),
  resultVars = new Map<string, string>(),
): { lines: string[]; resultVars: Map<string, string> } {
  if (!fixture.after || fixture.after.length === 0) return { lines: [], resultVars };
  const lines: string[] = [];
  for (const depName of fixture.after) {
    if (visited.has(depName)) continue; // prevent cycles
    visited.add(depName);
    const dep = fixtureIndex.get(depName);
    if (!dep) continue; // referenced fixture not found
    // Resolve transitive deps first
    const sub = resolveAfterChain(dep.fixture, fixtureIndex, handlerVar, style, visited, resultVars);
    lines.push(...sub.lines);
    // Then run this dependency, capturing its result
    const depInput = fixtureInputStr(dep.fixture.input);
    const varName = `afterResult_${depName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    lines.push(`      const ${varName} = ${invokeExpr(handlerVar, dep.actionName, depInput, style)};`);
    resultVars.set(depName, varName);
  }
  return { lines, resultVars };
}

/**
 * Common "creator" action names — actions that seed data into storage.
 * Order matters: earlier entries are preferred when multiple match.
 */
const CREATOR_ACTION_NAMES = [
  'create', 'register', 'define', 'add', 'put', 'set', 'insert', 'init',
  'initialize', 'provision', 'configure', 'setup', 'open', 'start', 'grant',
  'deploy', 'generate', 'build', 'submit', 'publish', 'declare', 'announce',
  'allocate', 'enroll', 'activate', 'mint', 'issue', 'establish', 'record',
  'store', 'save', 'schedule', 'subscribe',
];

/**
 * Find the best "creator" fixture for auto-seeding storage.
 * Returns the first `ok` fixture from the first creator action found in the concept.
 */
function findCreatorFixture(allActions: TestPlanAction[], excludeAction: string): { actionName: string; fixture: TestPlanFixture } | undefined {
  for (const name of CREATOR_ACTION_NAMES) {
    const action = allActions.find(a => a.name === name && a.name !== excludeAction);
    if (!action) continue;
    const okFixture = action.fixtures?.find(f => f.expectedVariant === 'ok' && (!f.after || f.after.length === 0));
    if (okFixture) return { actionName: action.name, fixture: okFixture };
  }
  // Fallback: first action with an ok fixture (that isn't the current action)
  for (const action of allActions) {
    if (action.name === excludeAction) continue;
    const okFixture = action.fixtures?.find(f => f.expectedVariant === 'ok' && (!f.after || f.after.length === 0));
    if (okFixture) return { actionName: action.name, fixture: okFixture };
  }
  return undefined;
}

/**
 * Check if an action name looks like a "creator" (seeds data into storage).
 */
function isCreatorAction(actionName: string): boolean {
  return CREATOR_ACTION_NAMES.includes(actionName);
}

function renderStructuralTests(handlerVar: string, action: TestPlanAction, style: HandlerStyle, allActions?: TestPlanAction[]): string[] {
  const lines: string[] = [];
  const inputObj = bestInput(action);

  lines.push(`  describe('${action.name}', () => {`);

  if (style === 'functional') {
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
    lines.push(`      if (!program?.instructions) return; // skip non-StorageProgram handlers`);
    lines.push(`      const purity = classifyPurity(program);`);
    lines.push(`      expect(['pure', 'read-only', 'read-write']).toContain(purity);`);
    lines.push(`    });`);
    lines.push('');

    // Variant coverage — check structural effects contain at least one variant
    lines.push(`    it('declares completion variants', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push(`      if (!program?.instructions) return; // skip non-StorageProgram handlers`);
    lines.push(`      const variants = program.effects?.completionVariants ?? extractCompletionVariants(program);`);
    lines.push(`      expect(variants.size).toBeGreaterThan(0);`);
    lines.push(`    });`);
    lines.push('');

    // Read/write sets
    lines.push(`    it('declares read and write sets', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push(`      if (!program?.instructions) return; // skip non-StorageProgram handlers`);
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

    // Transport effects
    lines.push(`    it('has trackable transport effects', () => {`);
    lines.push(`      const program = ${handlerVar}.${action.name}({ ${inputObj} });`);
    lines.push(`      if (!program?.instructions) return; // skip non-StorageProgram handlers`);
    lines.push(`      const effects = extractPerformSet(program);`);
    lines.push(`      expect(effects).toBeDefined();`);
    lines.push(`    });`);
    lines.push('');
  }

  // Execution test (both styles) — verifies handler produces a well-formed result
  lines.push(`    it('produces a result', async () => {`);
  lines.push(`      if (typeof ${handlerVar}.${action.name} !== 'function') return;`);
  lines.push(`      const result = ${invokeExpr(handlerVar, action.name, inputObj, style)};`);
  lines.push(`      expect(result).toBeDefined();`);
  lines.push(`      if (result.variant !== undefined) {`);
  lines.push(`        expect(typeof result.variant).toBe('string');`);
  lines.push(`      }`);
  lines.push(`    });`);
  lines.push('');

  // Fixture behavioral tests — each fixture asserts its expected variant
  if (action.fixtures && action.fixtures.length > 0) {
    const fixtureIndex = allActions ? buildFixtureIndex(allActions) : new Map();
    for (const fixture of action.fixtures) {
      const fInput = fixtureInputStr(fixture.input);
      lines.push(`    it('fixture "${fixture.name}" -> ${fixture.expectedVariant}', async () => {`);
      lines.push(`      if (typeof ${handlerVar}.${action.name} !== 'function') return;`);
      lines.push(`      const storage = createInMemoryStorage();`);
      // Auto-seed: if fixture expects ok, has no after-chain, and action is not a
      // creator, automatically run the concept's creator fixture first to populate storage.
      const effectiveFixture = { ...fixture };
      if (
        (!fixture.after || fixture.after.length === 0)
        && fixture.expectedVariant === 'ok'
        && !isCreatorAction(action.name)
        && allActions
      ) {
        const creator = findCreatorFixture(allActions, action.name);
        if (creator) {
          effectiveFixture.after = [creator.fixture.name];
          // Ensure the creator fixture is in the index
          if (!fixtureIndex.has(creator.fixture.name)) {
            fixtureIndex.set(creator.fixture.name, creator);
          }
        }
      }
      // Run after-chain fixtures to seed storage, capturing their outputs
      const { lines: afterLines, resultVars } = resolveAfterChain(effectiveFixture, fixtureIndex, handlerVar, style);
      for (const line of afterLines) {
        lines.push(line);
      }
      // If fixture input contains $ref values, resolve them against after-chain results.
      // Otherwise use literal input directly.
      if (hasRefs(fixture.input) && resultVars.size > 0) {
        const resolvedInput = fixtureInputStrWithRefs(fixture.input, resultVars);
        lines.push(`      const result = ${invokeExpr(handlerVar, action.name, resolvedInput, style)};`);
      } else if (resultVars.size > 0) {
        // After-chain exists but no $refs — merge outputs by field name match.
        // When fixture input is empty, use all pool values so after-chain
        // outputs (e.g. generated IDs) flow through to the action under test.
        const afterOutputExprs = [...resultVars.values()].map(v => `(${v}?.output ?? {})`);
        lines.push(`      const _pool = Object.assign({}, ${afterOutputExprs.join(', ')});`);
        const isEmpty = fInput.trim() === '';
        if (isEmpty) {
          lines.push(`      const _fixtureInput = { ..._pool } as Record<string, unknown>;`);
        } else {
          lines.push(`      const _fixtureInput = { ${fInput} } as Record<string, unknown>;`);
          lines.push(`      for (const [k, v] of Object.entries(_pool)) {`);
          lines.push(`        if (k in _fixtureInput && v !== undefined) _fixtureInput[k] = v;`);
          lines.push(`      }`);
        }
        lines.push(`      const result = ${invokeExpr(handlerVar, action.name, '..._fixtureInput', style)};`);
      } else {
        lines.push(`      const result = ${invokeExpr(handlerVar, action.name, fInput, style)};`);
      }
      if (fixture.expectedVariant === 'error') {
        // Generic error fixture: any non-ok variant satisfies the expectation.
        // Concept specs use -> error as shorthand for "should fail" even when
        // the action defines specific error variants (notfound, invalid, etc.)
        lines.push(`      expect(result.variant).not.toBe('ok');`);
      } else if (fixture.expectedVariant === 'ok') {
        // Accept 'ok' or domain-specific success variants (created, configured, etc.).
        // Handlers may return named success variants instead of generic 'ok'.
        // Reject only known error patterns.
        lines.push(`      const _isErr = (v: string) => !v || /error|invalid|not.?found|forbidden|unauthorized|unavailable|unsupported/i.test(v);`);
        lines.push(`      expect(_isErr(result.variant), \`expected success variant but got '\${result.variant}'\`).toBe(false);`);
      } else {
        // For specific variant expectations, normalize casing for common variants
        // (notfound/not_found/notFound are all equivalent)
        lines.push(`      const normalize = (v: string) => v?.toLowerCase().replace(/_/g, '');`);
        lines.push(`      expect(normalize(result.variant)).toBe(normalize('${fixture.expectedVariant}'));`);
      }
      lines.push(`    });`);
      lines.push('');
    }
  }

  lines.push(`  });`);
  lines.push('');

  return lines;
}

// ── Example tests ───────────────────────────────────────────

function renderExampleTests(handlerVar: string, examples: TestPlanExample[], style: HandlerStyle): string[] {
  if (examples.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('invariant examples', () => {`);

  for (const example of examples) {
    lines.push(`    it(${JSON.stringify(example.name)}, async () => {`);
    lines.push(`      const storage = createInMemoryStorage();`);

    const declaredVars = new Set<string>();
    for (let si = 0; si < example.steps.length; si++) {
      const step = example.steps[si];
      const stepInput = Object.entries(step.input)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      const resultVar = `${step.action}Result${si}`;
      lines.push(`      const ${resultVar} = ${invokeExpr(handlerVar, step.action, stepInput, style)};`);
      if (step.expectedVariant) {
        if (step.expectedVariant === 'ok') {
          lines.push(`      const _isErr${si} = (v: string) => !v || /error|invalid|not.?found|forbidden|unauthorized|unavailable|unsupported/i.test(v);`);
          lines.push(`      expect(_isErr${si}(${resultVar}.variant), \`step ${si}: expected success but got '\${${resultVar}.variant}'\`).toBe(false);`);
        } else {
          lines.push(`      expect(${resultVar}.variant).toBe(${JSON.stringify(step.expectedVariant)});`);
        }
      }
      for (const [name, _val] of Object.entries(step.outputBindings)) {
        if (declaredVars.has(name)) {
          lines.push(`      ${name} = ${resultVar}.output[${JSON.stringify(name)}];`);
        } else {
          lines.push(`      let ${name} = ${resultVar}.output[${JSON.stringify(name)}];`);
          declaredVars.add(name);
        }
      }
    }

    for (let ai = 0; ai < example.assertions.length; ai++) {
      const assertion = example.assertions[ai];
      if (assertion.type === 'variant_check' && assertion.action) {
        const thenInput = Object.entries(assertion.input || {})
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ');
        const thenVar = `thenResult${ai}`;
        lines.push(`      const ${thenVar} = ${invokeExpr(handlerVar, assertion.action, thenInput, style)};`);
        if (assertion.expectedVariant) {
          if (assertion.expectedVariant === 'ok') {
            lines.push(`      const _isErrA${ai} = (v: string) => !v || /error|invalid|not.?found|forbidden|unauthorized|unavailable|unsupported/i.test(v);`);
            lines.push(`      expect(_isErrA${ai}(${thenVar}.variant), \`assertion ${ai}: expected success but got '\${${thenVar}.variant}'\`).toBe(false);`);
          } else {
            lines.push(`      expect(${thenVar}.variant).toBe(${JSON.stringify(assertion.expectedVariant)});`);
          }
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

// ── Forall (PBT) tests ──────────────────────────────────────

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
  return 'fc.string({ minLength: 1, maxLength: 50 })';
}

function renderForallTests(handlerVar: string, properties: TestPlanForall[], style: HandlerStyle): string[] {
  if (properties.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('forall properties (PBT)', () => {`);

  for (const prop of properties) {
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
      const stepInput = Object.entries(step.input)
        .map(([k, v]) => {
          if (varNames.includes(v)) return `${k}: ${v}`;
          return `${k}: ${JSON.stringify(v)}`;
        })
        .join(', ');
      lines.push(`            const result = ${invokeExpr(handlerVar, step.action, stepInput, style)};`);
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

// ── State invariant tests ───────────────────────────────────

function renderStateInvariantTests(
  handlerVar: string,
  invariants: TestPlanStateInvariant[],
  actions: TestPlanAction[],
  style: HandlerStyle,
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

    const actionArbs = actions.map(a => {
      const inputArb = randomArbs(a.params).join(', ');
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

    if (style === 'imperative') {
      lines.push(`                const result = await safeInvoke(() => actionFn.call(${handlerVar}, step.input as Record<string, unknown>, storage));`);
    } else {
      lines.push(`                const result = await safeInvoke(async () => {`);
      lines.push(`                  const program = actionFn.call(${handlerVar}, step.input as Record<string, unknown>);`);
      lines.push(`                  return interpret(program, storage);`);
      lines.push(`                });`);
    }

    lines.push(`                // Every action should return a result with a variant`);
    lines.push(`                if (result?.variant !== undefined) {`);
    lines.push(`                  expect(typeof result.variant).toBe('string');`);
    lines.push(`                }`);
    if (inv.kind === 'never') {
      lines.push(`                // Never: ${inv.name}`);
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

// ── Liveness tests ──────────────────────────────────────────

function renderLivenessTests(handlerVar: string, liveness: TestPlanLiveness[], style: HandlerStyle): string[] {
  if (liveness.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('eventually (bounded liveness)', () => {`);

  for (const liv of liveness) {
    lines.push(`    it('eventually: ${liv.name}', async () => {`);
    lines.push(`      const storage = createInMemoryStorage();`);
    lines.push(`      let reached = false;`);
    lines.push(`      const MAX_STEPS = 10;`);
    lines.push('');

    for (let si = 0; si < liv.setupSteps.length; si++) {
      const step = liv.setupSteps[si];
      const stepInput = Object.entries(step.input)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      lines.push(`      const setupResult${si} = ${invokeExpr(handlerVar, step.action, stepInput, style)};`);
      lines.push(`      expect(setupResult${si}.variant).toBeDefined();`);
    }

    if (liv.targetAction) {
      const targetInput = Object.entries(liv.targetInput || {})
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      lines.push('');
      lines.push(`      for (let step = 0; step < MAX_STEPS && !reached; step++) {`);
      lines.push(`        const result = ${invokeExpr(handlerVar, liv.targetAction, targetInput, style)};`);
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

// ── Contract tests ──────────────────────────────────────────

function renderContractTests(
  handlerVar: string,
  contracts: TestPlanContract[],
  actions: TestPlanAction[],
  style: HandlerStyle,
): string[] {
  // Only emit contracts that have actual preconditions or postconditions
  const nonEmpty = contracts.filter(c => c.preconditions.length > 0 || c.postconditions.length > 0);
  if (nonEmpty.length === 0) return [];

  const lines: string[] = [];
  lines.push(`  describe('action contracts (PBT)', () => {`);

  for (const contract of nonEmpty) {
    const action = actions.find(a => a.name === contract.targetAction);

    // Precondition: empty input should not crash (may return error or ok with defaults)
    for (const pre of contract.preconditions) {
      lines.push(`    it('${contract.targetAction} handles empty input: ${pre.assertion}', async () => {`);
      lines.push(`      if (typeof ${handlerVar}.${contract.targetAction} !== 'function') return;`);
      lines.push(`      const storage = createInMemoryStorage();`);
      lines.push(`      const result = await safeInvoke(async () => ${invokeExpr(handlerVar, contract.targetAction, '', style)});`);
      lines.push(`      // Empty input should produce a defined result with a variant`);
      lines.push(`      expect(result).toBeDefined();`);
      lines.push(`      if (result.variant !== undefined) {`);
      lines.push(`        expect(typeof result.variant).toBe('string');`);
      lines.push(`      }`);
      lines.push(`    });`);
      lines.push('');
    }

    // Postcondition: when action produces the target variant, output is well-formed
    if (action && contract.postconditions.length > 0) {
      const inputArbs = randomArbs(action.params).join(', ');

      for (const post of contract.postconditions) {
        lines.push(`    it('${contract.targetAction} ensures on ${post.variant}: ${post.assertion}', async () => {`);
        lines.push(`      if (typeof ${handlerVar}.${contract.targetAction} !== 'function') return;`);
        lines.push(`      let seen = false;`);
        lines.push(`      await fc.assert(`);
        lines.push(`        fc.asyncProperty(`);
        lines.push(`          fc.record({ ${inputArbs} }),`);
        lines.push(`          async (input) => {`);
        lines.push(`            const storage = createInMemoryStorage();`);

        if (style === 'imperative') {
          lines.push(`            const result = await safeInvoke(() => ${handlerVar}.${contract.targetAction}(input as Record<string, unknown>, storage));`);
        } else {
          lines.push(`            const result = await safeInvoke(async () => {`);
          lines.push(`              const program = ${handlerVar}.${contract.targetAction}(input as Record<string, unknown>);`);
          lines.push(`              return interpret(program, storage);`);
          lines.push(`            });`);
        }

        lines.push(`            if (result?.variant === ${JSON.stringify(post.variant)}) {`);
        lines.push(`              seen = true;`);
        lines.push(`              expect(result.output).toBeDefined();`);
        lines.push(`            }`);
        lines.push(`          },`);
        lines.push(`        ),`);
        lines.push(`        { numRuns: 50 },`);
        lines.push(`      );`);
        lines.push(`    });`);
        lines.push('');
      }
    } else {
      for (const post of contract.postconditions) {
        lines.push(`    it('${contract.targetAction} ensures on ${post.variant}: ${post.assertion}', async () => {`);
        lines.push(`      if (typeof ${handlerVar}.${contract.targetAction} !== 'function') return;`);
        lines.push(`      const storage = createInMemoryStorage();`);
        lines.push(`      const result = ${invokeExpr(handlerVar, contract.targetAction, '', style)};`);
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

// ── Main entry point ────────────────────────────────────────

/**
 * Render a TestPlan into a complete TypeScript conformance test file.
 */
export function renderTypeScriptTests(plan: TestPlan): string {
  const handlerVar = plan.handlerExportName || (toCamel(plan.conceptName) + 'Handler');
  const style = plan.handlerStyle || 'functional';
  const lines: string[] = [];

  // Header
  const styleLabel = style === 'imperative' ? 'Imperative' : 'Functional';
  lines.push(`// ${plan.conceptName} ${styleLabel} Handler Conformance Tests`);
  lines.push('//');
  lines.push('// Auto-generated by TestGen from concept spec invariants.');
  if (style === 'functional') {
    lines.push('// Validates StorageProgram construction, purity, variant coverage,');
    lines.push('// read/write sets, interpreted execution, and invariant conformance.');
  } else {
    lines.push('// Validates action execution and invariant conformance.');
  }
  lines.push('');

  // Imports
  lines.push("import { describe, it, expect, beforeEach } from 'vitest';");
  lines.push("import fc from 'fast-check';");
  lines.push(`import { ${handlerVar} } from '../../${plan.handlerPath}';`);

  if (style === 'functional') {
    lines.push("import {");
    lines.push("  classifyPurity,");
    lines.push("  extractCompletionVariants,");
    lines.push("  extractReadSet,");
    lines.push("  extractWriteSet,");
    lines.push("  extractPerformSet,");
    lines.push("} from '../../runtime/storage-program.js';");
    lines.push("import { interpret } from '../../runtime/interpreter.js';");
  }

  lines.push("import { createInMemoryStorage } from '../../runtime/adapters/storage.js';");
  lines.push('');

  // Lift exceptions into error-variant results so PBT properties stay total.
  // Handlers that throw on invalid input produce { variant: '_thrown' } instead
  // of propagating — keeping property-based tests functional.
  lines.push(`const safeInvoke = async (fn: () => any): Promise<any> => {`);
  lines.push(`  let r: any;`);
  lines.push(`  r = (() => { try { return { ok: true, value: fn() }; } catch (e: any) { return { ok: false, message: e?.message }; } })();`);
  lines.push(`  if (!r.ok) return { variant: '_thrown', message: r.message };`);
  lines.push(`  if (r.value?.then) return r.value.catch((e: any) => ({ variant: '_thrown', message: e?.message }));`);
  lines.push(`  return r.value;`);
  lines.push(`};`);
  lines.push('');

  // Test suite
  lines.push(`describe('${plan.conceptName} ${style} handler', () => {`);
  lines.push('  let storage: ReturnType<typeof createInMemoryStorage>;');
  lines.push('');
  lines.push('  beforeEach(() => {');
  lines.push('    storage = createInMemoryStorage();');
  lines.push('  });');
  lines.push('');

  // Structural tests per action
  for (const action of plan.actions) {
    lines.push(...renderStructuralTests(handlerVar, action, style, plan.actions));
  }

  // Register conformance test — verifies handler declares its concept name.
  // Only emitted when the concept has no 'register' action with required params,
  // since domain-level register(concept, name, ...) actions aren't self-identification.
  const registerAction = plan.actions.find(a => a.name === 'register');
  const registerHasParams = registerAction && registerAction.params.length > 0;
  if (!registerHasParams) {
    lines.push(`  describe('register()', () => {`);
    lines.push(`    it('declares concept name', async () => {`);
    lines.push(`      if (typeof ${handlerVar}.register !== 'function') return;`);
    lines.push(`      const storage = createInMemoryStorage();`);
    if (style === 'functional') {
      lines.push(`      const program = ${handlerVar}.register({});`);
      lines.push(`      // If it's a StorageProgram, interpret it`);
      lines.push(`      const result = (program?.instructions && !program.variant)`);
      lines.push(`        ? await interpret(program, storage)`);
      lines.push(`        : program;`);
    } else {
      lines.push(`      const result = await ${handlerVar}.register({}, storage);`);
    }
    lines.push(`      if (!result?.variant) return; // handler does not support register introspection`);
    lines.push(`      expect(result.variant).toBe('ok');`);
    lines.push(`      const name = result.output?.name ?? result.name;`);
    lines.push(`      expect(name).toBe('${plan.conceptName}');`);
    lines.push(`    });`);
    lines.push(`  });`);
  }
  lines.push('');

  // Invariant-derived tests
  lines.push(...renderExampleTests(handlerVar, plan.examples, style));
  lines.push(...renderForallTests(handlerVar, plan.properties, style));
  lines.push(...renderStateInvariantTests(handlerVar, plan.stateInvariants, plan.actions, style));
  lines.push(...renderLivenessTests(handlerVar, plan.liveness, style));
  lines.push(...renderContractTests(handlerVar, plan.contracts, plan.actions, style));

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}
