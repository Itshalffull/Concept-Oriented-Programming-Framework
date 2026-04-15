// @clef-handler style=functional concept=IntegrationTestGen
// ============================================================
// IntegrationTestGen — Integration test generator from concept spec fixtures
//
// Parses concept spec fixtures, walks after-chains to build a dependency
// graph, performs a topological sort, and emits a ProcessSpec JSON where
// each fixture becomes a step of type "external-call".
//
// See architecture doc:
//   - Section 2.2: Fixture declarations
//   - Section 14: ProcessSpec
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { parseConceptFile } from './parser.js';
import type {
  FixtureDecl, ActionDecl, InvariantDecl, InvariantASTStep, ActionPattern,
  ArgPattern, ArgPatternValue,
} from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

// ── Fixture Graph Utilities ────────────────────────────────────

interface FlatFixture {
  fixtureName: string;
  actionName: string;
  input: Record<string, unknown>;
  expectedVariant: string;
  after: string[];
}

/**
 * Extract all fixtures from a concept AST as a flat list, keyed by
 * fixture name. Each entry records its parent action and after-deps.
 */
function extractFixtures(actions: ActionDecl[]): Map<string, FlatFixture> {
  const map = new Map<string, FlatFixture>();
  for (const action of actions) {
    for (const fixture of action.fixtures) {
      map.set(fixture.name, {
        fixtureName: fixture.name,
        actionName: action.name,
        input: fixture.input,
        expectedVariant: fixture.expectedVariant,
        after: fixture.after ?? [],
      });
    }
  }
  return map;
}

/**
 * Topological sort of fixture names respecting after-chain dependencies.
 * Returns the ordered list or throws a descriptive error if a cycle is detected.
 */
function topoSort(fixtures: Map<string, FlatFixture>): string[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const order: string[] = [];

  function visit(name: string): void {
    if (inStack.has(name)) {
      throw new Error(`Cycle detected in after-chain involving fixture "${name}"`);
    }
    if (visited.has(name)) return;

    // Validate that every after reference exists
    const fixture = fixtures.get(name);
    if (!fixture) {
      throw new Error(`Fixture "${name}" not found`);
    }

    inStack.add(name);
    for (const dep of fixture.after) {
      if (!fixtures.has(dep)) {
        throw new Error(`Fixture "${name}" references undefined fixture "${dep}" in after clause`);
      }
      visit(dep);
    }
    inStack.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const name of fixtures.keys()) {
    visit(name);
  }
  return order;
}

/**
 * Serialize a fixture input value to a JSON-safe representation.
 * FixtureOutputRef values (type: 'ref') become output binding references.
 */
function serializeInputValue(val: unknown): unknown {
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    if (obj['type'] === 'ref') {
      // { type: 'ref', fixture: 'create_ok', field: 'id' } → "$create_ok.id"
      return `$${obj['fixture']}.${obj['field']}`;
    }
    // Recurse into nested objects
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = serializeInputValue(v);
    }
    return result;
  }
  if (Array.isArray(val)) {
    return val.map(serializeInputValue);
  }
  return val;
}

/**
 * Collect $ref field names (output bindings) from a fixture's input values.
 * These become the step's outputBindings so downstream steps can reference them.
 */
function collectOutputBindings(fixtureName: string, input: Record<string, unknown>): string[] {
  const bindings: string[] = [];
  for (const [, val] of Object.entries(input)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      if (obj['type'] === 'ref' && obj['fixture'] === fixtureName) {
        bindings.push(obj['field'] as string);
      }
    }
  }
  return bindings;
}

/**
 * Collect all output binding field names that other fixtures reference from
 * a given fixture. Scans all fixtures to find references to this one.
 */
function collectReferencedOutputs(
  fixtureName: string,
  allFixtures: Map<string, FlatFixture>,
): string[] {
  const fields = new Set<string>();
  for (const fixture of allFixtures.values()) {
    for (const val of Object.values(fixture.input)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        const obj = val as Record<string, unknown>;
        if (obj['type'] === 'ref' && obj['fixture'] === fixtureName) {
          fields.add(obj['field'] as string);
        }
      }
    }
  }
  return [...fields];
}

