// ============================================================
// Parse Kit Concept & Sync Conformance Tests
//
// Validates that all concept specs, grammar provider specs,
// pattern engine specs, sync definitions, and the kit.yaml
// manifest parse correctly and contain expected structure.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';
import { parse as parseYaml } from 'yaml';

const PARSE_DIR = resolve(__dirname, '../kits/parse');

// ============================================================
// 1. Coordination Concept Specs
// ============================================================

describe('Parse Kit — Coordination Concept Specs', () => {
  const concepts: Array<{
    file: string;
    name: string;
    typeParam: string;
    minActions: number;
    actionNames: string[];
  }> = [
    {
      file: 'syntax-tree.concept',
      name: 'SyntaxTree',
      typeParam: 'T',
      minActions: 5,
      actionNames: ['parse', 'reparse', 'query', 'nodeAt', 'get'],
    },
    {
      file: 'language-grammar.concept',
      name: 'LanguageGrammar',
      typeParam: 'G',
      minActions: 5,
      actionNames: ['register', 'resolve', 'resolveByMime', 'get', 'list'],
    },
    {
      file: 'file-artifact.concept',
      name: 'FileArtifact',
      typeParam: 'F',
      minActions: 5,
      actionNames: ['register', 'setProvenance', 'findByRole', 'findGeneratedFrom', 'get'],
    },
    {
      file: 'definition-unit.concept',
      name: 'DefinitionUnit',
      typeParam: 'D',
      minActions: 4,
      actionNames: ['extract', 'findBySymbol', 'findByPattern', 'diff'],
    },
    {
      file: 'content-digest.concept',
      name: 'ContentDigest',
      typeParam: 'H',
      minActions: 3,
      actionNames: ['compute', 'lookup', 'equivalent'],
    },
    {
      file: 'structural-pattern.concept',
      name: 'StructuralPattern',
      typeParam: 'P',
      minActions: 3,
      actionNames: ['create', 'match', 'matchProject'],
    },
  ];

  for (const c of concepts) {
    describe(c.name, () => {
      const specPath = resolve(PARSE_DIR, c.file);

      it(`spec file exists: ${c.file}`, () => {
        expect(existsSync(specPath)).toBe(true);
      });

      it('parses without error', () => {
        const source = readFileSync(specPath, 'utf-8');
        const ast = parseConceptFile(source);
        expect(ast).toBeTruthy();
        expect(ast.name).toBe(c.name);
      });

      it(`has type parameter ${c.typeParam}`, () => {
        const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
        expect(ast.typeParams).toContain(c.typeParam);
      });

      it(`has at least ${c.minActions} actions`, () => {
        const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
        expect(ast.actions.length).toBeGreaterThanOrEqual(c.minActions);
      });

      it('has expected action names', () => {
        const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
        const names = ast.actions.map((a) => a.name);
        for (const expected of c.actionNames) {
          expect(names).toContain(expected);
        }
      });

      it('has version 1', () => {
        const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
        expect(ast.version).toBe(1);
      });

      it('has state declarations', () => {
        const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
        expect(ast.state.length).toBeGreaterThan(0);
      });
    });
  }
});

// ============================================================
// 2. Grammar Provider Concept Specs
// ============================================================

describe('Parse Kit — Grammar Provider Specs', () => {
  const providers = [
    { file: 'providers/grammars/typescript.concept', name: 'TreeSitterTypeScript' },
    { file: 'providers/grammars/json.concept', name: 'TreeSitterJson' },
    { file: 'providers/grammars/yaml.concept', name: 'TreeSitterYaml' },
    { file: 'providers/grammars/concept-spec.concept', name: 'TreeSitterConceptSpec' },
    { file: 'providers/grammars/sync-spec.concept', name: 'TreeSitterSyncSpec' },
  ];

  for (const p of providers) {
    it(`parses ${p.name} spec`, () => {
      const specPath = resolve(PARSE_DIR, p.file);
      expect(existsSync(specPath)).toBe(true);
      const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
      expect(ast.name).toBe(p.name);
      const actionNames = ast.actions.map((a) => a.name);
      expect(actionNames).toContain('initialize');
    });
  }
});

