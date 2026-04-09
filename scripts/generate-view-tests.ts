#!/usr/bin/env npx tsx
// ============================================================
// Generate view invariant tests from .view manifest files
//
// Discovery pipeline:
//   1. Glob specs/view/views/*.view + suite.yaml views section
//   2. Parse each .view file with parseViewFile()
//   3. Render vitest assertions from invariant declarations
//   4. Write to generated/tests/<view-name>.view.test.ts
//      (only overwrites when content changed)
//
// Usage: npx tsx scripts/generate-view-tests.ts [--filter pattern]
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, basename, join } from 'path';
import { parseViewFile, type ViewSpec, type ViewFixture } from '../handlers/ts/framework/view-spec-parser.js';
import type {
  InvariantDecl,
  InvariantASTStep,
  InvariantAssertion,
  AssertionExpr,
  QuantifierBinding,
  QuantifierDomain,
} from '../runtime/types.js';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'generated', 'tests');

const args = process.argv.slice(2);
const filterIdx = args.indexOf('--filter');
const filter: string | null = filterIdx >= 0 ? args[filterIdx + 1] ?? null : null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function indentLines(code: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return code
    .split('\n')
    .map(line => (line.trim() === '' ? '' : indent + line))
    .join('\n');
}

// ── AssertionExpr → TypeScript expression ─────────────────────────────────────

/**
 * Convert an AssertionExpr to a TypeScript source expression that evaluates
 * against the `analysis` binding.
 */
export function renderExpr(expr: AssertionExpr, analysisVar = 'analysis'): string {
  switch (expr.type) {
    case 'literal': {
      const v = expr.value;
      if (v === null) return 'null';
      if (typeof v === 'string') return JSON.stringify(v);
      return String(v);
    }
    case 'variable':
      // ViewAnalysis field names are top-level on the analysis object
      return `${analysisVar}.${expr.name}`;
    case 'dot_access':
      return `${expr.variable}.${expr.field}`;
    case 'list':
      return `[${expr.items.map(i => renderExpr(i, analysisVar)).join(', ')}]`;
    default:
      return String((expr as unknown as { value: unknown }).value ?? 'unknown');
  }
}

// ── Invariant assertion compilation ───────────────────────────────────────────

/**
 * Render a single InvariantAssertion (a binary predicate) to vitest expect()
 * statements. Returns an array of statement lines.
 *
 * Context:
 * - `analysisVar` is the variable name for the ViewAnalysis object (default 'analysis')
 * - `loopVar` is the current loop variable when inside a forall/exists quantifier
 */
export function renderAssertion(
  assertion: InvariantAssertion,
  analysisVar = 'analysis',
  loopVar?: string,
): string {
  const left = assertion.left;
  const right = assertion.right;
  const op = assertion.operator;

  // Resolve left-hand side
  const leftTs = resolveExprInContext(left, analysisVar, loopVar);
  const rightTs = resolveExprInContext(right, analysisVar, loopVar);

  switch (op) {
    case '=': {
      // Empty-list shorthand: x = [] → toEqual([])
      if (right.type === 'list' && right.items.length === 0) {
        return `expect(${leftTs}).toEqual([]);`;
      }
      // Equality: analysis.purity = "read-only"
      return `expect(${leftTs}).toBe(${rightTs});`;
    }
    case '!=': {
      // Non-empty set: invokedActions != {} → length > 0
      if (right.type === 'list' && right.items.length === 0) {
        return `expect(${leftTs}.length).toBeGreaterThan(0);`;
      }
      return `expect(${leftTs}).not.toBe(${rightTs});`;
    }
    case '>':
      return `expect(${leftTs}).toBeGreaterThan(${rightTs});`;
    case '>=':
      return `expect(${leftTs}).toBeGreaterThanOrEqual(${rightTs});`;
    case '<':
      return `expect(${leftTs}).toBeLessThan(${rightTs});`;
    case '<=':
      return `expect(${leftTs}).toBeLessThanOrEqual(${rightTs});`;
    case 'in':
      // "Task/escalate" in invokedActions → expect(collection).toContain(value)
      return `expect(${rightTs}).toContain(${leftTs});`;
    case 'not in':
      return `expect(${rightTs}).not.toContain(${leftTs});`;
    default:
      return `// TODO: unsupported operator '${op}': ${leftTs} ${op} ${rightTs}`;
  }
}

