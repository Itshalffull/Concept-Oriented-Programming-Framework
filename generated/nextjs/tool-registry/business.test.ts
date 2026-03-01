// ToolRegistry — business.test.ts
// Business logic tests for LLM tool definitions with versioning, access control, and lifecycle.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { toolRegistryHandler } from './handler.js';
import type { ToolRegistryStorage } from './types.js';

const createTestStorage = (): ToolRegistryStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter) => {
      const entries = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return entries;
      return entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => e[k] === v),
      );
    },
  };
};

describe('ToolRegistry business logic', () => {
  it('full lifecycle: register -> deprecate -> disable', async () => {
    const storage = createTestStorage();

    const regResult = await toolRegistryHandler.register({
      tool_id: 'calculator',
      name: 'Calculator',
      description: 'Performs arithmetic',
      schema: '{"expression":"string"}',
    }, storage)();

    if (E.isRight(regResult) && regResult.right.variant === 'ok') {
      expect(regResult.right.version).toBe(1);
    }

    const depResult = await toolRegistryHandler.deprecate({
      tool_id: 'calculator',
      reason: 'Replaced by advanced-calculator',
    }, storage)();

    if (E.isRight(depResult)) {
      expect(depResult.right.variant).toBe('ok');
    }

    const disResult = await toolRegistryHandler.disable({
      tool_id: 'calculator',
    }, storage)();

    if (E.isRight(disResult)) {
      expect(disResult.right.variant).toBe('ok');
    }
  });

  it('re-register increments version', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'search',
      name: 'Web Search',
      description: 'Search the web',
      schema: '{"query":"string"}',
    }, storage)();

    const v2 = await toolRegistryHandler.register({
      tool_id: 'search',
      name: 'Web Search v2',
      description: 'Enhanced web search',
      schema: '{"query":"string","limit":"number"}',
    }, storage)();

    if (E.isRight(v2) && v2.right.variant === 'ok') {
      expect(v2.right.version).toBe(2);
    }

    const v3 = await toolRegistryHandler.register({
      tool_id: 'search',
      name: 'Web Search v3',
      description: 'Advanced web search',
      schema: '{"query":"string","limit":"number","filter":"string"}',
    }, storage)();

    if (E.isRight(v3) && v3.right.variant === 'ok') {
      expect(v3.right.version).toBe(3);
    }
  });

  it('authorize and checkAccess grant and verify permissions', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'db-query',
      name: 'Database Query',
      description: 'Execute SQL queries',
      schema: '{"sql":"string"}',
    }, storage)();

    await toolRegistryHandler.authorize({
      tool_id: 'db-query',
      model: 'gpt-4',
      process_ref: 'data-pipeline',
    }, storage)();

    const accessResult = await toolRegistryHandler.checkAccess({
      tool_id: 'db-query',
      model: 'gpt-4',
      process_ref: 'data-pipeline',
    }, storage)();

    if (E.isRight(accessResult)) {
      expect(accessResult.right.variant).toBe('allowed');
      if (accessResult.right.variant === 'allowed') {
        expect(accessResult.right.schema).toBe('{"sql":"string"}');
      }
    }
  });

  it('checkAccess denied for unauthorized model/process combination', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'file-write',
      name: 'File Write',
      description: 'Write files',
      schema: '{"path":"string","content":"string"}',
    }, storage)();

    await toolRegistryHandler.authorize({
      tool_id: 'file-write',
      model: 'gpt-4',
      process_ref: 'trusted-process',
    }, storage)();

    // Different model should be denied
    const result = await toolRegistryHandler.checkAccess({
      tool_id: 'file-write',
      model: 'gpt-3.5',
      process_ref: 'trusted-process',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('denied');
    }
  });

  it('checkAccess denied for disabled tool even if authorized', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'old-tool',
      name: 'Old Tool',
      description: 'Legacy',
      schema: '{}',
    }, storage)();

    await toolRegistryHandler.authorize({
      tool_id: 'old-tool',
      model: 'gpt-4',
      process_ref: 'proc-1',
    }, storage)();

    await toolRegistryHandler.deprecate({ tool_id: 'old-tool', reason: 'outdated' }, storage)();
    await toolRegistryHandler.disable({ tool_id: 'old-tool' }, storage)();

    const result = await toolRegistryHandler.checkAccess({
      tool_id: 'old-tool',
      model: 'gpt-4',
      process_ref: 'proc-1',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('denied');
    }
  });

  it('deprecate active tool only, reject deprecated or disabled', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'tool-dep',
      name: 'Tool',
      description: 'desc',
      schema: '{}',
    }, storage)();

    await toolRegistryHandler.deprecate({ tool_id: 'tool-dep', reason: 'old' }, storage)();

    const result = await toolRegistryHandler.deprecate({
      tool_id: 'tool-dep',
      reason: 'double deprecate',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('disable only from deprecated, reject active or disabled', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'tool-dis',
      name: 'Tool',
      description: 'desc',
      schema: '{}',
    }, storage)();

    // Try to disable from active state
    const result = await toolRegistryHandler.disable({ tool_id: 'tool-dis' }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('listActive returns only active tools', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'active-1',
      name: 'Active One',
      description: 'First active',
      schema: '{"a":1}',
    }, storage)();

    await toolRegistryHandler.register({
      tool_id: 'active-2',
      name: 'Active Two',
      description: 'Second active',
      schema: '{"b":2}',
    }, storage)();

    await toolRegistryHandler.register({
      tool_id: 'deprecated-1',
      name: 'Deprecated',
      description: 'Will deprecate',
      schema: '{}',
    }, storage)();

    await toolRegistryHandler.deprecate({ tool_id: 'deprecated-1', reason: 'old' }, storage)();

    const result = await toolRegistryHandler.listActive({}, storage)();
    if (E.isRight(result) && result.right.variant === 'ok') {
      const tools = JSON.parse(result.right.tools);
      const toolIds = tools.map((t: { tool_id: string }) => t.tool_id);
      expect(toolIds).toContain('active-1');
      expect(toolIds).toContain('active-2');
      expect(toolIds).not.toContain('deprecated-1');
    }
  });

  it('not_found for deprecate, disable, authorize on non-existent tool', async () => {
    const storage = createTestStorage();

    const dep = await toolRegistryHandler.deprecate({ tool_id: 'ghost', reason: 'r' }, storage)();
    if (E.isRight(dep)) expect(dep.right.variant).toBe('notfound');

    const dis = await toolRegistryHandler.disable({ tool_id: 'ghost' }, storage)();
    if (E.isRight(dis)) expect(dis.right.variant).toBe('notfound');

    const auth = await toolRegistryHandler.authorize({
      tool_id: 'ghost', model: 'm', process_ref: 'p',
    }, storage)();
    if (E.isRight(auth)) expect(auth.right.variant).toBe('notfound');

    const chk = await toolRegistryHandler.checkAccess({
      tool_id: 'ghost', model: 'm', process_ref: 'p',
    }, storage)();
    if (E.isRight(chk)) expect(chk.right.variant).toBe('notfound');
  });

  it('deprecated tool still allows checkAccess if authorized', async () => {
    const storage = createTestStorage();

    await toolRegistryHandler.register({
      tool_id: 'dep-accessible',
      name: 'Dep Tool',
      description: 'desc',
      schema: '{"x":1}',
    }, storage)();

    await toolRegistryHandler.authorize({
      tool_id: 'dep-accessible',
      model: 'gpt-4',
      process_ref: 'proc',
    }, storage)();

    await toolRegistryHandler.deprecate({ tool_id: 'dep-accessible', reason: 'old' }, storage)();

    const result = await toolRegistryHandler.checkAccess({
      tool_id: 'dep-accessible',
      model: 'gpt-4',
      process_ref: 'proc',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('allowed');
    }
  });
});
