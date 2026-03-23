// ============================================================
// HandlerEntity Handler Tests
//
// Tests for handler registration, retrieval, file lookup,
// concept/language queries, action method extraction, dependency
// analysis, storage usage, stack frame resolution, and stack
// trace parsing.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { handlerEntityHandler } from '../handlers/ts/score/handler-entity.handler.js';

describe('HandlerEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new handler and returns ok', async () => {
      const result = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.handler).toBeDefined();
    });

    it('returns ok for duplicate concept+language (returns existing)', async () => {
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo2.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.existing).toBeDefined();
    });

    it('registers same concept in different languages', async () => {
      const tsResult = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const rsResult = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/rs/todo.handler.rs', language: 'rs', ast: '{}' },
        storage,
      );
      expect(tsResult.variant).toBe('ok');
      expect(rsResult.variant).toBe('ok');
      expect(tsResult.handler).not.toBe(rsResult.handler);
    });

    it('stores parsed AST metadata', async () => {
      const ast = JSON.stringify({
        actionMethods: [{ name: 'create', startLine: 10, endLine: 20 }],
        dependencies: [{ name: '@clef/runtime', external: true }],
        exports: ['todoHandler'],
        storageCollections: ['todos'],
        lineCount: 50,
      });
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const entry = (await storage.find('handlers'))[0];
      expect(entry.lineCount).toBe(50);
      expect(JSON.parse(entry.actionMethods as string)).toHaveLength(1);
      expect(JSON.parse(entry.dependencies as string)).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('retrieves a registered handler by concept and language', async () => {
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.get({ concept: 'Todo', language: 'ts' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.handler).toBe(reg.handler);
    });

    it('returns notfound for nonexistent handler', async () => {
      const result = await handlerEntityHandler.get({ concept: 'Nope', language: 'ts' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // getByFile
  // ----------------------------------------------------------

  describe('getByFile', () => {
    it('finds handler by source file path', async () => {
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.getByFile(
        { sourceFile: 'handlers/ts/todo.handler.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.handler).toBe(reg.handler);
    });

    it('returns notfound for unknown file', async () => {
      const result = await handlerEntityHandler.getByFile(
        { sourceFile: 'handlers/ts/unknown.handler.ts' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByConcept
  // ----------------------------------------------------------

  describe('findByConcept', () => {
    it('returns all handlers for a concept', async () => {
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/rs/todo.handler.rs', language: 'rs', ast: '{}' },
        storage,
      );
      await handlerEntityHandler.register(
        { concept: 'User', sourceFile: 'handlers/ts/user.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );

      const result = await handlerEntityHandler.findByConcept({ concept: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      const handlers = JSON.parse(result.handlers as string);
      expect(handlers).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // findByLanguage
  // ----------------------------------------------------------

  describe('findByLanguage', () => {
    it('returns all handlers for a language', async () => {
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      await handlerEntityHandler.register(
        { concept: 'User', sourceFile: 'handlers/ts/user.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/rs/todo.handler.rs', language: 'rs', ast: '{}' },
        storage,
      );

      const result = await handlerEntityHandler.findByLanguage({ language: 'ts' }, storage);
      expect(result.variant).toBe('ok');
      const handlers = JSON.parse(result.handlers as string);
      expect(handlers).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // getActionMethod
  // ----------------------------------------------------------

  describe('getActionMethod', () => {
    it('retrieves a specific action method from handler AST', async () => {
      const ast = JSON.stringify({
        actionMethods: [
          { name: 'create', startLine: 10, endLine: 20, body: 'return ok' },
          { name: 'delete', startLine: 25, endLine: 35, body: 'return ok' },
        ],
      });
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const result = await handlerEntityHandler.getActionMethod(
        { handler: reg.handler, actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const method = JSON.parse(result.method as string);
      expect(method.name).toBe('create');
      expect(method.startLine).toBe(10);
    });

    it('returns ok with stub for nonexistent action method in registered handler', async () => {
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.getActionMethod(
        { handler: reg.handler, actionName: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound for nonexistent handler', async () => {
      const result = await handlerEntityHandler.getActionMethod(
        { handler: 'bad-id', actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // implementationGaps
  // ----------------------------------------------------------

  describe('implementationGaps', () => {
    it('reports ok with action count', async () => {
      const ast = JSON.stringify({
        actionMethods: [{ name: 'create' }, { name: 'delete' }],
      });
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const result = await handlerEntityHandler.implementationGaps({ concept: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.actionCount).toBe(2);
    });

    it('returns noHandler when no handlers exist for concept', async () => {
      const result = await handlerEntityHandler.implementationGaps({ concept: 'Nope' }, storage);
      expect(result.variant).toBe('noHandler');
    });
  });

  // ----------------------------------------------------------
  // getDependencies
  // ----------------------------------------------------------

  describe('getDependencies', () => {
    it('separates external and internal dependencies', async () => {
      const ast = JSON.stringify({
        dependencies: [
          { name: '@clef/runtime', external: true },
          { name: './utils', external: false },
          { name: 'zod', external: true },
        ],
      });
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const result = await handlerEntityHandler.getDependencies(
        { handler: reg.handler },
        storage,
      );
      expect(result.variant).toBe('ok');
      const external = JSON.parse(result.externalPackages as string);
      const internal = JSON.parse(result.internalModules as string);
      expect(external).toHaveLength(2);
      expect(internal).toHaveLength(1);
    });

    it('returns notfound for nonexistent handler', async () => {
      const result = await handlerEntityHandler.getDependencies(
        { handler: 'bad-id' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // getStorageUsage
  // ----------------------------------------------------------

  describe('getStorageUsage', () => {
    it('returns storage collections from handler', async () => {
      const ast = JSON.stringify({
        storageCollections: ['todos', 'todo-tags'],
      });
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const result = await handlerEntityHandler.getStorageUsage(
        { handler: reg.handler },
        storage,
      );
      expect(result.variant).toBe('ok');
      const collections = JSON.parse(result.collections as string);
      expect(collections).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // resolveStackFrame
  // ----------------------------------------------------------

  describe('resolveStackFrame', () => {
    it('resolves a file:line:col to a handler', async () => {
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.resolveStackFrame(
        { file: 'handlers/ts/todo.handler.ts', line: 15, col: 5 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.concept).toBe('Todo');
      expect(result.sourceSpan).toBe('handlers/ts/todo.handler.ts:15:5');
    });

    it('returns notInHandler for unknown file', async () => {
      const result = await handlerEntityHandler.resolveStackFrame(
        { file: 'unknown.ts', line: 1, col: 1 },
        storage,
      );
      expect(result.variant).toBe('notInHandler');
    });
  });

  // ----------------------------------------------------------
  // resolveToAstNode
  // ----------------------------------------------------------

  describe('resolveToAstNode', () => {
    it('resolves line:col within a handler to an AST node', async () => {
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.resolveToAstNode(
        { handler: reg.handler, line: 10, col: 3 },
        storage,
      );
      expect(result.variant).toBe('ok');
      const node = JSON.parse(result.node as string);
      expect(node.startLine).toBe(10);
      expect(node.startCol).toBe(3);
    });

    it('returns outOfRange for nonexistent handler', async () => {
      const result = await handlerEntityHandler.resolveToAstNode(
        { handler: 'bad-id', line: 10, col: 3 },
        storage,
      );
      expect(result.variant).toBe('outOfRange');
    });

    it('returns outOfRange when line exceeds handler lineCount', async () => {
      const ast = JSON.stringify({ lineCount: 50 });
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const result = await handlerEntityHandler.resolveToAstNode(
        { handler: reg.handler, line: 100, col: 1 },
        storage,
      );
      expect(result.variant).toBe('outOfRange');
      expect(result.maxLine).toBe(50);
    });
  });

  // ----------------------------------------------------------
  // resolveStackTrace
  // ----------------------------------------------------------

  describe('resolveStackTrace', () => {
    it('parses a stack trace and resolves frames to handlers', async () => {
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );

      const stackTrace = `Error: Something broke
    at TodoHandler.create (handlers/ts/todo.handler.ts:15:10)
    at SyncEngine.dispatch (runtime/sync.ts:42:5)`;

      const result = await handlerEntityHandler.resolveStackTrace({ stackTrace }, storage);
      expect(result.variant).toBe('ok');
      const frames = JSON.parse(result.frames as string);
      expect(frames).toHaveLength(2);
      expect(frames[0].concept).toBe('Todo');
      expect(frames[0].line).toBe(15);
      expect(frames[1].concept).toBeNull(); // sync.ts not a handler
    });

    it('returns error for empty stack trace', async () => {
      const result = await handlerEntityHandler.resolveStackTrace({ stackTrace: '' }, storage);
      expect(result.variant).not.toBe('ok');
    });
  });

  // ----------------------------------------------------------
  // traceToVariantReturn
  // ----------------------------------------------------------

  describe('traceToVariantReturn', () => {
    it('returns ok with empty returns (stub)', async () => {
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.traceToVariantReturn(
        { handler: reg.handler, actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.returns).toBe('[]');
    });

    it('returns notfound for nonexistent handler', async () => {
      const result = await handlerEntityHandler.traceToVariantReturn(
        { handler: 'bad-id', actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // traceToStorageCalls
  // ----------------------------------------------------------

  describe('traceToStorageCalls', () => {
    it('returns ok with empty calls (stub)', async () => {
      const reg = await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.traceToStorageCalls(
        { handler: reg.handler, actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.calls).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // findByError
  // ----------------------------------------------------------

  describe('findByError', () => {
    it('returns notfound for non-matching error symbol', async () => {
      const result = await handlerEntityHandler.findByError(
        { errorSymbol: 'ERR_001', since: '2024-01-01' },
        storage,
      );
      expect(result.variant).not.toBe('ok');
    });
  });

  // ----------------------------------------------------------
  // sourceForAction
  // ----------------------------------------------------------

  describe('sourceForAction', () => {
    it('returns source for a known action method', async () => {
      const ast = JSON.stringify({
        actionMethods: [
          { name: 'create', body: 'return { variant: "ok" }', startLine: 10, endLine: 20 },
        ],
      });
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast },
        storage,
      );
      const result = await handlerEntityHandler.sourceForAction(
        { concept: 'Todo', actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.file).toBe('handlers/ts/todo.handler.ts');
      expect(result.startLine).toBe(10);
      expect(result.endLine).toBe(20);
    });

    it('returns noHandler when concept has no handlers', async () => {
      const result = await handlerEntityHandler.sourceForAction(
        { concept: 'Nope', actionName: 'create' },
        storage,
      );
      expect(result.variant).toBe('noHandler');
    });

    it('returns ok with empty source for action not in AST (handler exists)', async () => {
      await handlerEntityHandler.register(
        { concept: 'Todo', sourceFile: 'handlers/ts/todo.handler.ts', language: 'ts', ast: '{}' },
        storage,
      );
      const result = await handlerEntityHandler.sourceForAction(
        { concept: 'Todo', actionName: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
