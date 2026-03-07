// ============================================================
// SchemaProxy Handler Tests
//
// Tests for schema lookup and schema-based search actions
// of the SchemaProxy concept (clef-hub ecosystem app).
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { schemaProxyHandler } from '../clef-hub/handlers/ts/schema-proxy.handler.js';

describe('SchemaProxy Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    storage = createInMemoryStorage();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ----------------------------------------------------------
  // lookupSchemas
  // ----------------------------------------------------------

  describe('lookupSchemas', () => {
    it('returns ok with schemas when the registry responds', async () => {
      const schemas = [
        {
          name: 'UserSchema',
          concept: 'User',
          fields: [
            { name: 'id', type: 'String' },
            { name: 'email', type: 'String' },
          ],
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ schemas }),
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.lookupSchemas(
        { module_id: 'auth-suite', version: '1.0.0' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.schemas).toEqual(schemas);
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/api/components/auth-suite/1.0.0/schemas'),
      );
    });

    it('returns notfound when registry returns 404', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.lookupSchemas(
        { module_id: 'nonexistent', version: '1.0.0' },
        storage,
      );

      expect(result.variant).toBe('notfound');
    });

    it('returns notfound when schemas array is empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ schemas: [] }),
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.lookupSchemas(
        { module_id: 'empty-module', version: '1.0.0' },
        storage,
      );

      expect(result.variant).toBe('notfound');
    });

    it('returns unavailable when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('Connection refused'),
      ) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.lookupSchemas(
        { module_id: 'auth-suite', version: '1.0.0' },
        storage,
      );

      expect(result.variant).toBe('unavailable');
      expect(result.message).toContain('Connection refused');
    });
  });

  // ----------------------------------------------------------
  // searchBySchema
  // ----------------------------------------------------------

  describe('searchBySchema', () => {
    it('returns ok with matching results', async () => {
      const results = [
        { module_id: 'auth-suite', schema_name: 'UserSchema', version: '1.0.0' },
        { module_id: 'identity-suite', schema_name: 'UserProfile', version: '2.1.0' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results }),
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.searchBySchema(
        { query: 'User', field_filter: 'email' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.results).toEqual(results);
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        expect.stringContaining('query=User'),
      );
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        expect.stringContaining('field_filter=email'),
      );
    });

    it('returns empty when no results match', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.searchBySchema(
        { query: 'nonexistent', field_filter: '' },
        storage,
      );

      expect(result.variant).toBe('empty');
    });

    it('returns empty when registry returns error status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.searchBySchema(
        { query: 'User', field_filter: '' },
        storage,
      );

      expect(result.variant).toBe('empty');
    });

    it('returns unavailable when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('ECONNREFUSED'),
      ) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.searchBySchema(
        { query: 'User', field_filter: '' },
        storage,
      );

      expect(result.variant).toBe('unavailable');
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('handles search without field_filter', async () => {
      const results = [
        { module_id: 'auth-suite', schema_name: 'UserSchema', version: '1.0.0' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results }),
      }) as unknown as typeof globalThis.fetch;

      const result = await schemaProxyHandler.searchBySchema(
        { query: 'User', field_filter: '' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.results).toHaveLength(1);
    });
  });
});
