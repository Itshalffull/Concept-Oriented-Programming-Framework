import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

const ROOT = resolve(__dirname, '..');
const SPEC_PATH = resolve(ROOT, 'specs/surface/surface-lens.concept');
const SUITE_PATH = resolve(ROOT, 'specs/surface/suite.yaml');

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'surface-lens-test', ast }, storage);
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

describe('SurfaceLens concept', () => {
  it('is registered in the surface suite manifest', () => {
    const suite = readFileSync(SUITE_PATH, 'utf-8');
    expect(suite).toContain('SurfaceLens:');
    expect(suite).toContain('specs/surface/surface-lens.concept');
  });

  it('parses as a valid concept AST with the expected actions', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('SurfaceLens');
    expect(ast.typeParams).toEqual(['L']);
    expect(ast.actions.map((a) => a.name)).toEqual(['bind', 'get', 'list', 'resolve']);
  });

  it('produces a manifest with lens registry fields and action schemas', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    expect(manifest.name).toBe('SurfaceLens');
    expect(manifest.typeParams[0].name).toBe('L');
    expect(manifest.actions.map((a) => a.name)).toEqual(['bind', 'get', 'list', 'resolve']);

    const entries = manifest.relations.find((r) => r.name === 'entries');
    expect(entries?.fields.some((f) => f.name === 'sourceType')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'selectorRole')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'selectorAncestry')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'selectorTags')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'precedence')).toBe(true);

    expect(manifest.jsonSchemas.invocations.bind).toBeDefined();
    expect(manifest.jsonSchemas.completions.bind.ok).toBeDefined();
    expect(manifest.jsonSchemas.completions.get.notfound).toBeDefined();
  });

  it('models sourceType as an enum and persists structured render-node selector fields', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const bindAction = manifest.actions.find((a) => a.name === 'bind');
    const sourceTypeParam = bindAction?.params.find((p) => p.name === 'sourceType');
    expect(sourceTypeParam?.type).toEqual({
      kind: 'primitive',
      primitive: 'String',
    });

    const entries = manifest.relations.find((r) => r.name === 'entries');
    expect(entries?.fields.some((f) => f.name === 'selectorWidget')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'selectorBinding')).toBe(true);
  });
});