// ============================================================
// 3. Pattern Engine Provider Specs
// ============================================================

describe('Parse Kit — Pattern Engine Provider Specs', () => {
  it('parses TreeSitterQueryProvider spec', () => {
    const specPath = resolve(PARSE_DIR, 'providers/patterns/tree-sitter-query.concept');
    expect(existsSync(specPath)).toBe(true);
    const ast = parseConceptFile(readFileSync(specPath, 'utf-8'));
    expect(ast.name).toBe('TreeSitterQueryProvider');
  });
});

// ============================================================
// 4. Sync Definitions
// ============================================================

describe('Parse Kit — Sync Definitions', () => {
  const syncs = [
    { file: 'syncs/parse-on-change.sync', name: 'ParseOnChangeSync', minSyncs: 1 },
    { file: 'syncs/file-artifact-registration.sync', name: 'FileArtifactRegistrationSync', minSyncs: 1 },
    { file: 'syncs/definition-extraction.sync', name: 'DefinitionExtractionSync', minSyncs: 1 },
    { file: 'syncs/content-digest.sync', name: 'ContentDigestSync', minSyncs: 1 },
  ];

  for (const s of syncs) {
    it(`parses ${s.name}`, () => {
      const syncPath = resolve(PARSE_DIR, s.file);
      expect(existsSync(syncPath)).toBe(true);
      const source = readFileSync(syncPath, 'utf-8');
      const parsed = parseSyncFile(source);
      expect(parsed.length).toBeGreaterThanOrEqual(s.minSyncs);
      expect(parsed[0].name).toBe(s.name);
    });
  }
});

// ============================================================
// 5. Kit Manifest
// ============================================================

describe('Parse Kit — kit.yaml Manifest', () => {
  const kitYamlPath = resolve(PARSE_DIR, 'kit.yaml');

  it('exists and is valid YAML', () => {
    expect(existsSync(kitYamlPath)).toBe(true);
    const content = readFileSync(kitYamlPath, 'utf-8');
    const parsed = parseYaml(content);
    expect(parsed).toBeTruthy();
  });

  it('has correct kit metadata', () => {
    const parsed = parseYaml(readFileSync(kitYamlPath, 'utf-8'));
    expect(parsed.kit.name).toBe('parse');
    expect(parsed.kit.version).toBe('0.1.0');
  });

  it('lists 6 coordination concepts', () => {
    const parsed = parseYaml(readFileSync(kitYamlPath, 'utf-8'));
    const coordConcepts = ['SyntaxTree', 'LanguageGrammar', 'FileArtifact', 'DefinitionUnit', 'ContentDigest', 'StructuralPattern'];
    for (const name of coordConcepts) {
      expect(parsed.concepts[name]).toBeTruthy();
      expect(parsed.concepts[name].spec).toBeTruthy();
      expect(parsed.concepts[name].params).toBeTruthy();
    }
  });

  it('lists grammar providers as optional', () => {
    const parsed = parseYaml(readFileSync(kitYamlPath, 'utf-8'));
    const providers = ['TreeSitterTypeScript', 'TreeSitterJson', 'TreeSitterYaml', 'TreeSitterConceptSpec', 'TreeSitterSyncSpec'];
    for (const name of providers) {
      expect(parsed.concepts[name]).toBeTruthy();
      expect(parsed.concepts[name].optional).toBe(true);
    }
  });

  it('has required and recommended syncs', () => {
    const parsed = parseYaml(readFileSync(kitYamlPath, 'utf-8'));
    expect(parsed.syncs.required.length).toBe(2);
    expect(parsed.syncs.recommended.length).toBe(2);
  });

  it('declares uses for foundation, generation, infrastructure kits', () => {
    const parsed = parseYaml(readFileSync(kitYamlPath, 'utf-8'));
    const kitNames = parsed.uses.map((u: { kit: string }) => u.kit);
    expect(kitNames).toContain('foundation');
    expect(kitNames).toContain('generation');
    expect(kitNames).toContain('infrastructure');
  });
});