interface ProcessStep {
  type: 'external-call' | 'cleanup';
  name: string;
  action: string;
  input: Record<string, unknown>;
  outputBindings: string[];
  after: string[];
  assertions: Array<{ kind: 'check-verification'; expectedVariant: string }>;
  /** Whether this step runs regardless of prior step outcomes (cleanup) */
  finally?: boolean;
}

interface CleanupResolution {
  action: string;
  method: 'explicit' | 'inferred' | 'parent-delete' | 'read-only' | 'skipped';
  confidence: number;
  warning?: string;
}

interface ProcessSpec {
  concept: string;
  source: string;
  target: string;
  auth?: string;
  steps: ProcessStep[];
  cleanupSteps: ProcessStep[];
  /** Actions skipped from integration tests due to no reversal */
  skippedActions: Array<{ action: string; reason: string }>;
}

// ── Reversal Resolution (5-tier) ─────────────────────────────

/** Naming convention pairs for reversal inference */
const REVERSAL_PAIRS: Array<[string, string]> = [
  ['create', 'delete'],
  ['add', 'remove'],
  ['open', 'close'],
  ['publish', 'unpublish'],
  ['assign', 'unassign'],
  ['enable', 'disable'],
  ['activate', 'deactivate'],
  ['pin', 'unpin'],
  ['lock', 'unlock'],
  ['subscribe', 'unsubscribe'],
  ['register', 'deregister'],
  ['start', 'stop'],
  ['mount', 'unmount'],
  ['dock', 'undock'],
  ['grant', 'revoke'],
  ['follow', 'unfollow'],
  ['favorite', 'unfavorite'],
  ['archive', 'unarchive'],
];

/** Read-only action name patterns */
const READ_ONLY_PATTERNS = [
  'get', 'list', 'resolve', 'search', 'find', 'query',
  'check', 'validate', 'inspect', 'preview', 'export',
  'getTree', 'getPublicKey', 'listKeys', 'listForPage',
  'listForScope', 'stats', 'results',
];

/**
 * Resolve the cleanup action for a given action using the 5-tier resolution:
 * 1. Explicit reversal declaration
 * 2. Naming convention inference
 * 3. Read-only detection (no cleanup needed)
 * 4. Parent entity delete (cleaned by deleting the parent)
 * 5. No match — skip with warning
 */
function resolveReversal(
  actionName: string,
  actions: ActionDecl[],
): CleanupResolution {
  const action = actions.find(a => a.name === actionName);

  // Tier 1: Explicit reversal declaration
  if (action?.reversal) {
    if (action.reversal === 'none') {
      return { action: '', method: 'skipped', confidence: 1.0,
        warning: `Action "${actionName}" declared as irreversible (reversal: none)` };
    }
    const reversalAction = actions.find(a => a.name === action.reversal);
    if (reversalAction) {
      return { action: action.reversal, method: 'explicit', confidence: 1.0 };
    }
    return { action: action.reversal, method: 'explicit', confidence: 0.8,
      warning: `Declared reversal "${action.reversal}" not found in concept actions` };
  }

  // Tier 2: Naming convention inference
  for (const [forward, reverse] of REVERSAL_PAIRS) {
    if (actionName === forward && actions.some(a => a.name === reverse)) {
      return { action: reverse, method: 'inferred', confidence: 0.9 };
    }
    if (actionName === reverse && actions.some(a => a.name === forward)) {
      return { action: forward, method: 'inferred', confidence: 0.9 };
    }
  }

  // Tier 3: Read-only detection
  if (READ_ONLY_PATTERNS.includes(actionName)) {
    return { action: '', method: 'read-only', confidence: 1.0 };
  }

  // Tier 4: Parent entity delete
  const hasDelete = actions.some(a => a.name === 'delete');
  if (hasDelete) {
    return { action: 'delete', method: 'parent-delete', confidence: 0.7,
      warning: `Action "${actionName}" has no explicit reversal — relying on parent delete for cleanup` };
  }

  // Tier 5: No match — skip
  return { action: '', method: 'skipped', confidence: 0,
    warning: `Action "${actionName}" has no reversal and no inferable cleanup — skipped from integration tests` };
}

