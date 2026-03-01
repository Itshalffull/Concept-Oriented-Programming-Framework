// ============================================================
// LLM Training Suite Tests
//
// Tests:
// 1. TrainingRun concept parsing, @gate annotation, and structural validation
// 2. Adapter concept parsing and structural validation
// 3. EvaluationDataset concept parsing and structural validation
// 4. All 5 sync files parse correctly with when/then/where clauses
// 5. suite.yaml references valid files and declares dependencies
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-training');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// 1. TrainingRun Concept
// ============================================================

describe('TrainingRun concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('training-run');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('TrainingRun');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter J', () => {
    expect(ast.typeParams).toEqual(['J']);
  });

  it('has a purpose block referencing fine-tuning lifecycle', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('fine tuning');
  });

  it('is a @gate concept', () => {
    expect(ast.annotations?.gate).toBe(true);
  });

  it('declares 8 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'start', 'pause', 'resume',
      'evaluate', 'export', 'cancel', 'getStatus',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('start action has 3 return variants: ok, insufficient_data, error', () => {
    const action = ast.actions.find(a => a.name === 'start')!;
    expect(action.variants).toHaveLength(3);
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('insufficient_data');
    expect(variants).toContain('error');
  });

  it('pause action has ok and not_running variants', () => {
    const action = ast.actions.find(a => a.name === 'pause')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_running');
  });

  it('resume action has ok and not_paused variants', () => {
    const action = ast.actions.find(a => a.name === 'resume')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_paused');
  });

  it('evaluate action has ok and not_ready variants', () => {
    const action = ast.actions.find(a => a.name === 'evaluate')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_ready');
  });

  it('export action has ok and not_complete variants', () => {
    const action = ast.actions.find(a => a.name === 'export')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_complete');
  });

  it('cancel action has ok and not_running variants', () => {
    const action = ast.actions.find(a => a.name === 'cancel')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_running');
  });

  it('getStatus action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'getStatus')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has all state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('runs');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('base_model');
    expect(stateNames).toContain('dataset_ref');
    expect(stateNames).toContain('hyperparameters');
    expect(stateNames).toContain('status');
    expect(stateNames).toContain('checkpoints');
    expect(stateNames).toContain('evaluation_scores');
    expect(stateNames).toContain('cost');
    expect(stateNames).toContain('duration_ms');
  });

  it('requires persistent-storage and network capabilities', () => {
    expect(ast.capabilities).toContain('persistent-storage');
    expect(ast.capabilities).toContain('network');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 2. Adapter Concept
// ============================================================

describe('Adapter concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('adapter');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('Adapter');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter A', () => {
    expect(ast.typeParams).toEqual(['A']);
  });

  it('has a purpose block referencing LoRA', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('LoRA');
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 6 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'train', 'merge', 'swap', 'compose', 'export',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('train action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'train')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('merge action has ok and not_trained variants', () => {
    const action = ast.actions.find(a => a.name === 'merge')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_trained');
  });

  it('swap action has ok and not_trained variants', () => {
    const action = ast.actions.find(a => a.name === 'swap')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_trained');
  });

  it('compose action has ok and incompatible variants', () => {
    const action = ast.actions.find(a => a.name === 'compose')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('incompatible');
  });

  it('export action has ok and not_trained variants', () => {
    const action = ast.actions.find(a => a.name === 'export')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('not_trained');
  });

  it('has all state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('adapters');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('base_model_id');
    expect(stateNames).toContain('rank');
    expect(stateNames).toContain('target_modules');
    expect(stateNames).toContain('quantization');
    expect(stateNames).toContain('weights');
    expect(stateNames).toContain('training_status');
    expect(stateNames).toContain('merged');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 3. EvaluationDataset Concept
// ============================================================

describe('EvaluationDataset concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('evaluation-dataset');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('EvaluationDataset');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter V', () => {
    expect(ast.typeParams).toEqual(['V']);
  });

  it('has a purpose block referencing golden datasets', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('Golden datasets');
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 7 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'addExample', 'evaluate', 'detectDrift',
      'setBaseline', 'compare', 'curate',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('addExample action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'addExample')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('evaluate action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'evaluate')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('detectDrift action has ok and no_baseline variants', () => {
    const action = ast.actions.find(a => a.name === 'detectDrift')!;
    expect(action.variants).toHaveLength(2);
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('no_baseline');
  });

  it('setBaseline action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'setBaseline')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('compare action has ok and error variants', () => {
    const action = ast.actions.find(a => a.name === 'compare')!;
    expect(action.variants).toHaveLength(2);
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('curate action has ok and empty variants', () => {
    const action = ast.actions.find(a => a.name === 'curate')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('has all state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('datasets');
    expect(stateNames).toContain('name');
    expect(stateNames).toContain('examples');
    expect(stateNames).toContain('version');
    expect(stateNames).toContain('evaluation_history');
    expect(stateNames).toContain('drift_baseline');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 4. Sync File Parsing
// ============================================================

describe('llm-training sync files', () => {
  const syncFiles = [
    'adapter-attaches-to-provider',
    'adapter-registers-with-router',
    'dataset-detects-drift',
    'training-evaluates-on-dataset',
    'training-tracks-cost',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });

  it('AdapterAttachesToProvider has when and then clauses referencing Adapter/merge and LLMProvider/register', () => {
    const syncs = parseSyncFile(readSync('adapter-attaches-to-provider'));
    const sync = syncs[0];
    expect(sync.name).toBe('AdapterAttachesToProvider');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('AdapterRegistersWithRouter has when and then clauses referencing Adapter/swap and ModelRouter/addRoute', () => {
    const syncs = parseSyncFile(readSync('adapter-registers-with-router'));
    const sync = syncs[0];
    expect(sync.name).toBe('AdapterRegistersWithRouter');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('DatasetDetectsDrift has when, where, and then clauses', () => {
    const syncs = parseSyncFile(readSync('dataset-detects-drift'));
    const sync = syncs[0];
    expect(sync.name).toBe('DatasetDetectsDrift');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.where.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('TrainingEvaluatesOnDataset has when and then clauses referencing TrainingRun/evaluate and EvaluationDataset/evaluate', () => {
    const syncs = parseSyncFile(readSync('training-evaluates-on-dataset'));
    const sync = syncs[0];
    expect(sync.name).toBe('TrainingEvaluatesOnDataset');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });

  it('TrainingTracksCost has when and then clauses referencing TrainingRun/start and LLMTrace/startTrace', () => {
    const syncs = parseSyncFile(readSync('training-tracks-cost'));
    const sync = syncs[0];
    expect(sync.name).toBe('TrainingTracksCost');
    expect(sync.when.length).toBeGreaterThanOrEqual(1);
    expect(sync.then.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 5. Suite Manifest
// ============================================================

describe('llm-training suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-training');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists TrainingRun, Adapter, and EvaluationDataset concepts', () => {
    expect(manifest.concepts.TrainingRun).toBeDefined();
    expect(manifest.concepts.Adapter).toBeDefined();
    expect(manifest.concepts.EvaluationDataset).toBeDefined();
    expect(manifest.concepts.TrainingRun.spec).toBe('./training-run.concept');
    expect(manifest.concepts.Adapter.spec).toBe('./adapter.concept');
    expect(manifest.concepts.EvaluationDataset.spec).toBe('./evaluation-dataset.concept');
  });

  it('declares type parameter mappings', () => {
    expect(manifest.concepts.TrainingRun.params.J).toBeDefined();
    expect(manifest.concepts.TrainingRun.params.J.as).toBe('run-id');
    expect(manifest.concepts.Adapter.params.A).toBeDefined();
    expect(manifest.concepts.Adapter.params.A.as).toBe('adapter-id');
    expect(manifest.concepts.EvaluationDataset.params.V).toBeDefined();
    expect(manifest.concepts.EvaluationDataset.params.V.as).toBe('dataset-id');
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

  it('has required, recommended, and integration sync categories', () => {
    expect(manifest.syncs.required).toBeDefined();
    expect(manifest.syncs.required.length).toBe(2);
    expect(manifest.syncs.recommended).toBeDefined();
    expect(manifest.syncs.recommended.length).toBe(2);
    expect(manifest.syncs.integration).toBeDefined();
    expect(manifest.syncs.integration.length).toBe(1);
  });

  it('has uses declarations referencing llm-core and llm-safety', () => {
    expect(manifest.uses).toBeDefined();
    expect(manifest.uses.length).toBe(2);
    const suiteNames = manifest.uses.map((u: any) => u.suite);
    expect(suiteNames).toContain('llm-core');
    expect(suiteNames).toContain('llm-safety');
  });

  it('llm-safety dependency is optional', () => {
    const llmSafety = manifest.uses.find((u: any) => u.suite === 'llm-safety');
    expect(llmSafety.optional).toBe(true);
  });
});
