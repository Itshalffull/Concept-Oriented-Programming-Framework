// ============================================================
// Interface Kit Handler Tests
//
// Tests for the 5 orchestration concept handler implementations:
// Projection, Generator, Emitter, Surface, Middleware.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { projectionHandler } from '../implementations/typescript/framework/projection.impl.js';
import { interfaceGeneratorHandler } from '../implementations/typescript/framework/interface-generator.impl.js';
import { emitterHandler } from '../implementations/typescript/framework/emitter.impl.js';
import { surfaceHandler } from '../implementations/typescript/framework/surface.impl.js';
import { middlewareHandler } from '../implementations/typescript/framework/middleware.impl.js';

// ============================================================
// Projection Handler
// ============================================================

describe('Projection Handler', () => {
  it('projects a valid manifest with annotations', async () => {
    const storage = createInMemoryStorage();
    const manifest = JSON.stringify({
      uri: 'urn:copf/Todo',
      name: 'Todo',
      actions: [
        { name: 'create', params: [{ name: 'title', type: { kind: 'primitive', primitive: 'String' } }], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'get', params: [{ name: 'id', type: { kind: 'primitive', primitive: 'String' } }], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'list', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'delete', params: [{ name: 'id', type: { kind: 'primitive', primitive: 'String' } }], variants: [{ tag: 'ok', fields: [] }] },
      ],
      relations: [{ name: 'entries', source: 'merged', keyField: { name: 't', paramRef: 'T' }, fields: [] }],
      typeParams: [{ name: 'T', wireType: 'string' }],
      purpose: 'Manage todo items',
    });
    const annotations = JSON.stringify({
      traits: ['auth'],
      resource: { path: '/todos', idField: 'id' },
    });

    const result = await projectionHandler.project({ manifest, annotations }, storage);
    expect(result.variant).toBe('ok');
    expect(result.projection).toBeDefined();
    expect(typeof result.actions).toBe('number');
    expect(typeof result.traits).toBe('number');
  });

  it('returns annotationError for invalid annotations JSON', async () => {
    const storage = createInMemoryStorage();
    const manifest = JSON.stringify({ name: 'Bad', actions: [], relations: [], typeParams: [], purpose: '' });

    const result = await projectionHandler.project({ manifest, annotations: 'not-json{' }, storage);
    expect(result.variant).toBe('annotationError');
  });

  it('returns error for invalid manifest JSON', async () => {
    const storage = createInMemoryStorage();
    const result = await projectionHandler.project({ manifest: '{broken', annotations: '{}' }, storage);
    expect(['annotationError', 'error']).toContain(result.variant);
  });

  it('infers resources from action names', async () => {
    const storage = createInMemoryStorage();
    // First project to create a projection
    const manifest = JSON.stringify({
      uri: 'urn:copf/Article',
      name: 'Article',
      actions: [
        { name: 'create', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'get', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'update', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'delete', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'list', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'publish', params: [], variants: [{ tag: 'ok', fields: [] }] },
      ],
      relations: [],
      typeParams: [{ name: 'A', wireType: 'string' }],
      purpose: 'Articles',
    });
    const projectResult = await projectionHandler.project({ manifest, annotations: '{}' }, storage);
    expect(projectResult.variant).toBe('ok');

    const result = await projectionHandler.inferResources({ projection: projectResult.projection }, storage);
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.resources)).toBe(true);
    const resources = result.resources as string[];
    expect(resources.length).toBeGreaterThan(0);
  });

  it('validates a projection', async () => {
    const storage = createInMemoryStorage();
    const manifest = JSON.stringify({
      uri: 'urn:copf/Simple',
      name: 'Simple',
      actions: [{ name: 'do', params: [], variants: [{ tag: 'ok', fields: [] }] }],
      relations: [],
      typeParams: [],
      purpose: 'Simple concept',
    });
    const projectResult = await projectionHandler.project({ manifest, annotations: '{}' }, storage);
    expect(projectResult.variant).toBe('ok');

    const result = await projectionHandler.validate({ projection: projectResult.projection }, storage);
    expect(result.variant).toBe('ok');
  });

  it('diffs two projections of the same concept', async () => {
    const storage = createInMemoryStorage();
    const manifest1 = JSON.stringify({
      uri: 'urn:copf/Todo', name: 'Todo',
      actions: [{ name: 'create', params: [], variants: [{ tag: 'ok', fields: [] }] }],
      relations: [], typeParams: [], purpose: 'Manage todos',
    });
    const manifest2 = JSON.stringify({
      uri: 'urn:copf/Todo', name: 'Todo',
      actions: [
        { name: 'create', params: [], variants: [{ tag: 'ok', fields: [] }] },
        { name: 'delete', params: [], variants: [{ tag: 'ok', fields: [] }] },
      ],
      relations: [], typeParams: [], purpose: 'Manage todos',
    });

    const r1 = await projectionHandler.project({ manifest: manifest1, annotations: '{}' }, storage);
    const r2 = await projectionHandler.project({ manifest: manifest2, annotations: '{}' }, storage);
    expect(r1.variant).toBe('ok');
    expect(r2.variant).toBe('ok');

    const diff = await projectionHandler.diff({ projection: r2.projection, previous: r1.projection }, storage);
    expect(diff.variant).toBe('ok');
  });
});

