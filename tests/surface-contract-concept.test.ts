import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

const ROOT = resolve(__dirname, '..');
const SPEC_PATH = resolve(ROOT, 'specs/surface/surface-contract.concept');
const SUITE_PATH = resolve(ROOT, 'specs/surface/suite.yaml');

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'surface-contract-test', ast }, storage);
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

describe('SurfaceContract concept', () => {
  it('is registered in the surface suite manifest', () => {
    const suite = readFileSync(SUITE_PATH, 'utf-8');
    expect(suite).toContain('SurfaceContract:');
    expect(suite).toContain('specs/surface/surface-contract.concept');
  });

  it('parses as a valid concept AST with the expected actions', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('SurfaceContract');
    expect(ast.typeParams.map((p) => p)).toEqual(['C']);
    expect(ast.actions.map((a) => a.name)).toEqual(['define', 'get', 'list']);
  });

  it('produces a manifest with contract registry fields and action schemas', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    expect(manifest.name).toBe('SurfaceContract');
    expect(manifest.typeParams[0].name).toBe('C');
    expect(manifest.actions.map((a) => a.name)).toEqual(['define', 'get', 'list']);

    const relationNames = manifest.relations.map((r) => r.name);
    expect(relationNames).toContain('contracts');
    expect(relationNames).toContain('entries');

    const entries = manifest.relations.find((r) => r.name === 'entries');
    expect(entries?.fields.some((f) => f.name === 'role')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'resources')).toBe(true);

    expect(manifest.jsonSchemas.invocations.define).toBeDefined();
    expect(manifest.jsonSchemas.completions.define.ok).toBeDefined();
    expect(manifest.jsonSchemas.completions.get.notfound).toBeDefined();
  });
});
