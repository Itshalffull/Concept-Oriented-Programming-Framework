// ============================================================
// LLM Safety Suite Tests
//
// Tests:
// 1. Guardrail concept parsing and structural validation
// 2. LLMTrace concept parsing and structural validation
// 3. SemanticRouter concept parsing and structural validation
// 4. All 7 sync files parse correctly with structural checks
// 5. suite.yaml references valid files and metadata
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-safety');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// 1. Guardrail Concept
// ============================================================

describe('Guardrail concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('guardrail');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('Guardrail');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter G', () => {
    expect(ast.typeParams).toEqual(['G']);
  });

  it('has a purpose block referencing safety enforcement', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('Safety');
  });

  it('declares 7 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'addRule', 'checkInput', 'checkOutput',
      'check', 'getViolations', 'removeRule',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('addRule action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'addRule')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('checkInput action has pass and violation variants', () => {
    const action = ast.actions.find(a => a.name === 'checkInput')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('pass');
    expect(variants).toContain('violation');
  });

  it('checkOutput action has pass and violation variants', () => {
    const action = ast.actions.find(a => a.name === 'checkOutput')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('pass');
    expect(variants).toContain('violation');
  });

  it('check action has pass, blocked, and flagged variants', () => {
    const action = ast.actions.find(a => a.name === 'check')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('pass');
    expect(variants).toContain('blocked');
    expect(variants).toContain('flagged');
  });

  it('getViolations action has ok and empty variants', () => {
    const action = ast.actions.find(a => a.name === 'getViolations')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('removeRule action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'removeRule')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for guardrail management', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('guardrails');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('guardrail_type');
    expect(stateNames).toContain('config');
    expect(stateNames).toContain('rules');
    expect(stateNames).toContain('violation_log');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 2. LLMTrace Concept
// ============================================================

describe('LLMTrace concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('llm-trace');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('LLMTrace');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter Z', () => {
    expect(ast.typeParams).toEqual(['Z']);
  });

  it('has a purpose block referencing observability', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('Observability');
  });

  it('declares 7 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'startTrace', 'startSpan', 'endSpan', 'addMetric',
      'getCost', 'getTrace', 'export',
    ]);
  });

  it('startTrace action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'startTrace')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('startSpan action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'startSpan')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('endSpan action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'endSpan')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('addMetric action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'addMetric')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('getCost action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'getCost')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('getTrace action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'getTrace')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('export action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'export')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for trace management', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('traces');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('spans');
    expect(stateNames).toContain('metrics');
    expect(stateNames).toContain('tags');
    expect(stateNames).toContain('total_cost');
    expect(stateNames).toContain('total_tokens');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 3. SemanticRouter Concept
// ============================================================

describe('SemanticRouter concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('semantic-router');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('SemanticRouter');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter S', () => {
    expect(ast.typeParams).toEqual(['S']);
  });

  it('has a purpose block referencing semantic intent routing', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('Routes');
  });

  it('declares 6 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'define', 'route', 'addExemplar', 'setFallback',
      'getRoutes', 'removeRoute',
    ]);
  });

  it('define action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'define')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('route action has ok, no_match, and fallback variants', () => {
    const action = ast.actions.find(a => a.name === 'route')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('no_match');
    expect(variants).toContain('fallback');
  });

  it('addExemplar action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'addExemplar')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('setFallback action has ok variant', () => {
    const action = ast.actions.find(a => a.name === 'setFallback')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
  });

  it('getRoutes action has ok variant', () => {
    const action = ast.actions.find(a => a.name === 'getRoutes')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
  });

  it('removeRoute action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'removeRoute')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for route management', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('routes');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('exemplars');
    expect(stateNames).toContain('target_pipeline');
    expect(stateNames).toContain('threshold');
    expect(stateNames).toContain('fallback_route');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 4. Sync File Parsing
// ============================================================

describe('llm-safety sync files', () => {
  const syncFiles = [
    'generation-creates-trace-span',
    'guardrail-checks-input',
    'guardrail-checks-output',
    'guardrail-escalates-to-notification',
    'router-selects-pipeline',
    'trace-exports-opentelemetry',
    'trace-records-cost',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });

  it('GenerationCreatesTraceSpan has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('generation-creates-trace-span'));
    const sync = syncs[0];
    expect(sync.name).toBe('GenerationCreatesTraceSpan');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('GuardrailChecksInput has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('guardrail-checks-input'));
    const sync = syncs[0];
    expect(sync.name).toBe('GuardrailChecksInput');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('GuardrailChecksOutput has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('guardrail-checks-output'));
    const sync = syncs[0];
    expect(sync.name).toBe('GuardrailChecksOutput');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('GuardrailEscalatesToNotification has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('guardrail-escalates-to-notification'));
    const sync = syncs[0];
    expect(sync.name).toBe('GuardrailEscalatesToNotification');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('RouterSelectsPipeline has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('router-selects-pipeline'));
    const sync = syncs[0];
    expect(sync.name).toBe('RouterSelectsPipeline');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('TraceExportsOpenTelemetry has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('trace-exports-opentelemetry'));
    const sync = syncs[0];
    expect(sync.name).toBe('TraceExportsOpenTelemetry');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('TraceRecordsCost has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('trace-records-cost'));
    const sync = syncs[0];
    expect(sync.name).toBe('TraceRecordsCost');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 5. Suite Manifest
// ============================================================

describe('llm-safety suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-safety');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists Guardrail, LLMTrace, and SemanticRouter concepts', () => {
    expect(manifest.concepts.Guardrail).toBeDefined();
    expect(manifest.concepts.LLMTrace).toBeDefined();
    expect(manifest.concepts.SemanticRouter).toBeDefined();
    expect(manifest.concepts.Guardrail.spec).toBe('./guardrail.concept');
    expect(manifest.concepts.LLMTrace.spec).toBe('./llm-trace.concept');
    expect(manifest.concepts.SemanticRouter.spec).toBe('./semantic-router.concept');
  });

  it('declares type parameter bindings for each concept', () => {
    expect(manifest.concepts.Guardrail.params.G).toBeDefined();
    expect(manifest.concepts.LLMTrace.params.Z).toBeDefined();
    expect(manifest.concepts.SemanticRouter.params.S).toBeDefined();
  });

  it('all referenced concept files exist', () => {
    for (const [, value] of Object.entries(manifest.concepts)) {
      const specPath = resolve(SUITE_DIR, (value as any).spec);
      expect(existsSync(specPath)).toBe(true);
    }
  });

  it('has required, recommended, and integration sync categories', () => {
    expect(manifest.syncs.required).toBeDefined();
    expect(manifest.syncs.required.length).toBe(3);
    expect(manifest.syncs.recommended).toBeDefined();
    expect(manifest.syncs.recommended.length).toBe(3);
    expect(manifest.syncs.integration).toBeDefined();
    expect(manifest.syncs.integration.length).toBe(1);
  });

  it('all referenced sync files exist', () => {
    const allSyncs = [
      ...(manifest.syncs.required || []),
      ...(manifest.syncs.recommended || []),
      ...(manifest.syncs.integration || []),
    ];
    for (const sync of allSyncs) {
      const syncPath = resolve(SUITE_DIR, sync.path);
      expect(existsSync(syncPath)).toBe(true);
    }
  });

  it('has uses declarations for external suites', () => {
    expect(manifest.uses).toBeDefined();
    expect(manifest.uses.length).toBeGreaterThanOrEqual(1);
    const suiteNames = manifest.uses.map((u: any) => u.suite);
    expect(suiteNames).toContain('llm-core');
  });

  it('references optional notification and infrastructure suites', () => {
    const optionalUses = manifest.uses.filter((u: any) => u.optional === true);
    const optionalSuites = optionalUses.map((u: any) => u.suite);
    expect(optionalSuites).toContain('notification');
    expect(optionalSuites).toContain('infrastructure');
  });
});
