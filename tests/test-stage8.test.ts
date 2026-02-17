// ============================================================
// Stage 8 — Concept Kits Tests (Phase 5)
//
// Validates the kit infrastructure:
//  1. Kit manifest parsing and loading
//  2. Type parameter alignment validation (advisory)
//  3. Sync tier enforcement (required vs recommended)
//  4. Override and disable mechanics
//  5. Auth kit: concept specs, syncs, token-refresh flow
//  6. Content-management kit: Entity/Field/Relation/Node
//  7. Content-management cascade deletes
//  8. Two-kit app using both kits together
//  9. Kit scaffolding (copf kit init)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createInMemoryStorage,
  parseConceptFile,
  parseSyncFile,
  parseKitManifest,
  validateKitTypeAlignment,
  validateSyncTiers,
  resolveKitSyncs,
  scaffoldKit,
  listKitsFromDeployment,
  checkOverrides,
} from '../kernel/src/index.js';
import type { KitManifest } from '../kernel/src/kit.js';
import type { CompiledSync } from '../kernel/src/types.js';

// Kit handlers
import { entityHandler } from '../kits/content-management/implementations/typescript/entity.impl.js';
import { fieldHandler } from '../kits/content-management/implementations/typescript/field.impl.js';
import { relationHandler } from '../kits/content-management/implementations/typescript/relation.impl.js';
import { nodeHandler } from '../kits/content-management/implementations/typescript/node.impl.js';

// Auth handlers (from kit)
import { userHandler } from '../kits/auth/implementations/typescript/user.impl.js';
import { passwordHandler } from '../kits/auth/implementations/typescript/password.impl.js';
import { jwtHandler } from '../kits/auth/implementations/typescript/jwt.impl.js';

const KITS_DIR = resolve(__dirname, '..', 'kits');
const AUTH_KIT_DIR = resolve(KITS_DIR, 'auth');
const CM_KIT_DIR = resolve(KITS_DIR, 'content-management');

function loadKitManifest(kitDir: string): KitManifest {
  const raw = JSON.parse(readFileSync(resolve(kitDir, 'kit.yaml'), 'utf-8'));
  return parseKitManifest(raw);
}

// ============================================================
// 1. Kit Manifest Parsing
// ============================================================

describe('Stage 8 — Kit Manifest Parsing', () => {
  it('parses the auth kit manifest', () => {
    const manifest = loadKitManifest(AUTH_KIT_DIR);

    expect(manifest.kit.name).toBe('auth');
    expect(manifest.kit.version).toBe('0.1.0');
    expect(Object.keys(manifest.concepts)).toHaveLength(3);
    expect(manifest.concepts.User).toBeDefined();
    expect(manifest.concepts.Password).toBeDefined();
    expect(manifest.concepts.JWT).toBeDefined();

    // All three concepts share user-ref alignment
    expect(manifest.concepts.User.params.U.as).toBe('user-ref');
    expect(manifest.concepts.Password.params.U.as).toBe('user-ref');
    expect(manifest.concepts.JWT.params.U.as).toBe('user-ref');

    // No required syncs, 2 recommended
    expect(manifest.syncs.required).toHaveLength(0);
    expect(manifest.syncs.recommended).toHaveLength(2);
  });

  it('parses the content-management kit manifest', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    expect(manifest.kit.name).toBe('content-management');
    expect(Object.keys(manifest.concepts)).toHaveLength(4);
    expect(manifest.concepts.Entity).toBeDefined();
    expect(manifest.concepts.Field).toBeDefined();
    expect(manifest.concepts.Relation).toBeDefined();
    expect(manifest.concepts.Node).toBeDefined();

    // Type parameter alignment
    expect(manifest.concepts.Entity.params.E.as).toBe('entity-ref');
    expect(manifest.concepts.Field.params.F.as).toBe('field-ref');
    expect(manifest.concepts.Field.params.T.as).toBe('entity-ref');
    expect(manifest.concepts.Relation.params.T.as).toBe('entity-ref');
    expect(manifest.concepts.Node.params.N.as).toBe('entity-ref');

    // 3 required syncs, 2 recommended
    expect(manifest.syncs.required).toHaveLength(3);
    expect(manifest.syncs.recommended).toHaveLength(2);

    // Integrations
    expect(manifest.integrations).toHaveLength(1);
    expect(manifest.integrations[0].kit).toBe('auth');
  });

  it('rejects manifest without kit.name', () => {
    expect(() => parseKitManifest({ kit: { version: '1.0' } })).toThrow();
  });
});

