// ============================================================
// LLM Core Suite Tests
//
// Tests:
// 1. LLMProvider concept parsing and structural validation
// 2. ModelRouter concept parsing and structural validation
// 3. All sync files parse correctly
// 4. suite.yaml references valid files
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST, CompiledSync } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-core');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// 1. LLMProvider Concept
// ============================================================

describe('LLMProvider concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('llm-provider');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('LLMProvider');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter P', () => {
    expect(ast.typeParams).toEqual(['P']);
  });

  it('has a purpose block', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('gateway');
  });

  it('declares 7 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'register', 'generate', 'stream', 'embed',
      'countTokens', 'healthCheck', 'updateConfig',
    ]);
  });

  it('register action has ok and invalid variants', () => {
    const register = ast.actions.find(a => a.name === 'register')!;
    const variants = register.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('generate action has 6 return variants', () => {
    const generate = ast.actions.find(a => a.name === 'generate')!;
    expect(generate.variants).toHaveLength(6);
    const variants = generate.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('rate_limited');
    expect(variants).toContain('context_overflow');
    expect(variants).toContain('auth_failure');
    expect(variants).toContain('content_filtered');
    expect(variants).toContain('unavailable');
  });

  it('has state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('providers');
    expect(stateNames).toContain('provider_id');
    expect(stateNames).toContain('model_id');
    expect(stateNames).toContain('api_credentials');
    expect(stateNames).toContain('capabilities');
    expect(stateNames).toContain('pricing');
    expect(stateNames).toContain('rate_limits');
    expect(stateNames).toContain('status');
  });

  it('requires persistent-storage and network capabilities', () => {
    expect(ast.capabilities).toContain('persistent-storage');
    expect(ast.capabilities).toContain('network');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 2. ModelRouter Concept
// ============================================================

describe('ModelRouter concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('model-router');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('ModelRouter');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter R', () => {
    expect(ast.typeParams).toEqual(['R']);
  });

  it('declares 5 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'addRoute', 'route', 'fallback', 'recordOutcome', 'getHealth',
    ]);
  });

  it('route action has ok and no_route variants', () => {
    const route = ast.actions.find(a => a.name === 'route')!;
    const variants = route.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('no_route');
  });

  it('has state fields for routing', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('routes');
    expect(stateNames).toContain('conditions');
    expect(stateNames).toContain('priority');
    expect(stateNames).toContain('weight');
    expect(stateNames).toContain('fallback_chain');
    expect(stateNames).toContain('routing_strategy');
    expect(stateNames).toContain('performance_log');
    expect(stateNames).toContain('circuit_breakers');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 3. Sync File Parsing
// ============================================================

describe('llm-core sync files', () => {
  const syncFiles = [
    'router-selects-provider',
    'generation-records-usage',
    'router-circuit-breaker',
    'cost-threshold-alert',
    'provider-registers-in-plugin-registry',
    'provider-health-to-eventbus',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });

  it('RouterSelectsProvider has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('router-selects-provider'));
    const sync = syncs[0];
    expect(sync.name).toBe('RouterSelectsProvider');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('GenerationRecordsUsage references LLMProvider and LLMTrace', () => {
    const syncs = parseSyncFile(readSync('generation-records-usage'));
    const sync = syncs[0];
    expect(sync.name).toBe('GenerationRecordsUsage');
  });
});

// ============================================================
// 4. Suite Manifest
// ============================================================

describe('llm-core suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-core');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists LLMProvider and ModelRouter concepts', () => {
    expect(manifest.concepts.LLMProvider).toBeDefined();
    expect(manifest.concepts.ModelRouter).toBeDefined();
    expect(manifest.concepts.LLMProvider.spec).toBe('./llm-provider.concept');
    expect(manifest.concepts.ModelRouter.spec).toBe('./model-router.concept');
  });

  it('all referenced concept files exist', () => {
    for (const [, value] of Object.entries(manifest.concepts)) {
      const specPath = resolve(SUITE_DIR, (value as any).spec);
      expect(existsSync(specPath)).toBe(true);
    }
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

  it('has uses declarations', () => {
    expect(manifest.uses).toBeDefined();
    expect(manifest.uses.length).toBeGreaterThanOrEqual(1);
  });
});
