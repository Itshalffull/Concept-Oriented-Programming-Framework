// ============================================================
// ComponentManifest Concept Tests (v2)
//
// Validates the ComponentManifest concept handler — registration
// with schemas/compositions/themes, lookup, search, searchBySchema,
// and searchByTheme actions.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../runtime/index.js';
import { componentManifestHandler } from '../clef-registry/handlers/ts/component-manifest.handler.js';

// ============================================================
// Helper: register a full component manifest
// ============================================================

function fullManifestInput(overrides: Record<string, unknown> = {}) {
  return {
    module_id: 'auth-suite',
    version: '1.0.0',
    concepts: [{ name: 'Authentication', spec_path: 'specs/auth.concept', type_params: ['U'] }],
    syncs: [{ name: 'AuthGuard', path: 'syncs/auth-guard.sync', annotation: 'required' }],
    derived: [{ name: 'SecureLogin', path: 'derived/secure-login.derived', composes: ['Authentication', 'Session'] }],
    widgets: [{ name: 'LoginForm', path: 'surface/login-form.widget', concept: 'Authentication', provider: 'react' }],
    handlers: [{ name: 'auth-handler', path: 'handlers/ts/auth.handler.ts', language: 'typescript', concept: 'Authentication' }],
    schemas: [
      {
        name: 'UserSchema',
        concept: 'Authentication',
        primary_set: 'users',
        manifest: 'schema.yaml',
        fields: [
          { name: 'email', type: 'String', from: 'state' },
          { name: 'role', type: 'String', from: 'derived' },
        ],
      },
    ],
    compositions: [
      { source: 'Authentication', target: 'Session', rule_type: 'sync' },
    ],
    themes: [
      { name: 'auth-dark', path: 'surface/auth-dark.theme', extends: 'base-dark' },
      { name: 'auth-light', path: 'surface/auth-light.theme' },
    ],
    ...overrides,
  };
}

// ============================================================
// ComponentManifest Concept
// ============================================================

