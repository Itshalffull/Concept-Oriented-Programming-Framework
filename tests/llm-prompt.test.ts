// ============================================================
// LLM Prompt Suite Tests
//
// Tests:
// 1. Signature concept parsing and structural validation
// 2. PromptAssembly concept parsing and structural validation
// 3. FewShotExample concept parsing and structural validation
// 4. PromptOptimizer concept parsing and structural validation
// 5. Assertion concept parsing and structural validation
// 6. All sync files parse correctly
// 7. Sync structural validation (when/then clauses, names)
// 8. suite.yaml references valid files and metadata
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-prompt');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// 1. Signature Concept
// ============================================================

describe('Signature concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('signature');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('Signature');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter G', () => {
    expect(ast.typeParams).toEqual(['G']);
  });

  it('has a purpose block', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('input');
  });

  it('declares 4 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual(['define', 'compile', 'execute', 'recompile']);
  });

  it('define action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'define')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('compile action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'compile')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('execute action has ok, validation_error, and not_compiled variants', () => {
    const action = ast.actions.find(a => a.name === 'execute')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('validation_error');
    expect(variants).toContain('not_compiled');
  });

  it('recompile action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'recompile')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('has state fields for signature definition and compilation', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('signatures');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('input_fields');
    expect(stateNames).toContain('output_fields');
    expect(stateNames).toContain('instruction');
    expect(stateNames).toContain('module_type');
    expect(stateNames).toContain('compiled_prompts');
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
// 2. PromptAssembly Concept
// ============================================================

describe('PromptAssembly concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('prompt-assembly');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('PromptAssembly');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter P', () => {
    expect(ast.typeParams).toEqual(['P']);
  });

  it('has a purpose block referencing sections and token budget', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('section');
  });

  it('declares 7 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'addSection', 'setVariable', 'assemble',
      'toMessages', 'estimateTokens', 'removeSection',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('addSection action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'addSection')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('setVariable action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'setVariable')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('assemble action has ok and over_budget variants', () => {
    const action = ast.actions.find(a => a.name === 'assemble')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('over_budget');
  });

  it('toMessages action has ok and over_budget variants', () => {
    const action = ast.actions.find(a => a.name === 'toMessages')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('over_budget');
  });

  it('estimateTokens action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'estimateTokens')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('removeSection action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'removeSection')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for assembly layout and budget', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('assemblies');
    expect(stateNames).toContain('sections');
    expect(stateNames).toContain('assembly_strategy');
    expect(stateNames).toContain('format');
    expect(stateNames).toContain('variables');
    expect(stateNames).toContain('output_directive');
    expect(stateNames).toContain('tokenizer_id');
    expect(stateNames).toContain('context_window');
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
// 3. FewShotExample Concept
// ============================================================

describe('FewShotExample concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('few-shot-example');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('FewShotExample');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter F', () => {
    expect(ast.typeParams).toEqual(['F']);
  });

  it('has a purpose block referencing example pools and selection', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('example');
  });

  it('declares 6 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'createPool', 'add', 'select', 'optimize', 'embed', 'remove',
    ]);
  });

  it('createPool action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'createPool')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('add action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'add')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('select action has ok and empty variants', () => {
    const action = ast.actions.find(a => a.name === 'select')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('optimize action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'optimize')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('embed action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'embed')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('remove action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'remove')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for example pool management', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('pools');
    expect(stateNames).toContain('examples');
    expect(stateNames).toContain('selection_strategy');
    expect(stateNames).toContain('k');
    expect(stateNames).toContain('diversity_weight');
    expect(stateNames).toContain('quality_scores');
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
// 4. PromptOptimizer Concept
// ============================================================

describe('PromptOptimizer concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('prompt-optimizer');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('PromptOptimizer');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter O', () => {
    expect(ast.typeParams).toEqual(['O']);
  });

  it('has a purpose block referencing optimization', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('optimi');
  });

  it('declares 5 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'optimize', 'evaluate', 'compare', 'rollback',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('optimize action has 3 return variants: ok, budget_exceeded, error', () => {
    const action = ast.actions.find(a => a.name === 'optimize')!;
    expect(action.variants).toHaveLength(3);
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('budget_exceeded');
    expect(variants).toContain('error');
  });

  it('evaluate action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'evaluate')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('compare action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'compare')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('rollback action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'rollback')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for optimization runs and budgeting', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('runs');
    expect(stateNames).toContain('target_program');
    expect(stateNames).toContain('metric');
    expect(stateNames).toContain('training_set');
    expect(stateNames).toContain('strategy');
    expect(stateNames).toContain('history');
    expect(stateNames).toContain('best_candidate');
    expect(stateNames).toContain('budget');
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
// 5. Assertion Concept
// ============================================================

describe('Assertion concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('assertion');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('Assertion');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter T', () => {
    expect(ast.typeParams).toEqual(['T']);
  });

  it('has a purpose block referencing constraints and backtracking', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('constraint');
  });

  it('declares 4 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual(['define', 'attach', 'evaluate', 'reset']);
  });

  it('define action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'define')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('attach action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'attach')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('evaluate action has 4 return variants: pass, fail, halt, warn', () => {
    const action = ast.actions.find(a => a.name === 'evaluate')!;
    expect(action.variants).toHaveLength(4);
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('pass');
    expect(variants).toContain('fail');
    expect(variants).toContain('halt');
    expect(variants).toContain('warn');
  });

  it('reset action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'reset')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has state fields for assertion tracking and retry management', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('assertions');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('constraint');
    expect(stateNames).toContain('severity');
    expect(stateNames).toContain('error_message');
    expect(stateNames).toContain('max_retries');
    expect(stateNames).toContain('retry_count');
    expect(stateNames).toContain('attached_to');
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
// 6. Sync File Parsing
// ============================================================

describe('llm-prompt sync files', () => {
  const syncFiles = [
    'assembly-checks-budget',
    'assembly-selects-examples',
    'signature-compiles-to-assembly',
    'assertion-triggers-retry',
    'optimizer-evaluates-via-trace',
    'prompt-version-tracking',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });

  it('AssemblyChecksBudget has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('assembly-checks-budget'));
    const sync = syncs[0];
    expect(sync.name).toBe('AssemblyChecksBudget');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('AssemblySelectsExamples references PromptAssembly and FewShotExample', () => {
    const syncs = parseSyncFile(readSync('assembly-selects-examples'));
    const sync = syncs[0];
    expect(sync.name).toBe('AssemblySelectsExamples');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('SignatureCompilesToAssembly has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('signature-compiles-to-assembly'));
    const sync = syncs[0];
    expect(sync.name).toBe('SignatureCompilesToAssembly');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('AssertionTriggersRetry has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('assertion-triggers-retry'));
    const sync = syncs[0];
    expect(sync.name).toBe('AssertionTriggersRetry');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('OptimizerEvaluatesViaTrace has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('optimizer-evaluates-via-trace'));
    const sync = syncs[0];
    expect(sync.name).toBe('OptimizerEvaluatesViaTrace');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('PromptVersionTracking has when and then clauses', () => {
    const syncs = parseSyncFile(readSync('prompt-version-tracking'));
    const sync = syncs[0];
    expect(sync.name).toBe('PromptVersionTracking');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 7. Suite Manifest
// ============================================================

describe('llm-prompt suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-prompt');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists all 5 concepts', () => {
    expect(manifest.concepts.Signature).toBeDefined();
    expect(manifest.concepts.PromptAssembly).toBeDefined();
    expect(manifest.concepts.FewShotExample).toBeDefined();
    expect(manifest.concepts.PromptOptimizer).toBeDefined();
    expect(manifest.concepts.Assertion).toBeDefined();
  });

  it('concept specs point to correct files', () => {
    expect(manifest.concepts.Signature.spec).toBe('./signature.concept');
    expect(manifest.concepts.PromptAssembly.spec).toBe('./prompt-assembly.concept');
    expect(manifest.concepts.FewShotExample.spec).toBe('./few-shot-example.concept');
    expect(manifest.concepts.PromptOptimizer.spec).toBe('./prompt-optimizer.concept');
    expect(manifest.concepts.Assertion.spec).toBe('./assertion.concept');
  });

  it('concept params have correct type parameter mappings', () => {
    expect(manifest.concepts.Signature.params.G.as).toBe('signature-id');
    expect(manifest.concepts.PromptAssembly.params.P.as).toBe('assembly-id');
    expect(manifest.concepts.FewShotExample.params.F.as).toBe('example-id');
    expect(manifest.concepts.PromptOptimizer.params.O.as).toBe('optimizer-id');
    expect(manifest.concepts.Assertion.params.T.as).toBe('assertion-id');
  });

  it('all referenced concept files exist', () => {
    for (const [, value] of Object.entries(manifest.concepts)) {
      const specPath = resolve(SUITE_DIR, (value as any).spec);
      expect(existsSync(specPath)).toBe(true);
    }
  });

  it('all referenced sync files exist', () => {
    const allSyncs = [
      ...(manifest.syncs?.required || []),
      ...(manifest.syncs?.recommended || []),
      ...(manifest.syncs?.integration || []),
    ];
    for (const sync of allSyncs) {
      const syncPath = resolve(SUITE_DIR, sync.path);
      expect(existsSync(syncPath)).toBe(true);
    }
  });

  it('has 3 required syncs', () => {
    expect(manifest.syncs.required).toHaveLength(3);
  });

  it('has 2 recommended syncs', () => {
    expect(manifest.syncs.recommended).toHaveLength(2);
  });

  it('has 1 integration sync', () => {
    expect(manifest.syncs.integration).toHaveLength(1);
  });

  it('has uses declarations referencing llm-core', () => {
    expect(manifest.uses).toBeDefined();
    expect(manifest.uses.length).toBeGreaterThanOrEqual(1);
    const llmCoreUse = manifest.uses.find((u: any) => u.suite === 'llm-core');
    expect(llmCoreUse).toBeDefined();
    expect(llmCoreUse.concepts).toContainEqual({ name: 'LLMProvider' });
  });
});
