import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

const ROOT = resolve(__dirname, '..');
const SPEC_PATH = resolve(ROOT, 'specs/surface/theme-realizer.concept');
const SUITE_PATH = resolve(ROOT, 'specs/surface/suite.yaml');

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'theme-realizer-test', ast }, storage);
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

describe('ThemeRealizer concept', () => {
  it('is registered in the surface suite manifest', () => {
    const suite = readFileSync(SUITE_PATH, 'utf-8');
    expect(suite).toContain('ThemeRealizer:');
    expect(suite).toContain('specs/surface/theme-realizer.concept');
  });

  it('parses as a valid concept AST with the expected actions', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('ThemeRealizer');
    expect(ast.typeParams).toEqual(['R']);
    expect(ast.actions.map((a) => a.name)).toEqual(['register', 'realize', 'get', 'listTargets']);
  });

  it('produces a manifest with realizer registry fields and action schemas', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    expect(manifest.name).toBe('ThemeRealizer');
    expect(manifest.typeParams[0].name).toBe('R');
    expect(manifest.actions.map((a) => a.name)).toEqual(['register', 'realize', 'get', 'listTargets']);

    const entries = manifest.relations.find((r) => r.name === 'entries');
    expect(entries?.fields.some((f) => f.name === 'target')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'outputKinds')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'contractSupport')).toBe(true);
    expect(entries?.fields.some((f) => f.name === 'capabilities')).toBe(true);

    expect(manifest.jsonSchemas.invocations.register).toBeDefined();
    expect(manifest.jsonSchemas.invocations.realize).toBeDefined();
    expect(manifest.jsonSchemas.completions.realize.ok).toBeDefined();
  });
});