// ============================================================
// Generator Handler
// ============================================================

describe('Generator Handler', () => {
  it('creates a plan from a valid interface manifest', async () => {
    const storage = createInMemoryStorage();
    const interfaceManifest = JSON.stringify({
      kit: 'test-kit',
      targets: ['rest', 'graphql'],
      concepts: ['Todo', 'User'],
      sdkLanguages: ['typescript'],
      specFormats: ['openapi'],
      outputDir: 'generated',
    });

    const result = await interfaceGeneratorHandler.plan({ kit: 'test-kit', interfaceManifest }, storage);
    expect(result.variant).toBe('ok');
    expect(result.plan).toBeDefined();
    expect(Array.isArray(result.targets)).toBe(true);
    expect(Array.isArray(result.concepts)).toBe(true);
    expect(typeof result.estimatedFiles).toBe('number');
  });

  it('returns noTargetsConfigured when no targets', async () => {
    const storage = createInMemoryStorage();
    const interfaceManifest = JSON.stringify({
      kit: 'empty-kit',
      targets: [],
      concepts: ['Todo'],
      sdkLanguages: [],
      specFormats: [],
    });

    const result = await interfaceGeneratorHandler.plan({ kit: 'empty-kit', interfaceManifest }, storage);
    expect(result.variant).toBe('noTargetsConfigured');
  });

  it('generates from a plan', async () => {
    const storage = createInMemoryStorage();
    const interfaceManifest = JSON.stringify({
      kit: 'test-kit',
      targets: ['rest'],
      concepts: ['Todo'],
      sdkLanguages: [],
      specFormats: [],
      outputDir: 'generated',
    });

    const planResult = await interfaceGeneratorHandler.plan({ kit: 'test-kit', interfaceManifest }, storage);
    expect(planResult.variant).toBe('ok');

    const genResult = await interfaceGeneratorHandler.generate({ plan: planResult.plan }, storage);
    expect(genResult.variant).toBe('ok');
    expect(typeof genResult.filesGenerated).toBe('number');
    expect(typeof genResult.duration).toBe('number');
  });

  it('reports status for a plan', async () => {
    const storage = createInMemoryStorage();
    const interfaceManifest = JSON.stringify({
      kit: 'test-kit',
      targets: ['rest'],
      concepts: ['Todo'],
      sdkLanguages: [],
      specFormats: [],
    });

    const planResult = await interfaceGeneratorHandler.plan({ kit: 'test-kit', interfaceManifest }, storage);
    expect(planResult.variant).toBe('ok');

    const statusResult = await interfaceGeneratorHandler.status({ plan: planResult.plan }, storage);
    expect(statusResult.variant).toBe('ok');
    expect(typeof statusResult.phase).toBe('string');
  });
});