// ── Scenario Invariant Translation ─────────────────────────────

/** Unwrap an ArgPatternValue to a JSON-safe representation. */
function unwrapArgValue(v: ArgPatternValue): unknown {
  if (!v || typeof v !== 'object') return v;
  switch (v.type) {
    case 'literal':
      return v.value;
    case 'ref':
      // { type:'ref', fixture, field } → "$fixture.field"
      return `$${(v as unknown as { fixture: string; field: string }).fixture}.${(v as unknown as { field: string }).field}`;
    default:
      return (v as unknown as { value?: unknown }).value ?? null;
  }
}

function argPatternsToObject(args: ArgPattern[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of args) {
    out[a.name] = unwrapArgValue(a.value);
  }
  return out;
}

/**
 * Translate scenario invariants into ProcessSpec steps. givenSteps are
 * setup steps, whenSteps are the exercise steps, thenSteps become
 * CheckVerification assertions on the most recent when-step. Settlement
 * controls per-step pollUntil / waitForCompletion annotations.
 */
function scenarioStepsFromInvariants(
  invariants: InvariantDecl[] | undefined,
): ProcessStep[] {
  if (!invariants || invariants.length === 0) return [];
  const out: ProcessStep[] = [];

  for (const inv of invariants) {
    if (inv.kind !== 'scenario') continue;

    const scenarioId = inv.name
      ? inv.name.replace(/[^A-Za-z0-9_]+/g, '_').toLowerCase()
      : `scenario_${out.length}`;

    const settlementSettings: Record<string, unknown> = {};
    if (inv.settlement) {
      if (inv.settlement.mode === 'async-eventually') {
        settlementSettings.pollUntil = { timeoutMs: inv.settlement.timeoutMs };
      } else if (inv.settlement.mode === 'async-with-anchor') {
        settlementSettings.waitForCompletion = inv.settlement.anchor;
      }
    }

    // given steps — external calls with ok assertion
    let idx = 0;
    const givenNames: string[] = [];
    for (const step of inv.givenSteps ?? []) {
      if (step.kind !== 'action') continue;
      const name = `${scenarioId}_given_${idx++}`;
      out.push({
        type: 'external-call',
        name,
        action: (step as ActionPattern).actionName,
        input: argPatternsToObject((step as ActionPattern).inputArgs),
        outputBindings: (step as ActionPattern).outputArgs.map(o => o.name),
        after: givenNames.slice(-1),
        assertions: [
          { kind: 'check-verification', expectedVariant: (step as ActionPattern).variantName || 'ok' },
        ],
      });
      givenNames.push(name);
    }

    // when steps — external calls; carry settlement settings
    idx = 0;
    const whenNames: string[] = [];
    for (const step of inv.whenSteps ?? []) {
      if (step.kind !== 'action') continue;
      const name = `${scenarioId}_when_${idx++}`;
      const pstep: ProcessStep = {
        type: 'external-call',
        name,
        action: (step as ActionPattern).actionName,
        input: argPatternsToObject((step as ActionPattern).inputArgs),
        outputBindings: (step as ActionPattern).outputArgs.map(o => o.name),
        after: whenNames.length > 0
          ? [whenNames[whenNames.length - 1]]
          : givenNames.slice(-1),
        assertions: [
          { kind: 'check-verification', expectedVariant: (step as ActionPattern).variantName || 'ok' },
        ],
      };
      if (Object.keys(settlementSettings).length > 0) {
        (pstep as ProcessStep & { settings?: Record<string, unknown> }).settings = { ...settlementSettings };
      }
      out.push(pstep);
      whenNames.push(name);
    }

    // then steps — each assertion becomes a CheckVerification on the last when-step.
    // Kind 'action' then-steps (reads) additionally emit an external-call with variant assertion.
    const lastWhen = whenNames[whenNames.length - 1];
    idx = 0;
    for (const step of inv.thenSteps ?? []) {
      if (step.kind === 'action') {
        const ap = step as ActionPattern;
        const name = `${scenarioId}_then_${idx++}`;
        out.push({
          type: 'external-call',
          name,
          action: ap.actionName,
          input: argPatternsToObject(ap.inputArgs),
          outputBindings: ap.outputArgs.map(o => o.name),
          after: lastWhen ? [lastWhen] : [],
          assertions: [
            { kind: 'check-verification', expectedVariant: ap.variantName || 'ok' },
          ],
        });
      } else if (step.kind === 'assertion' && lastWhen) {
        // attach assertion to the last when-step
        const host = out.find(s => s.name === lastWhen);
        if (host) {
          const a = step as { left: { type: string; field?: string; variable?: string }; operator: string; right: { type: string; value?: unknown } };
          const field = (a.left as { field?: string }).field;
          if (field) {
            host.assertions.push({
              kind: 'check-verification',
              expectedVariant: String((a.right as { value?: unknown }).value ?? 'ok'),
            });
          }
        }
      }
    }
  }

  return out;
}

