// ============================================================
// LLM Kits v2 Cross-Suite Structural Validation Tests
//
// Tests:
// 1. All 7 suite directories and manifests exist
// 2. All concept files parse to valid ASTs
// 3. All sync files parse to valid CompiledSync arrays
// 4. Suite manifest file references are valid
// 5. @gate annotations on correct concepts
// 6. File counts match specification
// 7. Version consistency across all concepts
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const REPERTOIRE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts');

const SUITES = [
  'llm-core',
  'llm-conversation',
  'llm-prompt',
  'llm-agent',
  'llm-rag',
  'llm-safety',
  'llm-training',
];

const GATE_CONCEPTS = [
  'AgentLoop',
  'StateGraph',
  'AgentTeam',
  'Consensus',
  'TrainingRun',
];

function collectFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (entry.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ============================================================
// 1. Suite Inventory
// ============================================================

describe('Suite Inventory', () => {
  it.each(SUITES)('%s directory exists', (suite) => {
    expect(existsSync(resolve(REPERTOIRE_DIR, suite))).toBe(true);
  });

  it.each(SUITES)('%s has a suite.yaml', (suite) => {
    expect(existsSync(resolve(REPERTOIRE_DIR, suite, 'suite.yaml'))).toBe(true);
  });
});

// ============================================================
// 2. All Concept Files Parse
// ============================================================

describe('All concept files parse', () => {
  const allConceptFiles: string[] = [];
  for (const suite of SUITES) {
    allConceptFiles.push(...collectFiles(resolve(REPERTOIRE_DIR, suite), '.concept'));
  }

  it('discovered concept files', () => {
    expect(allConceptFiles.length).toBeGreaterThanOrEqual(33);
  });

  it.each(
    allConceptFiles.map(f => [f.replace(/^.*repertoire[\\/]concepts[\\/]/, ''), f])
  )('%s parses without error', (_label, filePath) => {
    const source = readFileSync(filePath as string, 'utf-8');
    const ast = parseConceptFile(source);
    expect(ast).toBeDefined();
    expect(ast.name).toBeTruthy();
    expect(ast.typeParams.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 3. All Sync Files Parse
// ============================================================

describe('All sync files parse', () => {
  const allSyncFiles: string[] = [];
  for (const suite of SUITES) {
    const syncsDir = resolve(REPERTOIRE_DIR, suite, 'syncs');
    allSyncFiles.push(...collectFiles(syncsDir, '.sync'));
  }

  it('discovered sync files', () => {
    expect(allSyncFiles.length).toBeGreaterThanOrEqual(57);
  });

  it.each(
    allSyncFiles.map(f => [f.replace(/^.*repertoire[\\/]concepts[\\/]/, ''), f])
  )('%s parses without error', (_label, filePath) => {
    const source = readFileSync(filePath as string, 'utf-8');
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
    expect(syncs[0].name).toBeTruthy();
  });
});

// ============================================================
// 4. Suite Manifest File References
// ============================================================

describe('Suite manifest file references', () => {
  it.each(SUITES)('%s concept specs exist on disk', (suite) => {
    const suiteDir = resolve(REPERTOIRE_DIR, suite);
    const source = readFileSync(resolve(suiteDir, 'suite.yaml'), 'utf-8');
    const manifest = parseYaml(source) as any;

    for (const [, value] of Object.entries(manifest.concepts || {})) {
      const specPath = resolve(suiteDir, (value as any).spec);
      expect(existsSync(specPath)).toBe(true);
    }
  });

  it.each(SUITES)('%s sync files exist on disk', (suite) => {
    const suiteDir = resolve(REPERTOIRE_DIR, suite);
    const source = readFileSync(resolve(suiteDir, 'suite.yaml'), 'utf-8');
    const manifest = parseYaml(source) as any;

    const allSyncs = [
      ...(manifest.syncs?.required || []),
      ...(manifest.syncs?.recommended || []),
      ...(manifest.syncs?.integration || []),
      ...(manifest.syncs?.eventual || []),
    ];
    for (const sync of allSyncs) {
      const syncPath = resolve(suiteDir, sync.path);
      expect(existsSync(syncPath)).toBe(true);
    }
  });
});

// ============================================================
// 5. @gate Annotation Consistency
// ============================================================

describe('@gate annotation consistency', () => {
  const allConceptFiles: string[] = [];
  for (const suite of SUITES) {
    allConceptFiles.push(...collectFiles(resolve(REPERTOIRE_DIR, suite), '.concept'));
  }

  it.each(GATE_CONCEPTS)('%s has @gate annotation', (conceptName) => {
    const file = allConceptFiles.find(f => {
      const source = readFileSync(f, 'utf-8');
      const ast = parseConceptFile(source);
      return ast.name === conceptName;
    });
    expect(file).toBeDefined();
    const source = readFileSync(file!, 'utf-8');
    const ast = parseConceptFile(source);
    expect(ast.annotations?.gate).toBe(true);
  });

  it('non-gate concepts do not have @gate', () => {
    for (const file of allConceptFiles) {
      const source = readFileSync(file, 'utf-8');
      const ast = parseConceptFile(source);
      if (!GATE_CONCEPTS.includes(ast.name)) {
        expect(ast.annotations?.gate).toBeFalsy();
      }
    }
  });
});

// ============================================================
// 6. File Counts
// ============================================================

describe('File counts', () => {
  it('has 7 suite manifests', () => {
    let count = 0;
    for (const suite of SUITES) {
      if (existsSync(resolve(REPERTOIRE_DIR, suite, 'suite.yaml'))) count++;
    }
    expect(count).toBe(7);
  });

  it('has at least 33 concept files', () => {
    const allConceptFiles: string[] = [];
    for (const suite of SUITES) {
      allConceptFiles.push(...collectFiles(resolve(REPERTOIRE_DIR, suite), '.concept'));
    }
    expect(allConceptFiles.length).toBeGreaterThanOrEqual(33);
  });

  it('has at least 57 sync files', () => {
    const allSyncFiles: string[] = [];
    for (const suite of SUITES) {
      const syncsDir = resolve(REPERTOIRE_DIR, suite, 'syncs');
      allSyncFiles.push(...collectFiles(syncsDir, '.sync'));
    }
    expect(allSyncFiles.length).toBeGreaterThanOrEqual(57);
  });
});

// ============================================================
// 7. Version Consistency
// ============================================================

describe('Version consistency', () => {
  const allConceptFiles: string[] = [];
  for (const suite of SUITES) {
    allConceptFiles.push(...collectFiles(resolve(REPERTOIRE_DIR, suite), '.concept'));
  }

  it.each(
    allConceptFiles.map(f => [f.replace(/^.*repertoire[\\/]concepts[\\/]/, ''), f])
  )('%s has @version(1)', (_label, filePath) => {
    const source = readFileSync(filePath as string, 'utf-8');
    const ast = parseConceptFile(source);
    expect(ast.version).toBe(1);
  });
});