/**
 * Resolve an AssertionExpr in the context of the current loop variable
 * and analysis variable.
 */
function resolveExprInContext(
  expr: AssertionExpr,
  analysisVar: string,
  loopVar?: string,
): string {
  // Variable references: if the name matches a known ViewAnalysis field, prefix with analysisVar
  // otherwise it's a loop variable or local binding
  if (expr.type === 'variable') {
    if (loopVar && expr.name === loopVar) {
      return loopVar;
    }
    // Check if it looks like a ViewAnalysis field (camelCase identifier that
    // matches one of the known analysis fields). Fall back to plain name if not.
    return `${analysisVar}.${expr.name}`;
  }
  return renderExpr(expr, analysisVar);
}

// ── Quantifier body compilation ────────────────────────────────────────────────

/**
 * Render the domain of a QuantifierBinding to a TypeScript iterable expression.
 */
function renderDomain(domain: QuantifierDomain, analysisVar: string): string {
  switch (domain.type) {
    case 'state_field':
      return `${analysisVar}.${domain.name}`;
    case 'set_literal':
      return `[${domain.values.map(v => JSON.stringify(v)).join(', ')}]`;
    case 'type_ref':
      return `${analysisVar}.${domain.name}`;
    default:
      return '[]';
  }
}

// ── InvariantASTStep compilation ──────────────────────────────────────────────

/**
 * Render a single InvariantASTStep (either an action pattern or an assertion)
 * to vitest assertion lines. Returns code lines.
 *
 * For view invariants, "action" steps in `then` blocks reference ViewAnalysis
 * fields (e.g. `"Task/escalate" in invokedActions`). We treat them as assertions.
 */
function renderStep(
  step: InvariantASTStep,
  analysisVar: string,
  loopVar?: string,
): string {
  if (step.kind === 'assertion') {
    return renderAssertion(step as InvariantAssertion & { kind: 'assertion' }, analysisVar, loopVar);
  }
  // kind === 'action' — for view invariants these are "compile" steps (setup)
  // or membership checks like `"Task/escalate" in invokedActions`
  // The action pattern's variantName often encodes a field check
  if (step.kind === 'action') {
    const actionStep = step as { kind: 'action'; actionName: string; variantName: string; outputArgs: Array<{ name: string; value: unknown }> };
    // If it looks like a membership check (e.g. "Task/escalate" in invokedActions)
    if (actionStep.variantName && actionStep.variantName !== 'ok' && actionStep.actionName) {
      return `expect(${analysisVar}.${actionStep.variantName}).toContain(${JSON.stringify(actionStep.actionName)});`;
    }
    // Otherwise it's a setup "after compile" step — skip in the test body
    if (actionStep.actionName === 'compile') {
      return `// setup: compile ViewShell (handled in beforeAll)`;
    }
    return `// action step: ${actionStep.actionName} -> ${actionStep.variantName}`;
  }
  return `// TODO: unknown step kind`;
}

// ── Invariant-to-test-body compilation ────────────────────────────────────────

/**
 * Render a complete InvariantDecl to a vitest it() block.
 * Returns the full `it(...)` test string.
 */