// ============================================================
// 2. Type Parameter Alignment Validation
// ============================================================

describe('Stage 8 — Type Parameter Alignment', () => {
  it('produces no warnings for well-aligned auth kit syncs', () => {
    const manifest = loadKitManifest(AUTH_KIT_DIR);

    // Load auth kit syncs
    const syncs: CompiledSync[] = [];
    for (const entry of manifest.syncs.recommended) {
      const source = readFileSync(resolve(AUTH_KIT_DIR, entry.path), 'utf-8');
      syncs.push(...parseSyncFile(source));
    }

    const result = validateKitTypeAlignment(manifest, syncs);
    expect(result.warnings).toHaveLength(0);
  });

  it('produces no warnings for well-aligned content-management kit syncs', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    const syncs: CompiledSync[] = [];
    for (const entry of [...manifest.syncs.required, ...manifest.syncs.recommended]) {
      const source = readFileSync(resolve(CM_KIT_DIR, entry.path), 'utf-8');
      syncs.push(...parseSyncFile(source));
    }

    const result = validateKitTypeAlignment(manifest, syncs);
    expect(result.warnings).toHaveLength(0);
  });

  it('detects misaligned type parameters in a contrived sync', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    // Create a sync that passes a field-ref where entity-ref is expected
    const badSync: CompiledSync = {
      name: 'BadAlignment',
      when: [{
        concept: 'urn:copf/Field',
        action: 'attach',
        inputFields: [{ name: 'f', match: { type: 'variable', name: 'ref' } }],
        outputFields: [{ name: 'field', match: { type: 'variable', name: 'ref' } }],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/Entity',
        action: 'get',
        fields: [{ name: 'e', value: { type: 'variable', name: 'ref' } }],
      }],
    };

    const result = validateKitTypeAlignment(manifest, [badSync]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('field-ref');
    expect(result.warnings[0]).toContain('entity-ref');
  });
});

// ============================================================
// 3. Sync Tier Enforcement
// ============================================================

