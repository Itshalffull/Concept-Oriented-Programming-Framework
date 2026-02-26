// ============================================================
// TypeScriptGen Handler Tests
//
// Generate TypeScript skeleton code from a ConceptManifest.
// Produces type definitions, handler interface, transport
// adapter, lite query implementation, and conformance tests.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  typeScriptGenHandler,
  resetTypeScriptGenCounter,
} from '../handlers/ts/type-script-gen.handler.js';

describe('TypeScriptGen', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTypeScriptGenCounter();
  });

  const sampleManifest = {
    name: 'todo-item',
    purpose: 'Manage individual todo items',
    actions: [
      {
        name: 'create',
        params: [
          { name: 'title', type: 'String' },
          { name: 'priority', type: 'Int' },
        ],
        variants: [
          {
            tag: 'ok',
            fields: [
              { name: 'id', type: 'String' },
              { name: 'title', type: 'String' },
            ],
          },
          {
            tag: 'error',
            fields: [
              { name: 'message', type: 'String' },
            ],
          },
        ],
      },
      {
        name: 'complete',
        params: [
          { name: 'id', type: 'String' },
        ],
        variants: [
          { tag: 'ok', fields: [] },
          { tag: 'notFound', fields: [{ name: 'id', type: 'String' }] },
        ],
      },
    ],
    invariants: [
      { description: 'Title must be non-empty' },
      { description: 'Priority must be positive' },
    ],
  };

  describe('generate', () => {
    it('generates all five file categories', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = result.files as Array<{ path: string; content: string }>;
      expect(files.length).toBe(5);

      const paths = files.map(f => f.path);
      expect(paths).toContain('generated/todoItem/types.ts');
      expect(paths).toContain('generated/todoItem/handler.ts');
      expect(paths).toContain('generated/todoItem/adapter.ts');
      expect(paths).toContain('generated/todoItem/query.ts');
      expect(paths).toContain('generated/todoItem/conformance.test.ts');
    });

    it('generates correct type definitions with mapped types', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const typesFile = files.find(f => f.path.endsWith('types.ts'))!;

      // Check String -> string mapping
      expect(typesFile.content).toContain('title: string;');
      // Check Int -> number mapping
      expect(typesFile.content).toContain('priority: number;');
      // Check variant tag
      expect(typesFile.content).toContain("variant: 'ok';");
      expect(typesFile.content).toContain("variant: 'error';");
      expect(typesFile.content).toContain("variant: 'notFound';");
    });

    it('generates handler interface with all actions', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const handlerFile = files.find(f => f.path.endsWith('handler.ts'))!;

      expect(handlerFile.content).toContain('export interface TodoItemHandler');
      expect(handlerFile.content).toContain('create(input:');
      expect(handlerFile.content).toContain('complete(input:');
    });

    it('generates transport adapter with dispatch function', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const adapterFile = files.find(f => f.path.endsWith('adapter.ts'))!;

      expect(adapterFile.content).toContain('createTodoItemAdapter');
      expect(adapterFile.content).toContain('dispatch(invocation');
      expect(adapterFile.content).toContain("concept: 'todo-item'");
    });

    it('generates query implementation with find and get', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const queryFile = files.find(f => f.path.endsWith('query.ts'))!;

      expect(queryFile.content).toContain('createTodoItemQuery');
      expect(queryFile.content).toContain('find(relation');
      expect(queryFile.content).toContain('get(relation');
    });

    it('generates conformance tests from invariants', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const testFile = files.find(f => f.path.endsWith('conformance.test.ts'))!;

      expect(testFile.content).toContain("describe('todo-item conformance'");
      // Should have 2 invariant tests
      expect(testFile.content).toContain('satisfies invariant 1');
      expect(testFile.content).toContain('satisfies invariant 2');
    });

    it('generates placeholder test when no invariants exist', async () => {
      const noInvariantsManifest = {
        name: 'simple',
        purpose: 'A simple concept',
        actions: [],
      };
      const result = await typeScriptGenHandler.generate!(
        { spec: 'simple.concept', manifest: noInvariantsManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const testFile = files.find(f => f.path.endsWith('conformance.test.ts'))!;

      expect(testFile.content).toContain('has no invariants to test');
    });

    it('stores generation metadata in storage', async () => {
      await typeScriptGenHandler.generate!(
        { spec: 'todo-item.concept', manifest: sampleManifest },
        storage,
      );
      const stored = await storage.get('type-script-gen', 'type-script-gen-1');
      expect(stored).not.toBeNull();
      expect(stored!.spec).toBe('todo-item.concept');
      expect(stored!.conceptName).toBe('todo-item');
      expect(stored!.fileCount).toBe(5);
      expect(stored!.generatedAt).toBeDefined();
    });

    it('returns error when manifest name is missing', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'bad.concept', manifest: {} },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('name is required');
    });

    it('returns error when manifest name is empty', async () => {
      const result = await typeScriptGenHandler.generate!(
        { spec: 'bad.concept', manifest: { name: '  ' } },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('handles type mapping for complex types', async () => {
      const complexManifest = {
        name: 'complex-types',
        actions: [
          {
            name: 'process',
            params: [
              { name: 'data', type: 'Bytes' },
              { name: 'timestamp', type: 'DateTime' },
              { name: 'flag', type: 'Bool' },
              { name: 'score', type: 'Float' },
            ],
            variants: [],
          },
        ],
      };
      const result = await typeScriptGenHandler.generate!(
        { spec: 'complex.concept', manifest: complexManifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const typesFile = files.find(f => f.path.endsWith('types.ts'))!;

      expect(typesFile.content).toContain('data: Uint8Array;');
      expect(typesFile.content).toContain('timestamp: string;');
      expect(typesFile.content).toContain('flag: boolean;');
      expect(typesFile.content).toContain('score: number;');
    });

    it('converts concept names to PascalCase for types', async () => {
      const manifest = {
        name: 'user-profile',
        actions: [{ name: 'get-info', params: [], variants: [] }],
      };
      const result = await typeScriptGenHandler.generate!(
        { spec: 'user-profile.concept', manifest },
        storage,
      );
      const files = result.files as Array<{ path: string; content: string }>;
      const handlerFile = files.find(f => f.path.endsWith('handler.ts'))!;

      expect(handlerFile.content).toContain('UserProfileHandler');
    });

    it('assigns unique IDs to different generations', async () => {
      await typeScriptGenHandler.generate!(
        { spec: 'a.concept', manifest: { name: 'concept-a', actions: [] } },
        storage,
      );
      await typeScriptGenHandler.generate!(
        { spec: 'b.concept', manifest: { name: 'concept-b', actions: [] } },
        storage,
      );

      const first = await storage.get('type-script-gen', 'type-script-gen-1');
      const second = await storage.get('type-script-gen', 'type-script-gen-2');
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first!.conceptName).toBe('concept-a');
      expect(second!.conceptName).toBe('concept-b');
    });
  });

  describe('register', () => {
    it('returns generator registration info', async () => {
      const result = await typeScriptGenHandler.register!(
        {},
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('TypeScriptGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('TypeScriptSource');
      expect(result.capabilities).toContain('types');
      expect(result.capabilities).toContain('handler');
      expect(result.capabilities).toContain('adapter');
      expect(result.capabilities).toContain('conformance-tests');
    });
  });
});