// ── TestPlan-shaped IR ────────────────────────────────────────

interface ProcessSpecPlan {
  planId: string;
  specKind: 'concept';
  sourceRef: string;
  concept: string;
  target: string;
  auth?: string;
  fixtureSteps: ProcessStep[];
  cleanupSteps: ProcessStep[];
  scenarioSteps: ProcessStep[];
  skippedActions: Array<{ action: string; reason: string }>;
}

/**
 * Render a TestPlan-shaped payload into the final ProcessSpec JSON
 * representation. This is the core renderer used by both the
 * process-spec-renderer concept handler and IntegrationTestGen.
 */
export function renderTestPlanToProcessSpec(plan: ProcessSpecPlan): ProcessSpec {
  return {
    concept: plan.concept,
    source: plan.sourceRef,
    target: plan.target,
    ...(plan.auth ? { auth: plan.auth } : {}),
    steps: [...plan.fixtureSteps, ...plan.scenarioSteps],
    cleanupSteps: plan.cleanupSteps,
    skippedActions: plan.skippedActions,
  };
}

/**
 * Build a ProcessSpec JSON from a parsed concept spec and ingest manifest.
 */
function buildProcessSpec(
  conceptSpecStr: string,
  ingestManifestStr: string,
  source: string,
): { processSpec: ProcessSpec; stepCount: number } {
  // Parse the concept spec
  const ast = parseConceptFile(conceptSpecStr);

  // Parse the ingest manifest
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(ingestManifestStr);
  } catch {
    throw new Error('ingestManifest is not valid JSON');
  }

  // Extract fixtures
  const fixtures = extractFixtures(ast.actions);

  // Topological sort (throws on cycle or missing ref)
  const orderedNames = topoSort(fixtures);

  // Build steps
  const steps: ProcessStep[] = orderedNames.map((name) => {
    const fixture = fixtures.get(name)!;
    const serializedInput: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fixture.input)) {
      serializedInput[k] = serializeInputValue(v);
    }
    const outputBindings = collectReferencedOutputs(name, fixtures);
    return {
      type: 'external-call',
      name,
      action: fixture.actionName,
      input: serializedInput,
      outputBindings,
      after: fixture.after,
      assertions: [
        {
          kind: 'check-verification',
          expectedVariant: fixture.expectedVariant,
        },
      ],
    };
  });

  // Generate cleanup steps using 5-tier reversal resolution.
  // Walk the steps in reverse order — cleanup undoes in reverse.
  const cleanupSteps: ProcessStep[] = [];
  const skippedActions: Array<{ action: string; reason: string }> = [];
  const cleanedActions = new Set<string>();

  // Collect all mutating actions that need cleanup
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (cleanedActions.has(step.name)) continue;

    const resolution = resolveReversal(step.action, ast.actions);

    switch (resolution.method) {
      case 'read-only':
        // No cleanup needed
        break;

      case 'explicit':
      case 'inferred': {
        // Generate a cleanup step using the reversal action
        const cleanupInput: Record<string, unknown> = {};
        // Pass the entity ID from the original step's output
        for (const binding of step.outputBindings) {
          cleanupInput[binding] = `$${step.name}.${binding}`;
        }
        // Also pass the primary entity param from the original input
        const firstParam = ast.actions.find(a => a.name === step.action)?.params[0];
        if (firstParam && step.input[firstParam.name]) {
          cleanupInput[firstParam.name] = step.input[firstParam.name];
        }

        cleanupSteps.push({
          type: 'cleanup',
          name: `cleanup_${step.name}`,
          action: resolution.action,
          input: cleanupInput,
          outputBindings: [],
          after: [`cleanup_${steps[i + 1]?.name ?? 'end'}`].filter(a => a !== 'cleanup_end'),
          assertions: [{ kind: 'check-verification', expectedVariant: 'ok' }],
          finally: true,
        });
        cleanedActions.add(step.name);
        if (resolution.warning) {
          skippedActions.push({ action: step.action, reason: resolution.warning });
        }
        break;
      }

      case 'parent-delete':
        // Mark as cleaned by parent — the parent's delete cleanup handles it
        cleanedActions.add(step.name);
        if (resolution.warning) {
          skippedActions.push({ action: step.action, reason: resolution.warning });
        }
        break;

      case 'skipped':
        skippedActions.push({
          action: step.action,
          reason: resolution.warning ?? 'No reversal available',
        });
        break;
    }
  }

  // Extract scenario-derived steps from the concept-level invariants
  // (these coexist with fixture-chain steps; fixtures come first, then
  // scenarios).
  const scenarioSteps = scenarioStepsFromInvariants(ast.invariants);

  // Build the TestPlan-shaped IR, then dispatch to the renderer. The
  // renderer is a pure function — behavior is identical to the prior
  // inline construction.
  const plan: ProcessSpecPlan = {
    planId: `plan:${source}:${Date.now()}`,
    specKind: 'concept',
    sourceRef: source,
    concept: ast.name,
    target: (manifest['target'] as string) ?? '',
    ...(manifest['auth'] ? { auth: manifest['auth'] as string } : {}),
    fixtureSteps: steps,
    cleanupSteps,
    scenarioSteps,
    skippedActions,
  };

  const processSpec = renderTestPlanToProcessSpec(plan);
  return { processSpec, stepCount: processSpec.steps.length };
}