// ============================================================
// Emitter Handler
// ============================================================

describe('Emitter Handler', () => {
  it('writes a file and returns hash', async () => {
    const storage = createInMemoryStorage();
    const result = await emitterHandler.write({
      path: 'out/test.ts',
      content: 'export const x = 1;',
      target: 'rest',
      concept: 'Todo',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.file).toBeDefined();
    expect(typeof result.hash).toBe('string');
    expect(result.written).toBe(true);
  });

  it('skips write when content hash matches', async () => {
    const storage = createInMemoryStorage();
    const content = 'export const unchanged = true;';

    const first = await emitterHandler.write({
      path: 'out/same.ts',
      content,
      target: 'rest',
      concept: 'Todo',
    }, storage);
    expect(first.variant).toBe('ok');
    expect(first.written).toBe(true);

    const second = await emitterHandler.write({
      path: 'out/same.ts',
      content,
      target: 'rest',
      concept: 'Todo',
    }, storage);
    expect(second.variant).toBe('ok');
    expect(second.written).toBe(false);
    expect(second.hash).toBe(first.hash);
  });

  it('writes when content changes', async () => {
    const storage = createInMemoryStorage();

    const first = await emitterHandler.write({
      path: 'out/changing.ts',
      content: 'version 1',
      target: 'rest',
      concept: 'Todo',
    }, storage);
    expect(first.written).toBe(true);

    const second = await emitterHandler.write({
      path: 'out/changing.ts',
      content: 'version 2',
      target: 'rest',
      concept: 'Todo',
    }, storage);
    expect(second.variant).toBe('ok');
    expect(second.written).toBe(true);
    expect(second.hash).not.toBe(first.hash);
  });

  it('formats a file', async () => {
    const storage = createInMemoryStorage();

    const writeResult = await emitterHandler.write({
      path: 'out/fmt.ts',
      content: 'const x=1;',
      target: 'rest',
      concept: 'Todo',
    }, storage);
    expect(writeResult.variant).toBe('ok');

    const fmtResult = await emitterHandler.format({ file: writeResult.file, formatter: 'prettier' }, storage);
    expect(fmtResult.variant).toBe('ok');
  });

  it('cleans orphaned files', async () => {
    const storage = createInMemoryStorage();

    // Write 3 files
    await emitterHandler.write({ path: 'out/keep1.ts', content: 'a', target: 'rest', concept: 'A' }, storage);
    await emitterHandler.write({ path: 'out/keep2.ts', content: 'b', target: 'rest', concept: 'B' }, storage);
    await emitterHandler.write({ path: 'out/orphan.ts', content: 'c', target: 'rest', concept: 'C' }, storage);

    const result = await emitterHandler.clean({
      outputDir: 'out',
      currentFiles: ['out/keep1.ts', 'out/keep2.ts'],
    }, storage);
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.removed)).toBe(true);
  });

  it('returns manifest of generated files', async () => {
    const storage = createInMemoryStorage();

    await emitterHandler.write({ path: 'gen/a.ts', content: 'aaa', target: 'rest', concept: 'A' }, storage);
    await emitterHandler.write({ path: 'gen/b.ts', content: 'bbb', target: 'rest', concept: 'B' }, storage);

    const result = await emitterHandler.manifest({ outputDir: 'gen' }, storage);
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.files)).toBe(true);
    expect(typeof result.totalBytes).toBe('number');
  });
});

// ============================================================
// Surface Handler
// ============================================================