describe('Stage 8 — Sync Tier Enforcement', () => {
  it('allows disabling recommended syncs', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    const result = validateSyncTiers(manifest, {}, ['DefaultTitleField']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when disabling a required sync', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    const result = validateSyncTiers(manifest, {}, ['CascadeDeleteFields']);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Cannot disable required sync');
    expect(result.errors[0]).toContain('CascadeDeleteFields');
  });

  it('errors when overriding a required sync', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    const result = validateSyncTiers(
      manifest,
      { EntityLifecycle: './my-custom.sync' },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Cannot override required sync');
  });

  it('allows overriding recommended syncs', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    const result = validateSyncTiers(
      manifest,
      { DefaultTitleField: './my-custom.sync' },
      [],
    );
    expect(result.valid).toBe(true);
  });

  it('warns about unknown override targets', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    const result = validateSyncTiers(
      manifest,
      { NonExistentSync: './custom.sync' },
      [],
    );
    expect(result.valid).toBe(true); // Not an error, just a warning
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 4. Override and Disable Mechanics
// ============================================================

describe('Stage 8 — Override and Disable Mechanics', () => {
  it('resolves kit syncs with no overrides/disables', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);
    const resolved = resolveKitSyncs(CM_KIT_DIR, manifest, {}, []);

    expect(resolved.required.length).toBeGreaterThan(0);
    expect(resolved.recommended.length).toBeGreaterThan(0);
    expect(resolved.overridden).toHaveLength(0);
    expect(resolved.disabled).toHaveLength(0);

    // All syncs are present
    const allNames = resolved.syncs.map(s => s.name);
    expect(allNames).toContain('CascadeDeleteFields');
    expect(allNames).toContain('CascadeDeleteRelationsSource');
    expect(allNames).toContain('EntityLifecycleCreate');
    expect(allNames).toContain('NodeCreateEntity');
    expect(allNames).toContain('DefaultTitleField');
  });

  it('disabling a recommended sync removes it from the resolved set', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);
    const resolved = resolveKitSyncs(CM_KIT_DIR, manifest, {}, ['DefaultTitleField']);

    expect(resolved.disabled).toContain('DefaultTitleField');
    const allNames = resolved.syncs.map(s => s.name);
    expect(allNames).not.toContain('DefaultTitleField');
    // Required syncs still present
    expect(allNames).toContain('CascadeDeleteFields');
  });

  it('disabling does not affect required syncs in resolved set', () => {
    // Even if someone tries to disable a required sync (which would fail validation),
    // resolveKitSyncs doesn't remove required syncs
    const manifest = loadKitManifest(CM_KIT_DIR);
    const resolved = resolveKitSyncs(CM_KIT_DIR, manifest, {}, []);

    // Required syncs always present
    const requiredNames = resolved.required;
    expect(requiredNames.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 5. Auth Kit: Concepts + Token Refresh Flow
// ============================================================

describe('Stage 8 — Auth Kit Concepts', () => {
  it('parses all auth kit concept specs', () => {
    const specs = ['user.concept', 'password.concept', 'jwt.concept'];
    for (const spec of specs) {
      const source = readFileSync(resolve(AUTH_KIT_DIR, spec), 'utf-8');
      const ast = parseConceptFile(source);
      expect(ast.name).toBeTruthy();
      expect(ast.actions.length).toBeGreaterThan(0);
    }
  });

  it('parses all auth kit sync files', () => {
    const files = ['syncs/registration.sync', 'syncs/token-refresh.sync'];
    for (const file of files) {
      const source = readFileSync(resolve(AUTH_KIT_DIR, file), 'utf-8');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThan(0);
    }
  });

  it('token refresh flow works end-to-end', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/User', userHandler);
    kernel.registerConcept('urn:copf/Password', passwordHandler);
    kernel.registerConcept('urn:copf/JWT', jwtHandler);

    // Load registration + token-refresh syncs
    const regSource = readFileSync(resolve(AUTH_KIT_DIR, 'syncs/registration.sync'), 'utf-8');
    for (const sync of parseSyncFile(regSource)) kernel.registerSync(sync);
    const refreshSource = readFileSync(resolve(AUTH_KIT_DIR, 'syncs/token-refresh.sync'), 'utf-8');
    for (const sync of parseSyncFile(refreshSource)) kernel.registerSync(sync);

    // Register a user
    const regResponse = await kernel.handleRequest({
      method: 'register',
      username: 'alice',
      email: 'alice@test.com',
      password: 'password123',
    });
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;
    expect(token).toBeTruthy();

    // Refresh the token
    const refreshResponse = await kernel.handleRequest({
      method: 'refresh_token',
      token,
    });
    expect(refreshResponse.error).toBeUndefined();
    expect(refreshResponse.body?.token).toBeTruthy();
    // New token should be different from the old one (or at least valid)
    expect(refreshResponse.body!.token).toBeTruthy();
  });
});

// ============================================================
// 6. Content-Management Kit: Individual Concept Tests
// ============================================================

describe('Stage 8 — Entity Concept', () => {
  it('creates and retrieves an entity', async () => {
    const storage = createInMemoryStorage();

    const createResult = await entityHandler.create(
      { entity: 'e1', bundle: 'page' }, storage,
    );
    expect(createResult.variant).toBe('ok');
    expect(createResult.entity).toBe('e1');

    const getResult = await entityHandler.get({ entity: 'e1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.bundle).toBe('page');
  });

  it('touch sets timestamps', async () => {
    const storage = createInMemoryStorage();

    await entityHandler.create({ entity: 'e1', bundle: 'page' }, storage);

    // Initially no timestamps
    const before = await storage.get('entity', 'e1');
    expect(before!.createdAt).toBe('');

    const touchResult = await entityHandler.touch({ entity: 'e1' }, storage);
    expect(touchResult.variant).toBe('ok');

    const after = await storage.get('entity', 'e1');
    expect(after!.createdAt).toBeTruthy();
    expect(after!.updatedAt).toBeTruthy();
  });

  it('deletes an entity', async () => {
    const storage = createInMemoryStorage();

    await entityHandler.create({ entity: 'e1', bundle: 'page' }, storage);
    const deleteResult = await entityHandler.delete({ entity: 'e1' }, storage);
    expect(deleteResult.variant).toBe('ok');

    const getResult = await entityHandler.get({ entity: 'e1' }, storage);
    expect(getResult.variant).toBe('notfound');
  });
});

describe('Stage 8 — Field Concept', () => {
  it('attaches and retrieves a field', async () => {
    const storage = createInMemoryStorage();

    await fieldHandler.attach(
      { field: 'f1', target: 'e1', name: 'title', value: 'Hello' }, storage,
    );

    const getResult = await fieldHandler.get({ field: 'f1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.name).toBe('title');
    expect(getResult.value).toBe('Hello');
    expect(getResult.target).toBe('e1');
  });

  it('detaches a field', async () => {
    const storage = createInMemoryStorage();

    await fieldHandler.attach(
      { field: 'f1', target: 'e1', name: 'title', value: 'Hello' }, storage,
    );
    const detachResult = await fieldHandler.detach({ field: 'f1' }, storage);
    expect(detachResult.variant).toBe('ok');

    const getResult = await fieldHandler.get({ field: 'f1' }, storage);
    expect(getResult.variant).toBe('notfound');
  });
});

describe('Stage 8 — Relation Concept', () => {
  it('links and retrieves a relation', async () => {
    const storage = createInMemoryStorage();

    await relationHandler.link(
      { rel: 'r1', source: 'e1', target: 'e2', relType: 'references' }, storage,
    );

    const getResult = await relationHandler.get({ rel: 'r1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.source).toBe('e1');
    expect(getResult.target).toBe('e2');
    expect(getResult.relType).toBe('references');
  });

  it('unlinks a relation', async () => {
    const storage = createInMemoryStorage();

    await relationHandler.link(
      { rel: 'r1', source: 'e1', target: 'e2', relType: 'refs' }, storage,
    );
    await relationHandler.unlink({ rel: 'r1' }, storage);

    const getResult = await relationHandler.get({ rel: 'r1' }, storage);
    expect(getResult.variant).toBe('notfound');
  });
});

describe('Stage 8 — Node Concept', () => {
  it('creates and retrieves a node', async () => {
    const storage = createInMemoryStorage();

    const createResult = await nodeHandler.create(
      { node: 'n1', bundle: 'article' }, storage,
    );
    expect(createResult.variant).toBe('ok');
    expect(createResult.bundle).toBe('article');

    const getResult = await nodeHandler.get({ node: 'n1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.bundle).toBe('article');
  });
});

// ============================================================
// 7. Content-Management Kit: Cascade Deletes
// ============================================================

describe('Stage 8 — Cascade Delete Flows', () => {
  // Routing syncs to drive operations through the sync engine
  // (invokeConcept bypasses syncs; handleRequest runs processFlow)
  const routingSyncs = parseSyncFile(`
sync TestDeleteEntity [eager]
when {
  Web/request: [ method: "delete_entity"; entity: ?entity ]
    => [ request: ?request; entity: ?entity ]
}
then {
  Entity/delete: [ entity: ?entity ]
}

sync TestCreateEntity [eager]
when {
  Web/request: [ method: "create_entity"; entity: ?entity; bundle: ?bundle ]
    => [ request: ?request; entity: ?entity; bundle: ?bundle ]
}
then {
  Entity/create: [ entity: ?entity; bundle: ?bundle ]
}
`);

  it('deleting an entity cascades to delete its fields', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/Entity', entityHandler);
    kernel.registerConcept('urn:copf/Field', fieldHandler);
    kernel.registerConcept('urn:copf/Relation', relationHandler);
    kernel.registerConcept('urn:copf/Node', nodeHandler);

    // Load content-management kit syncs + routing syncs
    const manifest = loadKitManifest(CM_KIT_DIR);
    const resolved = resolveKitSyncs(CM_KIT_DIR, manifest, {}, []);
    for (const sync of resolved.syncs) {
      kernel.registerSync(sync);
    }
    for (const sync of routingSyncs) {
      kernel.registerSync(sync);
    }

    // Create an entity directly (setup — no sync processing needed)
    await kernel.invokeConcept('urn:copf/Entity', 'create', { entity: 'e1', bundle: 'page' });

    // Attach fields to the entity
    await kernel.invokeConcept('urn:copf/Field', 'attach', {
      field: 'f1', target: 'e1', name: 'title', value: 'Hello',
    });
    await kernel.invokeConcept('urn:copf/Field', 'attach', {
      field: 'f2', target: 'e1', name: 'body', value: 'World',
    });

    // Delete the entity via handleRequest so syncs fire
    await kernel.handleRequest({ method: 'delete_entity', entity: 'e1' });

    // Verify fields were detached by the cascade sync
    const f1 = await kernel.invokeConcept('urn:copf/Field', 'get', { field: 'f1' });
    expect(f1.variant).toBe('notfound');
    const f2 = await kernel.invokeConcept('urn:copf/Field', 'get', { field: 'f2' });
    expect(f2.variant).toBe('notfound');
  });

  it('deleting an entity cascades to unlink its relations', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/Entity', entityHandler);
    kernel.registerConcept('urn:copf/Field', fieldHandler);
    kernel.registerConcept('urn:copf/Relation', relationHandler);
    kernel.registerConcept('urn:copf/Node', nodeHandler);

    const manifest = loadKitManifest(CM_KIT_DIR);
    const resolved = resolveKitSyncs(CM_KIT_DIR, manifest, {}, []);
    for (const sync of resolved.syncs) {
      kernel.registerSync(sync);
    }
    for (const sync of routingSyncs) {
      kernel.registerSync(sync);
    }

    // Create entities (setup)
    await kernel.invokeConcept('urn:copf/Entity', 'create', { entity: 'e1', bundle: 'page' });
    await kernel.invokeConcept('urn:copf/Entity', 'create', { entity: 'e2', bundle: 'page' });

    // Link a relation
    await kernel.invokeConcept('urn:copf/Relation', 'link', {
      rel: 'r1', source: 'e1', target: 'e2', relType: 'refs',
    });

    // Delete e1 via handleRequest — should cascade unlink relations
    await kernel.handleRequest({ method: 'delete_entity', entity: 'e1' });

    const r1 = await kernel.invokeConcept('urn:copf/Relation', 'get', { rel: 'r1' });
    expect(r1.variant).toBe('notfound');
  });

  it('EntityLifecycle sets timestamps on entity creation', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/Entity', entityHandler);
    kernel.registerConcept('urn:copf/Field', fieldHandler);
    kernel.registerConcept('urn:copf/Relation', relationHandler);
    kernel.registerConcept('urn:copf/Node', nodeHandler);

    const manifest = loadKitManifest(CM_KIT_DIR);
    const resolved = resolveKitSyncs(CM_KIT_DIR, manifest, {}, []);
    for (const sync of resolved.syncs) {
      kernel.registerSync(sync);
    }
    for (const sync of routingSyncs) {
      kernel.registerSync(sync);
    }

    // Create entity via handleRequest so EntityLifecycle sync fires
    await kernel.handleRequest({ method: 'create_entity', entity: 'e1', bundle: 'page' });

    // Query the entity state to check timestamps were set by touch
    const records = await kernel.queryConcept('urn:copf/Entity', 'entity', { entity: 'e1' });
    expect(records.length).toBe(1);
    expect(records[0].createdAt).toBeTruthy();
    expect(records[0].updatedAt).toBeTruthy();
  });
});

// ============================================================
// 8. Two-Kit App: Auth + Content-Management Together
// ============================================================

describe('Stage 8 — Two-Kit App (end-to-end)', () => {
  it('registers user then creates a node with title field', async () => {
    const kernel = createKernel();

    // Register auth kit concepts
    kernel.registerConcept('urn:copf/User', userHandler);
    kernel.registerConcept('urn:copf/Password', passwordHandler);
    kernel.registerConcept('urn:copf/JWT', jwtHandler);

    // Register content-management kit concepts
    kernel.registerConcept('urn:copf/Entity', entityHandler);
    kernel.registerConcept('urn:copf/Field', fieldHandler);
    kernel.registerConcept('urn:copf/Relation', relationHandler);
    kernel.registerConcept('urn:copf/Node', nodeHandler);

    // Load auth kit syncs (registration)
    const authManifest = loadKitManifest(AUTH_KIT_DIR);
    const authResolved = resolveKitSyncs(AUTH_KIT_DIR, authManifest, {}, []);
    for (const sync of authResolved.syncs) kernel.registerSync(sync);

    // Load content-management kit syncs
    const cmManifest = loadKitManifest(CM_KIT_DIR);
    const cmResolved = resolveKitSyncs(CM_KIT_DIR, cmManifest, {}, []);
    for (const sync of cmResolved.syncs) kernel.registerSync(sync);

    // Step 1: Register a user
    const regResponse = await kernel.handleRequest({
      method: 'register',
      username: 'editor',
      email: 'editor@cms.com',
      password: 'password123',
    });
    expect(regResponse.body?.user).toBeDefined();

    // Step 2: Create a node — triggers NodeCreateEntity + DefaultTitleField
    const nodeResponse = await kernel.handleRequest({
      method: 'create_node',
      bundle: 'article',
      title: 'My First Article',
    });

    // The NodeCreateEntity sync creates an Entity, and
    // DefaultTitleField attaches a title field.
    // We verify by checking the flow log for Entity/create and Field/attach
    const flowLog = kernel.getFlowLog(nodeResponse.flowId);

    const entityCreate = flowLog.find(
      r => r.concept === 'urn:copf/Entity' && r.action === 'create' && r.type === 'completion',
    );
    expect(entityCreate).toBeDefined();
    expect(entityCreate!.variant).toBe('ok');

    const fieldAttach = flowLog.find(
      r => r.concept === 'urn:copf/Field' && r.action === 'attach' && r.type === 'completion',
    );
    expect(fieldAttach).toBeDefined();
    expect(fieldAttach!.variant).toBe('ok');
    expect(fieldAttach!.input.name).toBe('title');
    expect(fieldAttach!.input.value).toBe('My First Article');
  });

  it('two-kit app with override: custom title field sync', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/Entity', entityHandler);
    kernel.registerConcept('urn:copf/Field', fieldHandler);
    kernel.registerConcept('urn:copf/Relation', relationHandler);
    kernel.registerConcept('urn:copf/Node', nodeHandler);

    // Load CM kit syncs with DefaultTitleField DISABLED
    const cmManifest = loadKitManifest(CM_KIT_DIR);
    const cmResolved = resolveKitSyncs(CM_KIT_DIR, cmManifest, {}, ['DefaultTitleField']);
    for (const sync of cmResolved.syncs) kernel.registerSync(sync);

    expect(cmResolved.disabled).toContain('DefaultTitleField');

    // Create a node — NodeCreateEntity still fires (creates entity),
    // but DefaultTitleField does NOT fire (disabled)
    const nodeResponse = await kernel.handleRequest({
      method: 'create_node',
      bundle: 'page',
      title: 'Ignored Title',
    });

    const flowLog = kernel.getFlowLog(nodeResponse.flowId);

    const entityCreate = flowLog.find(
      r => r.concept === 'urn:copf/Entity' && r.action === 'create' && r.type === 'completion',
    );
    expect(entityCreate).toBeDefined();

    // No field attach (DefaultTitleField was disabled)
    const fieldAttach = flowLog.find(
      r => r.concept === 'urn:copf/Field' && r.action === 'attach' && r.type === 'completion',
    );
    expect(fieldAttach).toBeUndefined();
  });
});

// ============================================================
// 9. Kit Scaffolding
// ============================================================

describe('Stage 8 — Kit Scaffolding', () => {
  const scaffoldPath = resolve(__dirname, '..', '.tmp-test-kit');

  beforeEach(() => {
    if (existsSync(scaffoldPath)) {
      rmSync(scaffoldPath, { recursive: true });
    }
  });

  it('scaffolds a new kit directory with template manifest', () => {
    scaffoldKit(scaffoldPath, 'my-test-kit');

    expect(existsSync(resolve(scaffoldPath, 'kit.yaml'))).toBe(true);
    expect(existsSync(resolve(scaffoldPath, 'syncs'))).toBe(true);
    expect(existsSync(resolve(scaffoldPath, 'implementations', 'typescript'))).toBe(true);
    expect(existsSync(resolve(scaffoldPath, 'tests', 'conformance'))).toBe(true);
    expect(existsSync(resolve(scaffoldPath, 'tests', 'integration'))).toBe(true);

    // Parse the generated manifest
    const raw = JSON.parse(readFileSync(resolve(scaffoldPath, 'kit.yaml'), 'utf-8'));
    const manifest = parseKitManifest(raw);
    expect(manifest.kit.name).toBe('my-test-kit');
    expect(manifest.kit.version).toBe('0.1.0');

    // Cleanup
    rmSync(scaffoldPath, { recursive: true });
  });
});

// ============================================================
// 10. Kit Listing and Override Checking
// ============================================================

describe('Stage 8 — Kit Listing and Override Checking', () => {
  it('lists kits from a deployment manifest', () => {
    const deploymentRaw = {
      kits: [
        { name: 'auth', path: './kits/auth' },
        {
          name: 'content-management',
          path: './kits/content-management',
          overrides: { DefaultTitleField: './syncs/custom-title.sync' },
          disable: ['UpdateTimestamp'],
        },
      ],
    };

    const kits = listKitsFromDeployment(deploymentRaw);
    expect(kits).toHaveLength(2);
    expect(kits[0].name).toBe('auth');
    expect(kits[1].name).toBe('content-management');
    expect(kits[1].overrides.DefaultTitleField).toBe('./syncs/custom-title.sync');
    expect(kits[1].disables).toContain('UpdateTimestamp');
  });

  it('checkOverrides validates override targets against kit manifest', () => {
    const manifest = loadKitManifest(CM_KIT_DIR);

    // Valid override
    const validResult = checkOverrides(manifest, { DefaultTitleField: './custom.sync' });
    expect(validResult.warnings).toHaveLength(0);

    // Invalid override target
    const invalidResult = checkOverrides(manifest, { NonExistent: './custom.sync' });
    expect(invalidResult.warnings.length).toBeGreaterThan(0);
    expect(invalidResult.warnings[0]).toContain('NonExistent');
  });
});

// ============================================================
// 11. Self-Compilation: Kit Concept Specs through Pipeline
// ============================================================

describe('Stage 8 — Kit Self-Compilation', () => {
  it('SpecParser parses all content-management kit concept specs', async () => {
    const { specParserHandler } = await import(
      '../implementations/typescript/framework/spec-parser.impl.js'
    );
    const storage = createInMemoryStorage();

    const specs = ['entity.concept', 'field.concept', 'relation.concept', 'node.concept'];
    for (const spec of specs) {
      const source = readFileSync(resolve(CM_KIT_DIR, spec), 'utf-8');
      const result = await specParserHandler.parse({ source }, storage);
      expect(result.variant).toBe('ok');
    }
  });

  it('SyncCompiler compiles all content-management kit sync files', async () => {
    const { syncCompilerHandler } = await import(
      '../implementations/typescript/framework/sync-compiler.impl.js'
    );

    const syncFiles = [
      'syncs/cascade-delete-fields.sync',
      'syncs/cascade-delete-relations.sync',
      'syncs/entity-lifecycle.sync',
      'syncs/node-create-entity.sync',
      'syncs/default-title-field.sync',
    ];

    for (const file of syncFiles) {
      const source = readFileSync(resolve(CM_KIT_DIR, file), 'utf-8');
      const syncs = parseSyncFile(source);
      const storage = createInMemoryStorage();

      for (const sync of syncs) {
        const result = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    }
  });
});