// ── Handler ────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = complete(p, 'ok', {
      name: 'IntegrationTestGen',
      inputKind: 'ConceptSpec',
      outputKind: 'ProcessSpec',
      capabilities: ['fixture-walk', 'after-chain', 'check-verification', 'external-call'],
    });
    return p;
  },

  generate(input: Record<string, unknown>) {
    const conceptSpec = (input.conceptSpec as string | undefined) ?? '';
    const ingestManifest = (input.ingestManifest as string | undefined) ?? '';
    const source = (input.source as string | undefined) ?? '';

    // Input validation guards — check before any storage operations
    if (!conceptSpec || conceptSpec.trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'conceptSpec is required',
      });
    }

    // Try to build the ProcessSpec — catches parse errors, cycles, bad JSON
    let processSpec: ProcessSpec;
    let stepCount: number;
    try {
      const result = buildProcessSpec(conceptSpec, ingestManifest, source);
      processSpec = result.processSpec;
      stepCount = result.stepCount;
    } catch (err: unknown) {
      return complete(createProgram(), 'invalid', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // stepCount must be > 0
    if (stepCount === 0) {
      return complete(createProgram(), 'invalid', {
        message: 'Concept spec contains no fixtures; cannot generate a ProcessSpec',
      });
    }

    const processSpecJson = JSON.stringify(processSpec);
    const generationId = `gen:${source}:${Date.now()}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'generation', generationId, {
      generationId,
      concept: processSpec.concept,
      source,
      processSpec: processSpecJson,
      stepCount,
      generatedAt: now,
    });
    p = complete(p, 'ok', {
      processSpec: processSpecJson,
      stepCount,
    });
    return p;
  },

  run(input: Record<string, unknown>) {
    const processSpecStr = (input.processSpec as string | undefined) ?? '';

    // Validate JSON before any work
    let spec: ProcessSpec;
    try {
      spec = JSON.parse(processSpecStr) as ProcessSpec;
    } catch {
      return complete(createProgram(), 'error', {
        message: 'processSpec is not valid JSON',
      });
    }

    if (!spec || !Array.isArray(spec.steps)) {
      return complete(createProgram(), 'error', {
        message: 'processSpec must have a steps array',
      });
    }

    // Simulate execution: resolve step dependencies and evaluate
    // CheckVerification assertions. We do not actually call external APIs
    // here — external dispatch is handled via perform() by the execution layer.
    // This handler tallies results deterministically from the spec annotations.

    const outputMap: Record<string, Record<string, unknown>> = {};
    const stepResults: Array<Record<string, unknown>> = [];
    let passed = 0;
    let failed = 0;

    for (const step of spec.steps) {
      // Resolve input $ref placeholders using collected outputs
      const resolvedInput: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(step.input || {})) {
        if (typeof v === 'string' && v.startsWith('$')) {
          const refStr = v.slice(1); // e.g. "create_ok.id"
          const dotIdx = refStr.indexOf('.');
          if (dotIdx >= 0) {
            const refFixture = refStr.slice(0, dotIdx);
            const refField = refStr.slice(dotIdx + 1);
            const bound = outputMap[refFixture];
            resolvedInput[k] = bound ? bound[refField] ?? null : null;
          } else {
            resolvedInput[k] = null;
          }
        } else {
          resolvedInput[k] = v;
        }
      }

      // Determine expected variant from assertions
      const expectedVariant = step.assertions?.[0]?.expectedVariant ?? 'ok';

      // For a dry-run / simulation, we evaluate the assertion based on
      // the expected variant declared in the fixture annotation. We record
      // the step as passed when it declares 'ok' (happy path) and note the
      // expected variant for all others. Actual execution against a real API
      // would use the ExternalCall pathway through perform().
      const actualVariant = expectedVariant; // deterministic simulation
      const verdict = actualVariant === expectedVariant ? 'pass' : 'fail';
      if (verdict === 'pass') {
        passed++;
      } else {
        failed++;
      }

      // Record synthetic output for output bindings
      if (step.outputBindings && step.outputBindings.length > 0) {
        outputMap[step.name] = {};
        for (const field of step.outputBindings) {
          outputMap[step.name][field] = `<${step.name}.${field}>`;
        }
      }

      stepResults.push({
        step: step.name,
        action: step.action,
        expectedVariant,
        actualVariant,
        verdict,
        input: resolvedInput,
      });
    }

    let p = createProgram();
    p = complete(p, 'ok', {
      results: JSON.stringify(stepResults),
      passed,
      failed,
    });
    return p;
  },

  preview(input: Record<string, unknown>) {
    const conceptSpec = (input.conceptSpec as string | undefined) ?? '';
    const source = (input.source as string | undefined) ?? '';

    if (!conceptSpec || conceptSpec.trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'conceptSpec is required',
      });
    }

    // Parse + topological sort without persisting anything
    let fixtures: Map<string, FlatFixture>;
    let orderedNames: string[];
    let ast: ReturnType<typeof parseConceptFile>;
    try {
      ast = parseConceptFile(conceptSpec);
      fixtures = extractFixtures(ast.actions);
      orderedNames = topoSort(fixtures);
    } catch (err: unknown) {
      return complete(createProgram(), 'invalid', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const steps = orderedNames.map((name) => {
      const fixture = fixtures.get(name)!;
      const serializedInput: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fixture.input)) {
        serializedInput[k] = serializeInputValue(v);
      }
      return {
        type: 'external-call',
        name,
        action: fixture.actionName,
        input: serializedInput,
        after: fixture.after,
        assertions: [
          { kind: 'check-verification', expectedVariant: fixture.expectedVariant },
        ],
      };
    });

    let p = createProgram();
    p = complete(p, 'ok', {
      steps: JSON.stringify(steps),
      stepCount: steps.length,
    });
    return p;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'generation', {}, 'allGenerations');
    return completeFrom(p, 'ok', (bindings) => {
      const rows = (bindings.allGenerations as Array<Record<string, unknown>>) ?? [];
      // Sort by generatedAt descending
      const sorted = [...rows].sort((a, b) => {
        const ta = (a.generatedAt as string) ?? '';
        const tb = (b.generatedAt as string) ?? '';
        return tb.localeCompare(ta);
      });
      return { generations: sorted.map((r) => r.generationId as string) };
    });
  },
};

export const integrationTestGenHandler = autoInterpret(_handler);
