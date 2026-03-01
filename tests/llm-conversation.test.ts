// ============================================================
// LLM Conversation Suite Tests
//
// Tests:
// 1. Conversation concept parsing and structural validation
// 2. Multiversal branching state structure
// 3. All 10 actions with return variants
// 4. Sync file parsing
// 5. suite.yaml validation
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-conversation');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// 1. Conversation Concept
// ============================================================

describe('Conversation concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('conversation');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('Conversation');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter C', () => {
    expect(ast.typeParams).toEqual(['C']);
  });

  it('has a purpose block referencing branching dialogue', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('branch');
  });

  it('declares 10 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'append', 'fork', 'switchBranch', 'merge',
      'prune', 'getContextWindow', 'summarize', 'getLineage', 'serialize',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const action = ast.actions.find(a => a.name === 'create')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('fork action has ok and notfound variants', () => {
    const action = ast.actions.find(a => a.name === 'fork')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('merge action has ok and conflict variants', () => {
    const action = ast.actions.find(a => a.name === 'merge')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('conflict');
  });

  it('getContextWindow has ok and empty variants', () => {
    const action = ast.actions.find(a => a.name === 'getContextWindow')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('has branching state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('conversations');
    expect(stateNames).toContain('messages');
    expect(stateNames).toContain('branches');
    expect(stateNames).toContain('active_branch');
    expect(stateNames).toContain('context_strategy');
    expect(stateNames).toContain('summary');
    expect(stateNames).toContain('token_count');
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
// 2. Sync File Parsing
// ============================================================

describe('llm-conversation sync files', () => {
  const syncFiles = [
    'conversation-counts-tokens',
    'conversation-auto-summarize',
    'conversation-collection-provider',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 3. Suite Manifest
// ============================================================

describe('llm-conversation suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-conversation');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists Conversation concept', () => {
    expect(manifest.concepts.Conversation).toBeDefined();
    expect(manifest.concepts.Conversation.spec).toBe('./conversation.concept');
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
});