export function renderInvariantAssertion(
  invariant: InvariantDecl,
  viewName: string,
  analysisVar = 'analysis',
): string {
  const kind = invariant.kind;
  const name = invariant.name ?? `${kind} invariant`;
  const testName = `${kind}: ${name}`;

  const bodyLines: string[] = [];

  if (kind === 'never') {
    // For `never` blocks: negate the assertions in thenPatterns
    for (const step of invariant.thenPatterns) {
      if (step.kind === 'assertion') {
        const assertion = step as InvariantAssertion & { kind: 'assertion' };
        bodyLines.push(...renderNegatedAssertion(assertion, analysisVar));
      } else {
        bodyLines.push(renderStep(step, analysisVar));
      }
    }

    // Also handle quantifiers with negation for `never`
    if (invariant.quantifiers && invariant.quantifiers.length > 0) {
      bodyLines.push(...renderQuantifierBlock(invariant, analysisVar, true));
    }
  } else if (kind === 'always') {
    // For `always` blocks: assert all thenPatterns and quantifier-scoped assertions
    if (invariant.quantifiers && invariant.quantifiers.length > 0) {
      bodyLines.push(...renderQuantifierBlock(invariant, analysisVar, false));
    } else {
      for (const step of invariant.thenPatterns) {
        bodyLines.push(renderStep(step, analysisVar));
      }
    }
  } else if (kind === 'example') {
    // For `example` blocks: skip `after compile` steps, assert the `then` conditions
    for (const step of invariant.thenPatterns) {
      const line = renderStep(step, analysisVar);
      if (!line.startsWith('// setup:') && !line.startsWith('// action step:')) {
        bodyLines.push(line);
      }
    }
    // After-patterns that aren't 'compile' — note them
    for (const after of invariant.afterPatterns) {
      if (after.actionName !== 'compile') {
        bodyLines.push(`// setup: ${after.actionName}(${after.inputArgs.map(a => `${a.name}: ...`).join(', ')}) — handled in beforeAll`);
      }
    }
  } else if (kind === 'forall') {
    // forall x in domain: assertion
    if (invariant.quantifiers && invariant.quantifiers.length > 0) {
      bodyLines.push(...renderQuantifierBlock(invariant, analysisVar, false));
    } else {
      for (const step of invariant.thenPatterns) {
        bodyLines.push(renderStep(step, analysisVar));
      }
    }
  } else {
    // eventually, requires_ensures — render thenPatterns as-is
    for (const step of invariant.thenPatterns) {
      bodyLines.push(renderStep(step, analysisVar));
    }
  }

  const indentedBody = bodyLines
    .filter(l => l !== undefined)
    .map(l => `    ${l}`)
    .join('\n');

  return `  it(${JSON.stringify(testName)}, () => {\n${indentedBody}\n  });`;
}

/**
 * Render negated assertions for `never` invariants.
 */
function renderNegatedAssertion(
  assertion: InvariantAssertion,
  analysisVar: string,
): string[] {
  const left = assertion.left;
  const right = assertion.right;
  const op = assertion.operator;

  const leftTs = resolveExprInContext(left, analysisVar);
  const rightTs = resolveExprInContext(right, analysisVar);

  switch (op) {
    case '!=': {
      // never { invokedActions != {} } means: assert invokedActions IS empty
      if (right.type === 'list' && right.items.length === 0) {
        return [`expect(${leftTs}.length).toBe(0);`];
      }
      return [`expect(${leftTs}).toBe(${rightTs});`];
    }
    case '=': {
      return [`expect(${leftTs}).not.toBe(${rightTs});`];
    }
    case 'in':
      return [`expect(${rightTs}).not.toContain(${leftTs});`];
    case 'not in':
      return [`expect(${rightTs}).toContain(${leftTs});`];
    case '>':
      return [`expect(${leftTs}).toBeLessThanOrEqual(${rightTs});`];
    case '<':
      return [`expect(${leftTs}).toBeGreaterThanOrEqual(${rightTs});`];
    default:
      return [`// TODO: negated operator '${op}': ${leftTs} ${op} ${rightTs}`];
  }
}

/**
 * Render quantifier-scoped assertions.
 * For `forall x in domain: body` — generates a for-of loop with assertions.
 * For `never { forall x in domain: ... }` — generates with negated assertions.
 */
