// ============================================================
// OpenApiTarget Handler Tests
//
// Generate OpenAPI 3.1 specification documents from concept
// projections. See Architecture doc Section 2.7.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  openApiTargetHandler,
  resetOpenApiTargetCounter,
} from '../handlers/ts/open-api-target.handler.js';

describe('OpenApiTarget', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetOpenApiTargetCounter();
  });

  describe('generate', () => {
    it('generates an OpenAPI 3.1 spec from projections', async () => {
      const result = await openApiTargetHandler.generate!(
        {
          projections: ['todo', 'user'],
          config: JSON.stringify({ title: 'My REST API', version: '1.0.0' }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.spec).toBe('open-api-target-1');
      const doc = JSON.parse(result.content as string);
      expect(doc.openapi).toBe('3.1.0');
      expect(doc.info.title).toBe('My REST API');
    });

    it('generates CRUD paths for each projection', async () => {
      const result = await openApiTargetHandler.generate!(
        {
          projections: ['todo'],
          config: JSON.stringify({ basePath: '/api' }),
        },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      // Collection endpoints
      expect(doc.paths['/api/todo']).toBeDefined();
      expect(doc.paths['/api/todo'].get).toBeDefined();
      expect(doc.paths['/api/todo'].post).toBeDefined();
      // Instance endpoints
      expect(doc.paths['/api/todo/{id}']).toBeDefined();
      expect(doc.paths['/api/todo/{id}'].get).toBeDefined();
      expect(doc.paths['/api/todo/{id}'].put).toBeDefined();
      expect(doc.paths['/api/todo/{id}'].delete).toBeDefined();
    });

    it('generates schemas for each projection', async () => {
      const result = await openApiTargetHandler.generate!(
        { projections: ['user'], config: '{}' },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      expect(doc.components.schemas['user']).toBeDefined();
      expect(doc.components.schemas['userInput']).toBeDefined();
      expect(doc.components.schemas['user'].properties.id).toBeDefined();
    });

    it('uses default config values when not specified', async () => {
      const result = await openApiTargetHandler.generate!(
        { projections: ['test'], config: '{}' },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      expect(doc.info.title).toBe('Clef OpenAPI Specification');
      expect(doc.info.version).toBe('1.0.0');
      expect(doc.paths['/api/test']).toBeDefined();
    });

    it('handles multiple projections', async () => {
      const result = await openApiTargetHandler.generate!(
        { projections: ['todo', 'user', 'tag'], config: '{}' },
        storage,
      );
      const doc = JSON.parse(result.content as string);
      const pathKeys = Object.keys(doc.paths);
      // 3 projections * 2 paths each (collection + instance) = 6
      expect(pathKeys.length).toBe(6);
      const schemaKeys = Object.keys(doc.components.schemas);
      // 3 projections * 2 schemas each (resource + input) = 6
      expect(schemaKeys.length).toBe(6);
    });

    it('stores the generated spec in storage', async () => {
      await openApiTargetHandler.generate!(
        { projections: ['test'], config: '{}' },
        storage,
      );
      const stored = await storage.get('open-api-target', 'open-api-target-1');
      expect(stored).not.toBeNull();
      expect(stored!.version).toBe('3.1.0');
    });
  });
});