describe('Surface Handler', () => {
  it('composes a REST surface from multiple concept outputs', async () => {
    const storage = createInMemoryStorage();
    const result = await surfaceHandler.compose({
      kit: 'test-kit',
      target: 'rest',
      outputs: ['todo-output', 'user-output'],
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.surface).toBeDefined();
    expect(typeof result.entrypoint).toBe('string');
    expect(result.conceptCount).toBe(2);
  });

  it('composes a GraphQL surface', async () => {
    const storage = createInMemoryStorage();
    const result = await surfaceHandler.compose({
      kit: 'test-kit',
      target: 'graphql',
      outputs: ['todo-schema'],
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.conceptCount).toBe(1);
  });

  it('returns entrypoint content for composed surface', async () => {
    const storage = createInMemoryStorage();
    const composeResult = await surfaceHandler.compose({
      kit: 'test-kit',
      target: 'rest',
      outputs: ['todo-output'],
    }, storage);
    expect(composeResult.variant).toBe('ok');

    const epResult = await surfaceHandler.entrypoint({ surface: composeResult.surface }, storage);
    expect(epResult.variant).toBe('ok');
    expect(typeof epResult.content).toBe('string');
    expect((epResult.content as string).length).toBeGreaterThan(0);
  });
});

// ============================================================
// Middleware Handler
// ============================================================

describe('Middleware Handler', () => {
  it('registers a trait implementation', async () => {
    const storage = createInMemoryStorage();
    const result = await middlewareHandler.register({
      trait: 'auth',
      target: 'rest',
      implementation: 'bearer-check',
      position: 'auth',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.middleware).toBeDefined();
  });

  it('detects duplicate registration', async () => {
    const storage = createInMemoryStorage();

    const first = await middlewareHandler.register({
      trait: 'auth',
      target: 'rest',
      implementation: 'bearer-check',
      position: 'auth',
    }, storage);
    expect(first.variant).toBe('ok');

    const second = await middlewareHandler.register({
      trait: 'auth',
      target: 'rest',
      implementation: 'another-check',
      position: 'auth',
    }, storage);
    expect(second.variant).toBe('duplicateRegistration');
  });

  it('resolves registered traits for a target', async () => {
    const storage = createInMemoryStorage();

    await middlewareHandler.register({
      trait: 'auth',
      target: 'rest',
      implementation: 'bearer-check',
      position: 'auth',
    }, storage);

    await middlewareHandler.register({
      trait: 'validation',
      target: 'rest',
      implementation: 'zod-validator',
      position: 'validation',
    }, storage);

    const result = await middlewareHandler.resolve({
      traits: ['auth', 'validation'],
      target: 'rest',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.middlewares)).toBe(true);
    const mws = result.middlewares as string[];
    expect(mws.length).toBe(2);
    expect(Array.isArray(result.order)).toBe(true);
  });

  it('reports missingImplementation for unknown trait', async () => {
    const storage = createInMemoryStorage();

    const result = await middlewareHandler.resolve({
      traits: ['nonexistent'],
      target: 'rest',
    }, storage);

    expect(result.variant).toBe('missingImplementation');
  });

  it('injects middleware into output', async () => {
    const storage = createInMemoryStorage();
    const result = await middlewareHandler.inject({
      output: 'app.get("/todos", handler);',
      middlewares: ['bearer-check', 'zod-validator'],
      target: 'rest',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(typeof result.output).toBe('string');
    expect(result.injectedCount).toBe(2);
  });

  it('resolves middleware in correct position order', async () => {
    const storage = createInMemoryStorage();

    // Register in reverse order
    await middlewareHandler.register({
      trait: 'serialize',
      target: 'rest',
      implementation: 'json-serializer',
      position: 'serialization',
    }, storage);

    await middlewareHandler.register({
      trait: 'auth',
      target: 'rest',
      implementation: 'bearer-check',
      position: 'auth',
    }, storage);

    await middlewareHandler.register({
      trait: 'validate',
      target: 'rest',
      implementation: 'zod-validator',
      position: 'validation',
    }, storage);

    const result = await middlewareHandler.resolve({
      traits: ['serialize', 'auth', 'validate'],
      target: 'rest',
    }, storage);

    expect(result.variant).toBe('ok');
    const order = result.order as number[];
    // Auth (1) should come before validation (3) which should come before serialization (5)
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });
});
