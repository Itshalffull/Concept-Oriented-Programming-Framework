// ============================================================
// ApiSurface Handler Tests
//
// Compose generated interfaces from multiple concepts into a
// cohesive, unified API surface per target.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  apiSurfaceHandler,
  resetApiSurfaceCounter,
} from '../handlers/ts/api-surface.handler.js';

describe('ApiSurface', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetApiSurfaceCounter();
  });

  describe('compose', () => {
    it('composes a REST API surface', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'rest', outputs: ['todo-output', 'user-output'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.surface).toBe('api-surface-1');
      expect(result.conceptCount).toBe(2);
      const entrypoint = result.entrypoint as string;
      expect(entrypoint).toContain("router.use('/myapp/todo'");
      expect(entrypoint).toContain("router.use('/myapp/user'");
    });

    it('composes a GraphQL API surface', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'graphql', outputs: ['todo-output'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entrypoint = result.entrypoint as string;
      expect(entrypoint).toContain('type Query');
    });

    it('composes a CLI API surface', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'cli', outputs: ['todo-output', 'auth-output'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entrypoint = result.entrypoint as string;
      expect(entrypoint).toContain("program.command('todo')");
      expect(entrypoint).toContain("program.command('auth')");
    });

    it('composes an MCP tool set surface', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'mcp', outputs: ['todo-output'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entrypoint = result.entrypoint as string;
      expect(entrypoint).toContain("name: 'myapp/todo'");
    });

    it('composes an SDK client surface', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'sdk', outputs: ['todo-output'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entrypoint = result.entrypoint as string;
      expect(entrypoint).toContain('todo: todoClient');
    });

    it('detects conflicting routes', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'rest', outputs: ['todo-output', 'todo-output'] },
        storage,
      );
      expect(result.variant).toBe('conflictingRoutes');
    });

    it('returns conflictingRoutes for empty outputs', async () => {
      const result = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'rest', outputs: [] },
        storage,
      );
      expect(result.variant).toBe('conflictingRoutes');
    });
  });

  describe('entrypoint', () => {
    it('retrieves the entrypoint content for a composed surface', async () => {
      const composeResult = await apiSurfaceHandler.compose!(
        { kit: 'myapp', target: 'rest', outputs: ['todo-output'] },
        storage,
      );
      const result = await apiSurfaceHandler.entrypoint!(
        { surface: composeResult.surface as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.content as string).length).toBeGreaterThan(0);
    });

    it('returns empty content for non-existent surface', async () => {
      const result = await apiSurfaceHandler.entrypoint!(
        { surface: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.content).toBe('');
    });
  });
});
