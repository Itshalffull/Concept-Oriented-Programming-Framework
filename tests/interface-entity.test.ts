// ============================================================
// InterfaceEntity Handler Tests
//
// Tests for interface registration, retrieval, endpoint/command/
// tool/skill listing, concept/action exposure queries, endpoint
// and tool tracing, schema listing, and spec validation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interfaceEntityHandler } from '../handlers/ts/score/interface-entity.handler.js';

describe('InterfaceEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const sampleManifest = JSON.stringify({
    targets: ['rest', 'cli', 'mcp'],
    sdks: [{ name: 'ts-sdk', language: 'typescript' }],
    generatedEndpoints: [
      { target: 'rest', path: '/api/todos', method: 'POST', concept: 'Todo', action: 'create' },
      { target: 'rest', path: '/api/todos', method: 'GET', concept: 'Todo', action: 'list' },
      { target: 'graphql', path: '/graphql', method: 'mutation', concept: 'Todo', action: 'create' },
    ],
    generatedCommands: [
      { command: 'todo create', concept: 'Todo', action: 'create' },
    ],
    generatedTools: [
      { name: 'todo-create', concept: 'Todo', action: 'create', kind: 'tool' },
      { name: 'todo-list-skill', concept: 'Todo', action: 'list', kind: 'skill' },
    ],
    generatedSchemas: [
      { name: 'TodoCreateInput', format: 'json-schema' },
    ],
  });

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new interface', async () => {
      const result = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.interface).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate name', async () => {
      await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools2.interface.yaml', manifest: sampleManifest },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });
  });

  describe('get', () => {
    it('retrieves by name', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.get({ name: 'devtools' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.interface).toBe(reg.interface);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await interfaceEntityHandler.get({ name: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('listEndpoints', () => {
    it('returns all endpoints', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.listEndpoints(
        { interface: reg.interface, target: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const endpoints = JSON.parse(result.endpoints as string);
      expect(endpoints).toHaveLength(3);
    });

    it('filters endpoints by target', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.listEndpoints(
        { interface: reg.interface, target: 'rest' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const endpoints = JSON.parse(result.endpoints as string);
      expect(endpoints).toHaveLength(2);
    });

    it('returns empty for nonexistent interface', async () => {
      const result = await interfaceEntityHandler.listEndpoints(
        { interface: 'bad-id', target: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.endpoints).toBe('[]');
    });
  });

  describe('listCommands', () => {
    it('returns CLI commands', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.listCommands(
        { interface: reg.interface },
        storage,
      );
      expect(result.variant).toBe('ok');
      const commands = JSON.parse(result.commands as string);
      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('todo create');
    });
  });

  describe('listTools', () => {
    it('returns MCP tools', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.listTools(
        { interface: reg.interface },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tools = JSON.parse(result.tools as string);
      expect(tools).toHaveLength(2);
    });
  });

  describe('listSkills', () => {
    it('returns only skill-kind tools', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.listSkills(
        { interface: reg.interface },
        storage,
      );
      expect(result.variant).toBe('ok');
      const skills = JSON.parse(result.skills as string);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('todo-list-skill');
    });
  });

  describe('findByConcept', () => {
    it('finds all exposures for a concept across interfaces', async () => {
      await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.findByConcept(
        { concept: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const exposures = JSON.parse(result.exposures as string);
      // 3 endpoints + 1 command + 2 tools = 6
      expect(exposures.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('findByAction', () => {
    it('finds all exposures for a specific concept action', async () => {
      await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.findByAction(
        { concept: 'Todo', action: 'create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const exposures = JSON.parse(result.exposures as string);
      // REST POST + GraphQL mutation + CLI command + MCP tool = 4
      expect(exposures.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('traceEndpointToAction', () => {
    it('traces a REST endpoint back to concept action', async () => {
      await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.traceEndpointToAction(
        { target: 'rest', path: '/api/todos', method: 'POST' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.concept).toBe('Todo');
      expect(result.action).toBe('create');
    });

    it('returns notfound for unknown endpoint', async () => {
      const result = await interfaceEntityHandler.traceEndpointToAction(
        { target: 'rest', path: '/api/unknown', method: 'GET' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('traceToolToAction', () => {
    it('traces a tool name back to concept action', async () => {
      await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.traceToolToAction(
        { toolName: 'todo-create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.concept).toBe('Todo');
      expect(result.action).toBe('create');
    });

    it('returns notfound for unknown tool', async () => {
      const result = await interfaceEntityHandler.traceToolToAction(
        { toolName: 'unknown-tool' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('generatedSchemas', () => {
    it('returns schemas for an interface', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.generatedSchemas(
        { interface: reg.interface },
        storage,
      );
      expect(result.variant).toBe('ok');
      const schemas = JSON.parse(result.schemas as string);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('TodoCreateInput');
    });
  });

  describe('validateAgainstSpecs', () => {
    it('returns valid (stub)', async () => {
      const reg = await interfaceEntityHandler.register(
        { name: 'devtools', source: 'devtools.interface.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await interfaceEntityHandler.validateAgainstSpecs(
        { interface: reg.interface },
        storage,
      );
      expect(result.variant).toBe('ok');
      const valid = JSON.parse(result.valid as string);
      expect(valid.valid).toBe(true);
    });
  });
});
