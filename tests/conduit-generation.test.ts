// Conduit Code Generation — All Language Targets Test
// Validates that all 4 code generators produce correct output
// for all 10 Conduit app concepts.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler.js';
import { swiftGenHandler } from '../handlers/ts/framework/swift-gen.handler.js';
import { solidityGenHandler } from '../handlers/ts/framework/solidity-gen.handler.js';
import type { ConceptManifest, ConceptHandler } from '../runtime/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs', 'app');
const REPERTOIRE_DIR = resolve(__dirname, '..', 'repertoire');

const RELOCATED_APP_SPECS: Record<string, string> = {
  tag: resolve(REPERTOIRE_DIR, 'concepts', 'classification', 'tag.concept'),
  comment: resolve(REPERTOIRE_DIR, 'concepts', 'content', 'comment.concept'),
};

const CONCEPTS = [
  'echo', 'user', 'password', 'jwt', 'article',
  'profile', 'comment', 'follow', 'favorite', 'tag',
];

const GENERATORS: { name: string; handler: ConceptHandler; minFiles: number }[] = [
  { name: 'TypeScript', handler: typescriptGenHandler, minFiles: 3 },
  { name: 'Rust', handler: rustGenHandler, minFiles: 3 },
  { name: 'Swift', handler: swiftGenHandler, minFiles: 3 },
  { name: 'Solidity', handler: solidityGenHandler, minFiles: 1 },
];

describe('Conduit Code Generation — All Targets × All Concepts', () => {
  const manifests: Record<string, ConceptManifest> = {};

  beforeAll(async () => {
    for (const name of CONCEPTS) {
      const specPath = RELOCATED_APP_SPECS[name] ?? resolve(SPECS_DIR, `${name}.concept`);
      const source = readFileSync(specPath, 'utf-8');
      const ast = parseConceptFile(source);
      const storage = createInMemoryStorage();
      const result = await schemaGenHandler.generate({ spec: name, ast }, storage);
      expect(result.variant).toBe('ok');
      manifests[name] = result.manifest as ConceptManifest;
    }
  });

  it('SchemaGen produces valid manifests for all 10 concepts', () => {
    for (const name of CONCEPTS) {
      const m = manifests[name];
      expect(m.name, `${name} should have a name`).toBeTruthy();
      expect(m.uri, `${name} should have a URI`).toContain('urn:clef/');
      expect(m.actions.length, `${name} should have actions`).toBeGreaterThanOrEqual(1);
      expect(m.jsonSchemas, `${name} should have JSON schemas`).toBeDefined();
      expect(m.graphqlSchema, `${name} should have GraphQL schema`).toBeTruthy();
    }
  });

  // Matrix: 10 concepts × 4 generators = 40 test cases
  for (const concept of CONCEPTS) {
    for (const gen of GENERATORS) {
      it(`${gen.name} generates valid output for ${concept}`, async () => {
        const storage = createInMemoryStorage();
        const result = await gen.handler.generate(
          { spec: `conduit-${concept}`, manifest: manifests[concept] },
          storage,
        );

        expect(result.variant).toBe('ok');
        const files = result.files as { path: string; content: string }[];
        expect(files.length).toBeGreaterThanOrEqual(gen.minFiles);

        for (const f of files) {
          expect(f.path, 'File should have a path').toBeTruthy();
          expect(f.content.length, `${f.path} should have content`).toBeGreaterThan(0);
        }
      });
    }
  }

  it('TypeScript generates conformance tests for concepts with invariants', async () => {
    const withInvariants = CONCEPTS.filter(n => manifests[n].invariants.length > 0);
    expect(withInvariants.length).toBeGreaterThanOrEqual(1);

    for (const name of withInvariants) {
      const storage = createInMemoryStorage();
      const result = await typescriptGenHandler.generate(
        { spec: `conf-${name}`, manifest: manifests[name] },
        storage,
      );
      const files = result.files as { path: string; content: string }[];
      const hasConformance = files.some(f => f.path.includes('conformance'));
      expect(hasConformance, `${name} should have conformance test`).toBe(true);
    }
  });

  it('all generators produce non-empty output for all 10 concepts', async () => {
    let totalFiles = 0;
    for (const concept of CONCEPTS) {
      for (const gen of GENERATORS) {
        const storage = createInMemoryStorage();
        const result = await gen.handler.generate(
          { spec: concept, manifest: manifests[concept] },
          storage,
        );
        totalFiles += (result.files as unknown[]).length;
      }
    }
    // 10 concepts × 4 generators × ~3-4 files each
    expect(totalFiles).toBeGreaterThanOrEqual(100);
  });
});