describe('ComponentManifest Concept (v2)', () => {
  it('registers a component manifest with schemas, compositions, and themes', async () => {
    const storage = createInMemoryStorage();
    const result = await componentManifestHandler.register(fullManifestInput(), storage);

    expect(result.variant).toBe('ok');
    expect(result.component).toBe('auth-suite@1.0.0');
  });

  it('lookup returns registered manifest including new v2 fields', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const lookup = await componentManifestHandler.lookup(
      { module_id: 'auth-suite', version: '1.0.0' },
      storage,
    );

    expect(lookup.variant).toBe('ok');
    const comp = lookup.component as Record<string, unknown>;
    expect(comp.module_id).toBe('auth-suite');
    expect(comp.version).toBe('1.0.0');

    // v2 fields
    const schemas = comp.schemas as Array<Record<string, unknown>>;
    expect(schemas).toHaveLength(1);
    expect(schemas[0].name).toBe('UserSchema');
    expect(schemas[0].concept).toBe('Authentication');
    expect((schemas[0].fields as Array<unknown>)).toHaveLength(2);

    const compositions = comp.compositions as Array<Record<string, unknown>>;
    expect(compositions).toHaveLength(1);
    expect(compositions[0].source).toBe('Authentication');
    expect(compositions[0].target).toBe('Session');

    const themes = comp.themes as Array<Record<string, unknown>>;
    expect(themes).toHaveLength(2);
    expect(themes[0].name).toBe('auth-dark');
    expect(themes[0].extends).toBe('base-dark');
  });

  it('lookup returns notfound for unknown module', async () => {
    const storage = createInMemoryStorage();
    const result = await componentManifestHandler.lookup(
      { module_id: 'nonexistent', version: '0.0.0' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('registers with empty v2 fields (backward compatibility)', async () => {
    const storage = createInMemoryStorage();
    const result = await componentManifestHandler.register(
      fullManifestInput({ schemas: [], compositions: [], themes: [] }),
      storage,
    );
    expect(result.variant).toBe('ok');

    const lookup = await componentManifestHandler.lookup(
      { module_id: 'auth-suite', version: '1.0.0' },
      storage,
    );
    expect(lookup.variant).toBe('ok');
    const comp = lookup.component as Record<string, unknown>;
    expect(comp.schemas).toEqual([]);
    expect(comp.compositions).toEqual([]);
    expect(comp.themes).toEqual([]);
  });

  it('search finds concepts, syncs, derived, widgets, schemas, and themes', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    // Search by concept name
    const r1 = await componentManifestHandler.search({ capability: 'Auth' }, storage);
    expect(r1.variant).toBe('ok');
    const results1 = r1.results as Array<Record<string, unknown>>;
    expect(results1.some((r) => r.match_type === 'concept' && r.match_name === 'Authentication')).toBe(true);

    // Search by widget name
    const r2 = await componentManifestHandler.search({ capability: 'Login' }, storage);
    expect(r2.variant).toBe('ok');
    const results2 = r2.results as Array<Record<string, unknown>>;
    expect(results2.some((r) => r.match_type === 'widget' && r.match_name === 'LoginForm')).toBe(true);

    // Search by schema name
    const r3 = await componentManifestHandler.search({ capability: 'UserSchema' }, storage);
    expect(r3.variant).toBe('ok');
    const results3 = r3.results as Array<Record<string, unknown>>;
    expect(results3.some((r) => r.match_type === 'schema' && r.match_name === 'UserSchema')).toBe(true);

    // Search by theme name
    const r4 = await componentManifestHandler.search({ capability: 'auth-dark' }, storage);
    expect(r4.variant).toBe('ok');
    const results4 = r4.results as Array<Record<string, unknown>>;
    expect(results4.some((r) => r.match_type === 'theme' && r.match_name === 'auth-dark')).toBe(true);
  });

  it('search returns empty when no match', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const result = await componentManifestHandler.search({ capability: 'zzz-nonexistent' }, storage);
    expect(result.variant).toBe('empty');
  });

  it('searchBySchema finds schemas by name', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const result = await componentManifestHandler.searchBySchema(
      { schema_name: 'User', field_filter: '' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = result.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0].module_id).toBe('auth-suite');
    expect(results[0].schema_name).toBe('UserSchema');
  });

  it('searchBySchema filters by field name', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const r1 = await componentManifestHandler.searchBySchema(
      { schema_name: 'User', field_filter: 'email' },
      storage,
    );
    expect(r1.variant).toBe('ok');

    const r2 = await componentManifestHandler.searchBySchema(
      { schema_name: 'User', field_filter: 'nonexistent_field' },
      storage,
    );
    expect(r2.variant).toBe('empty');
  });

  it('searchBySchema returns empty when no match', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const result = await componentManifestHandler.searchBySchema(
      { schema_name: 'NonExistent', field_filter: '' },
      storage,
    );
    expect(result.variant).toBe('empty');
  });

  it('searchByTheme finds themes by name', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const result = await componentManifestHandler.searchByTheme(
      { theme_name: 'auth-dark' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = result.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0].theme_name).toBe('auth-dark');
    expect(results[0].module_id).toBe('auth-suite');
  });

  it('searchByTheme finds partial matches', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const result = await componentManifestHandler.searchByTheme(
      { theme_name: 'auth' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = result.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(2); // auth-dark and auth-light
  });

  it('searchByTheme returns empty when no match', async () => {
    const storage = createInMemoryStorage();
    await componentManifestHandler.register(fullManifestInput(), storage);

    const result = await componentManifestHandler.searchByTheme(
      { theme_name: 'zzz-nonexistent' },
      storage,
    );
    expect(result.variant).toBe('empty');
  });

  it('invariant: register then lookup returns same component', async () => {
    const storage = createInMemoryStorage();
    const reg = await componentManifestHandler.register(
      fullManifestInput({ schemas: [], compositions: [], themes: [] }),
      storage,
    );
    expect(reg.variant).toBe('ok');

    const lookup = await componentManifestHandler.lookup(
      { module_id: 'auth-suite', version: '1.0.0' },
      storage,
    );
    expect(lookup.variant).toBe('ok');
  });
});