function renderQuantifierBlock(
  invariant: InvariantDecl,
  analysisVar: string,
  negate: boolean,
): string[] {
  if (!invariant.quantifiers || invariant.quantifiers.length === 0) return [];

  const lines: string[] = [];

  // Each quantifier produces a loop
  for (const q of invariant.quantifiers) {
    const varName = q.variable;
    const domainTs = renderDomain(q.domain, analysisVar);

    lines.push(`for (const ${varName} of ${domainTs}) {`);

    // The thenPatterns inside this loop use the loop variable
    for (const step of invariant.thenPatterns) {
      if (step.kind === 'assertion') {
        const assertion = step as InvariantAssertion & { kind: 'assertion' };
        let assertLine: string;

        if (negate) {
          const negated = renderNegatedAssertion(assertion, analysisVar);
          assertLine = negated[0] ?? '';
        } else {
          // Replace analysis.fieldName with varName when the left expr IS the loop var
          assertLine = renderAssertionInLoop(assertion, analysisVar, varName);
        }

        if (assertLine) lines.push(`  ${assertLine}`);
      } else {
        const line = renderStep(step, analysisVar, varName);
        if (line) lines.push(`  ${line}`);
      }
    }

    lines.push('}');
  }

  return lines;
}

/**
 * Render an assertion inside a quantifier loop, substituting the loop variable
 * where appropriate.
 *
 * Handles patterns like:
 * - `f in ["id", "node"]`  (loop var f, check membership in literal list)
 * - `ia startsWith "Task/"` (loop var ia, prefix check)
 * - `f in readFields` (loop var f, check membership in analysis field)
 * - `f in projectedFields subset readFields` (subset check)
 */
function renderAssertionInLoop(
  assertion: InvariantAssertion,
  analysisVar: string,
  loopVar: string,
): string {
  const left = assertion.left;
  const right = assertion.right;
  const op = assertion.operator;

  // Handle `startsWith` — stored as a custom operator or as a dot_access pattern
  // The view-spec-parser may encode `ia startsWith "Task/"` as an assertion with
  // operator 'startsWith' or as a special variable reference
  if ((op as string) === 'startsWith') {
    const prefixTs = resolveExprInContext(right, analysisVar, loopVar);
    const targetTs = resolveExprInContext(left, analysisVar, loopVar);
    // Replace analysisVar prefix for loop variable
    const target = targetTs === `${analysisVar}.${loopVar}` ? loopVar : targetTs;
    const prefix = prefixTs.replace(new RegExp(`^${analysisVar}\\.`), '');
    return `expect(${target}.startsWith(${prefix})).toBe(true);`;
  }

  // Handle `subset` — left is a set, right is the superset
  if ((op as string) === 'subset') {
    const leftTs = resolveExprInContext(left, analysisVar, loopVar);
    const rightTs = resolveExprInContext(right, analysisVar, loopVar);
    return `expect(${rightTs}).toContain(${leftTs});`;
  }

  // Standard operators in loop context
  const leftTs = resolveExprInContext(left, analysisVar, loopVar);
  const rightTs = resolveExprInContext(right, analysisVar, loopVar);

  switch (op) {
    case 'in': {
      // `f in ["id", "name"]` → expect([...]).toContain(f)
      // `f in readFields` → expect(analysis.readFields).toContain(f)
      return `expect(${rightTs}).toContain(${leftTs});`;
    }
    case 'not in':
      return `expect(${rightTs}).not.toContain(${leftTs});`;
    case '=':
      return `expect(${leftTs}).toBe(${rightTs});`;
    case '!=':
      return `expect(${leftTs}).not.toBe(${rightTs});`;
    case '>':
      return `expect(${leftTs}).toBeGreaterThan(${rightTs});`;
    case '>=':
      return `expect(${leftTs}).toBeGreaterThanOrEqual(${rightTs});`;
    case '<':
      return `expect(${leftTs}).toBeLessThan(${rightTs});`;
    case '<=':
      return `expect(${leftTs}).toBeLessThanOrEqual(${rightTs});`;
    default:
      return `// TODO: loop assertion operator '${op}': ${leftTs} ${op} ${rightTs}`;
  }
}

// ── Test file rendering ────────────────────────────────────────────────────────

/**
 * Render a complete vitest test file for a ViewSpec.
 */
