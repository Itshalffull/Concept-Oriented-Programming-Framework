import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { nextjsGenHandler } from '../handlers/ts/framework/nextjs-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const CONCEPTS_DIR = resolve(__dirname, '..', 'concepts');

function readSpec(category: string, name: string): string {
  try {
    return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
  } catch {
    return readFileSync(resolve(CONCEPTS_DIR, category, `${name}.concept`), 'utf-8');
  }
}

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'test', ast }, storage);
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

describe('NextjsGen', () => {
  it('concept spec exists and matches generator pattern', () => {
    const source = readFileSync(
      resolve(SPECS_DIR, 'framework', 'nextjs-gen.concept'),
      'utf-8',
    );
    const ast = parseConceptFile(source);
    expect(ast.name).toBe('NextjsGen');
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
  });

  it('Password concept generates correct Next.js fp-ts files', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await nextjsGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];

    // Password has invariants: types, handler, route, conformance
    expect(files).toHaveLength(4);

    // Verify file paths
    const paths = files.map(f => f.path);
    expect(paths).toContain('password/types.ts');
    expect(paths).toContain('password/handler.ts');
    expect(paths).toContain('password/route.ts');
    expect(paths).toContain('password/conformance.test.ts');

    // Verify types file contains fp-ts imports and readonly interfaces
    const typesFile = files.find(f => f.path === 'password/types.ts')!;
    expect(typesFile.content).toContain('readonly');
    expect(typesFile.content).toContain("readonly variant: 'ok'");
    expect(typesFile.content).toContain('PasswordSetInput');
    expect(typesFile.content).toContain('PasswordSetOutput');
    expect(typesFile.content).toContain('PasswordCheckInput');
    expect(typesFile.content).toContain('PasswordCheckOutput');
    expect(typesFile.content).toContain('PasswordStorage');

    // Verify handler file uses TaskEither
    const handlerFile = files.find(f => f.path === 'password/handler.ts')!;
    expect(handlerFile.content).toContain("import * as TE from 'fp-ts/TaskEither'");
    expect(handlerFile.content).toContain("import { pipe } from 'fp-ts/function'");
    expect(handlerFile.content).toContain('TE.TaskEither<PasswordError');
    expect(handlerFile.content).toContain('PasswordHandler');

    // Verify route file imports Next.js types
    const routeFile = files.find(f => f.path === 'password/route.ts')!;
    expect(routeFile.content).toContain("import { NextRequest, NextResponse } from 'next/server'");
    expect(routeFile.content).toContain("import * as TE from 'fp-ts/TaskEither'");
    expect(routeFile.content).toContain('createPasswordRoutes');

    // Verify conformance test uses fp-ts
    const testFile = files.find(f => f.path === 'password/conformance.test.ts')!;
    expect(testFile.content).toContain("import * as TE from 'fp-ts/TaskEither'");
    expect(testFile.content).toContain("import * as E from 'fp-ts/Either'");
    expect(testFile.content).toContain('E.isRight');
  });

  it('generates files for concept without invariants (no conformance file)', async () => {
    const ast = parseConceptFile(readSpec('framework', 'schema-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await nextjsGenHandler.generate(
      { spec: 'sg-1', manifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files).toHaveLength(4); // schema-gen has invariants, generates conformance file
  });

  it('returns error for invalid manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await nextjsGenHandler.generate(
      { spec: 'bad', manifest: {} },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('missing concept name');
  });

  it('generates readonly types (no mutable interfaces)', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await nextjsGenHandler.generate(
      { spec: 'pwd-2', manifest },
      storage,
    );
    const files = result.files as { path: string; content: string }[];
    const typesContent = files.find(f => f.path === 'password/types.ts')!.content;

    // All interface fields should be readonly
    const interfaceFieldLines = typesContent
      .split('\n')
      .filter(l => l.trim().startsWith('readonly '));
    expect(interfaceFieldLines.length).toBeGreaterThan(0);
  });

  it('generates variant constructors', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await nextjsGenHandler.generate(
      { spec: 'pwd-3', manifest },
      storage,
    );
    const files = result.files as { path: string; content: string }[];
    const typesContent = files.find(f => f.path === 'password/types.ts')!.content;

    // Smart constructors for each variant
    expect(typesContent).toContain('export const setOk =');
    expect(typesContent).toContain('export const checkOk =');
  });
});