/**
 * Default child spec data for features not explicitly declared in the fixture.
 * The features block in the .view file is the source of truth — the fixture
 * only needs to customize specs it cares about. Missing specs for enabled
 * features get these sensible defaults.
 */
const DEFAULT_SPEC_DATA: Record<string, Record<string, string>> = {
  dataSource: { kind: 'concept-action', config: '{"concept":"ContentNode","action":"list"}' },
  filter: { node: '{"type":"true"}' },
  sort: { keys: '[]' },
  group: { fields: '[]', config: '{}' },
  projection: { fields: '[]' },
  presentation: { displayType: 'table', hints: '{}' },
  interaction: { rowActions: '[{"key":"edit","concept":"ContentNode","action":"update","label":"Edit"}]' },
  pagination: { mode: 'offset', pageSize: '25' },
};

/** Map from spec type to storage relation name. */
const SPEC_RELATIONS: Record<string, string> = {
  dataSource: 'source',
  filter: 'filter',
  sort: 'sort',
  group: 'group',
  projection: 'projection',
  presentation: 'presentation',
  interaction: 'interaction',
  pagination: 'pagination',
};

/**
 * Generate storage seeding code from a ViewFixture.
 * Creates a ViewShell record and child spec records in mock storage.
 *
 * The features list (from the .view file's features block) determines which
 * specs are seeded. For each enabled feature, the fixture's spec data is used
 * if present; otherwise a sensible default is generated. dataSource and
 * presentation are always seeded (always-on features).
 */
function renderFixtureSeeding(fixture: ViewFixture, shellName: string, features: string[] | undefined): string {
  const lines: string[] = [];
  const specRefs: Record<string, string> = {};

  // Determine which spec types to seed: always-on + enabled features
  const alwaysOn = ['dataSource', 'presentation'];
  const enabledFeatures = features ?? ['filter', 'sort', 'group', 'projection', 'interaction', 'pagination'];
  const specTypesToSeed = new Set([...alwaysOn, ...enabledFeatures]);

  // Seed each spec type: use fixture data if present, else default
  for (const specType of specTypesToSeed) {
    const refName = `${shellName}-${specType}`;
    specRefs[specType] = refName;
    const relation = SPEC_RELATIONS[specType] || specType;
    const fixtureData = fixture.specs[specType as keyof typeof fixture.specs];
    const fields = fixtureData ?? DEFAULT_SPEC_DATA[specType] ?? {};
    lines.push(`    await storage.put(${JSON.stringify(relation)}, ${JSON.stringify(refName)}, ${JSON.stringify({ name: refName, ...fields })});`);
  }

  // Build ViewShell record with refs for all seeded specs
  const shellRecord: Record<string, string> = {
    name: shellName,
    title: shellName,
    description: '',
    dataSource: specRefs.dataSource || '',
    filter: specRefs.filter || '',
    sort: specRefs.sort || '',
    group: specRefs.group || '',
    projection: specRefs.projection || '',
    presentation: specRefs.presentation || '',
    interaction: specRefs.interaction || '',
    features: features ? JSON.stringify(features) : '',
    pagination: specRefs.pagination || '',
  };
  lines.push(`    await storage.put('view', ${JSON.stringify(shellName)}, ${JSON.stringify(shellRecord)});`);

  return lines.join('\n');
}

export function renderViewTestFile(spec: ViewSpec, relPath: string): string {
  const viewName = spec.name;
  const shellName = spec.shell;

  const invariantTests = spec.invariants
    .map(inv => renderInvariantAssertion(inv, viewName))
    .join('\n\n');

  // If fixtures exist, use the first one for seeding; otherwise leave a TODO
  const hasFixture = spec.fixtures && spec.fixtures.length > 0;
  const seedingCode = hasFixture
    ? renderFixtureSeeding(spec.fixtures[0], shellName, spec.features)
    : '    // No fixture declared — seed storage manually or add a fixture block to the .view file';

  return `// generated/tests/${viewName}.view.test.ts
// Auto-generated from ${relPath} — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: ${viewName}', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
${seedingCode}
    analysis = await compileAndAnalyze(${JSON.stringify(shellName)}, storage);
  });

  describe('invariants', () => {
${invariantTests}
  });
});
`;
}

// ── Discovery ──────────────────────────────────────────────────────────────────

/**
 * Recursively find files matching a predicate in a directory.
 */
function findFiles(dir: string, predicate: (name: string) => boolean): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findFiles(full, predicate));
    } else if (predicate(entry)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Recursively find all suite.yaml files under a directory.
 */
function findSuiteYamls(dir: string): string[] {
  return findFiles(dir, name => name === 'suite.yaml');
}

/**
 * Collect all .view file paths to process.
 * Sources:
 *   1. specs/view/views/*.view (glob default location)
 *   2. suite.yaml `views` sections across the project
 */
function discoverViewFiles(): string[] {
  const paths = new Set<string>();

  // 1. Default location: specs/view/views/*.view
  const defaultDir = join(ROOT, 'specs', 'view', 'views');
  for (const p of findFiles(defaultDir, name => name.endsWith('.view'))) {
    paths.add(p);
  }

  // 2. suite.yaml views sections — scan all suite.yaml files
  const searchRoots = [
    join(ROOT, 'specs'),
    join(ROOT, 'repertoire'),
    join(ROOT, 'score'),
    join(ROOT, 'bind'),
    join(ROOT, 'surface'),
  ];

  const suiteYamls = searchRoots.flatMap(d => findSuiteYamls(d));
  for (const suiteYaml of suiteYamls) {
    try {
      const content = readFileSync(suiteYaml, 'utf-8');
      // Simple regex extraction — avoid yaml dependency
      const viewsSection = content.match(/^views:\s*\n((?:[ \t]+-[^\n]+\n(?:[ \t]+\w+:[^\n]+\n)*)*)/m);
      if (viewsSection) {
        const pathMatches = viewsSection[1].matchAll(/path:\s*(.+)/g);
        const suiteDir = resolve(suiteYaml, '..');
        for (const m of pathMatches) {
          const p = resolve(suiteDir, m[1].trim());
          if (p.endsWith('.view')) paths.add(p);
        }
      }
    } catch {
      // Ignore unreadable suite.yaml files
    }
  }

  return [...paths].sort();
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const viewFiles = discoverViewFiles();

  process.stderr.write(`Found ${viewFiles.length} .view file(s)\n`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    process.stderr.write(`Created output directory: ${OUTPUT_DIR}\n`);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of viewFiles) {
    // Apply --filter
    if (filter && !filePath.includes(filter)) {
      skipped++;
      continue;
    }

    const relPath = filePath.replace(ROOT + '/', '');
    process.stderr.write(`Processing: ${relPath}\n`);

    let spec: ViewSpec;
    try {
      const source = readFileSync(filePath, 'utf-8');
      spec = parseViewFile(source);
    } catch (err) {
      process.stderr.write(`  ERROR parsing ${relPath}: ${(err as Error).message}\n`);
      failed++;
      continue;
    }

    if (spec.invariants.length === 0) {
      process.stderr.write(`  Skipping (no invariants): ${spec.name}\n`);
      skipped++;
      continue;
    }

    process.stderr.write(`  View: ${spec.name}, shell: ${spec.shell}, invariants: ${spec.invariants.length}\n`);

    const outFile = join(OUTPUT_DIR, `${spec.name}.view.test.ts`);
    const content = renderViewTestFile(spec, relPath);

    // Only overwrite if content changed
    if (existsSync(outFile)) {
      const existing = readFileSync(outFile, 'utf-8');
      if (existing === content) {
        process.stderr.write(`  Unchanged: ${basename(outFile)}\n`);
        skipped++;
        continue;
      }
    }

    writeFileSync(outFile, content, 'utf-8');
    process.stderr.write(`  Written: ${basename(outFile)} (${spec.invariants.length} tests)\n`);
    generated++;
  }

  process.stderr.write(`\nDone: ${generated} generated, ${skipped} unchanged/skipped, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${(err as Error).message}\n`);
  process.exit(1);
});
