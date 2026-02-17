// ============================================================
// Self-Hosted Kernel Tests
//
// Validates the self-hosted kernel — echo flow, registration
// flow, compiler pipeline, direct invocation, and the
// refactored pipeline from Stage 4.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createSelfHostedKernel,
  createInMemoryStorage,
  createConceptRegistry,
} from '../kernel/src/index.js';
import { createKernel } from '../implementations/typescript/framework/kernel-factory.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';
import type {
  ConceptHandler,
  ConceptAST,
  ConceptManifest,
} from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { actionLogHandler } from '../implementations/typescript/framework/action-log.impl.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';

// Stage 3: SyncEngine concept handler
import { createSyncEngineHandler } from '../implementations/typescript/framework/sync-engine.impl.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// Helper: run SchemaGen on an AST and return the manifest
async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate(
    { spec: 'test', ast },
    storage,
  );
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

// ============================================================
// 1. Self-Hosted Kernel — Echo Flow
// ============================================================

describe('Stage 3 — Self-Hosted Kernel: Echo Flow', () => {
  // Echo concept handler (same as used in Stage 0 tests)
  const echoHandler: ConceptHandler = {
    async send(input, storage) {
      const id = input.id as string;
      const text = input.text as string;
      await storage.put('messages', id, { id, text });
      return { variant: 'ok', id, echo: text };
    },
  };

  function setupSelfHostedKernel() {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);
    return kernel;
  }

  it('processes echo flow identically to Stage 0', async () => {
    // Set up self-hosted kernel
    const kernel = setupSelfHostedKernel();

    // Register Echo concept
    kernel.registerConcept('urn:copf/Echo', echoHandler);

    // Load echo syncs
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'app', 'echo.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    // Send a request
    const response = await kernel.handleRequest({
      method: 'echo',
      text: 'hello world',
    });

    // Verify response matches Stage 0 behavior
    expect(response.body).toBeDefined();
    expect(response.body!.echo).toBe('hello world');
    expect(response.flowId).toBeTruthy();
  });

  it('matches Stage 0 kernel echo response exactly', async () => {
    // Run through Stage 0 kernel
    const stage0 = createKernel();
    stage0.registerConcept('urn:copf/Echo', echoHandler);
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'app', 'echo.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      stage0.registerSync(sync);
    }
    const stage0Response = await stage0.handleRequest({
      method: 'echo',
      text: 'test-message',
    });

    // Run through self-hosted kernel
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const stage3 = createSelfHostedKernel(handler, log, registry);
    stage3.registerConcept('urn:copf/Echo', echoHandler);
    for (const sync of syncs) {
      stage3.registerSync(sync);
    }
    const stage3Response = await stage3.handleRequest({
      method: 'echo',
      text: 'test-message',
    });

    // Body content should be identical
    expect(stage3Response.body).toEqual(stage0Response.body);
  });
});

// ============================================================
// 2. Self-Hosted Kernel — Registration Flow
// ============================================================

describe('Stage 3 — Self-Hosted Kernel: Registration Flow', () => {
  // Concept handlers (same as Stage 0 tests)
  const userHandler: ConceptHandler = {
    async register(input, storage) {
      const user = input.user as string;
      const name = input.name as string;
      const email = input.email as string;

      // Check for duplicate name
      const existing = await storage.find('user', { name });
      if (existing.length > 0) {
        return { variant: 'error', message: 'name already taken' };
      }

      await storage.put('user', user, { user, name, email });
      return { variant: 'ok', user };
    },
  };

  const passwordHandler: ConceptHandler = {
    async validate(input, _storage) {
      const password = input.password as string;
      if (!password || password.length < 8) {
        return { variant: 'ok', valid: false };
      }
      return { variant: 'ok', valid: true };
    },
    async set(input, storage) {
      const user = input.user as string;
      const password = input.password as string;
      await storage.put('passwords', user, { user, hash: `hash:${password}` });
      return { variant: 'ok', user };
    },
    async check(input, storage) {
      const user = input.user as string;
      const password = input.password as string;
      const stored = await storage.get('passwords', user);
      if (!stored) return { variant: 'notfound', message: 'No credentials' };
      return { variant: 'ok', valid: stored.hash === `hash:${password}` };
    },
  };

  const jwtHandler: ConceptHandler = {
    async generate(input, storage) {
      const user = input.user as string;
      const token = `jwt:${user}:${Date.now()}`;
      await storage.put('tokens', user, { user, token });
      return { variant: 'ok', token };
    },
    async verify(input, storage) {
      const token = input.token as string;
      const parts = token.split(':');
      if (parts.length < 2) return { variant: 'error', message: 'Invalid token' };
      return { variant: 'ok', user: parts[1] };
    },
  };

  function setupRegistrationKernel() {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    kernel.registerConcept('urn:copf/User', userHandler);
    kernel.registerConcept('urn:copf/Password', passwordHandler);
    kernel.registerConcept('urn:copf/JWT', jwtHandler);

    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'app', 'registration.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    return kernel;
  }

  it('valid registration produces user + token response', async () => {
    const kernel = setupRegistrationKernel();

    const response = await kernel.handleRequest({
      method: 'register',
      username: 'alice',
      email: 'alice@example.com',
      password: 'securepass123',
    });

    expect(response.body).toBeDefined();
    // The sync nests user data under body.user
    const user = response.body!.user as Record<string, unknown>;
    expect(user).toBeDefined();
    expect(user.username).toBe('alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.token).toBeTruthy();
    expect(response.code).toBeUndefined();
  });

  it('weak password is rejected', async () => {
    const kernel = setupRegistrationKernel();

    const response = await kernel.handleRequest({
      method: 'register',
      username: 'bob',
      email: 'bob@example.com',
      password: 'short',
    });

    expect(response.body).toBeDefined();
    expect(response.error || response.body!.error || response.code).toBeTruthy();
  });

  it('duplicate username is rejected', async () => {
    const kernel = setupRegistrationKernel();

    // First registration
    await kernel.handleRequest({
      method: 'register',
      username: 'carol',
      email: 'carol@example.com',
      password: 'password123',
    });

    // Second registration with same username
    const response = await kernel.handleRequest({
      method: 'register',
      username: 'carol',
      email: 'carol2@example.com',
      password: 'password456',
    });

    // Should be rejected
    expect(response.body).toBeDefined();
    expect(response.error || response.body!.error || response.code).toBeTruthy();
  });

  it('matches Stage 0 kernel valid registration response', async () => {
    // Stage 0
    const stage0 = createKernel();
    stage0.registerConcept('urn:copf/User', userHandler);
    stage0.registerConcept('urn:copf/Password', passwordHandler);
    stage0.registerConcept('urn:copf/JWT', jwtHandler);
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'app', 'registration.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      stage0.registerSync(sync);
    }
    const s0 = await stage0.handleRequest({
      method: 'register',
      username: 'dave',
      email: 'dave@example.com',
      password: 'password123',
    });

    // Stage 3
    const stage3 = setupRegistrationKernel();
    const s3 = await stage3.handleRequest({
      method: 'register',
      username: 'dave',
      email: 'dave@example.com',
      password: 'password123',
    });

    // Both should return the same nested structure
    const s3User = s3.body!.user as Record<string, unknown>;
    const s0User = s0.body!.user as Record<string, unknown>;
    expect(s3User.username).toBe(s0User.username);
    expect(s3User.email).toBe(s0User.email);
    // Both should have a token
    expect(s3User.token).toBeTruthy();
    expect(s0User.token).toBeTruthy();
  });
});

// ============================================================
// 3. Self-Hosted Kernel — Compiler Pipeline
// ============================================================

describe('Stage 3 — Self-Hosted Kernel: Compiler Pipeline', () => {
  it('compiler pipeline works through the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    // Register Stage 1 concepts
    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    // Load compiler pipeline syncs
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    // Parse a spec through the pipeline
    const passwordSpec = readSpec('app', 'password');
    const result = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('Password');
    expect((result.ast as ConceptAST).actions).toHaveLength(3);
  });
});

// ============================================================
// 4. Self-Hosted Kernel — Direct Invocation
// ============================================================

describe('Stage 3 — Self-Hosted Kernel: Direct Invocation', () => {
  it('invokeConcept works for concepts on the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    const echoHandler: ConceptHandler = {
      async send(input, storage) {
        const text = input.text as string;
        return { variant: 'ok', echo: text };
      },
    };

    kernel.registerConcept('urn:copf/Echo', echoHandler);

    const result = await kernel.invokeConcept(
      'urn:copf/Echo',
      'send',
      { id: '1', text: 'hello' },
    );

    expect(result.variant).toBe('ok');
    expect(result.echo).toBe('hello');
  });

  it('queryConcept works for concepts on the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    kernel.registerConcept('urn:copf/Registry', registryHandler);

    // Register a concept through the Registry
    await kernel.invokeConcept(
      'urn:copf/Registry',
      'register',
      { uri: 'urn:app/Test', transport: { type: 'in-process' } },
    );

    // Query the registry
    const results = await kernel.queryConcept(
      'urn:copf/Registry',
      'concepts',
    );

    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 5. Self-Hosted Kernel — Refactored Pipeline (Stage 4)
// ============================================================

describe('Stage 4 — Self-Hosted Kernel: Refactored Pipeline', () => {
  it('compiler pipeline works through the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    // Register Stage 1 concepts (with TypeScriptGen replacing CodeGen)
    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    // Load the refactored compiler pipeline syncs
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    // Parse a spec through the new pipeline
    const passwordSpec = readSpec('app', 'password');
    const result = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('Password');
  });

  it('full pipeline produces manifest for framework spec', async () => {
    const storage = createInMemoryStorage();

    // SpecParser → SchemaGen → TypeScriptGen (manual pipeline)
    const source = readSpec('framework', 'schema-gen');
    const parseResult = await specParserHandler.parse({ source }, storage);
    expect(parseResult.variant).toBe('ok');

    const manifest = await generateManifest(parseResult.ast as ConceptAST);

    // Verify the SchemaGen manifest describes itself
    expect(manifest.name).toBe('SchemaGen');
    expect(manifest.actions).toHaveLength(1);
    expect(manifest.actions[0].name).toBe('generate');
    expect(manifest.actions[0].variants[0].tag).toBe('ok');
    expect(manifest.actions[0].variants[0].fields[0].name).toBe('manifest');

    // Generate TypeScript from the manifest
    const genResult = await typescriptGenHandler.generate(
      { spec: 'sg-1', manifest },
      storage,
    );
    expect(genResult.variant).toBe('ok');

    const files = genResult.files as { path: string; content: string }[];
    expect(files.find(f => f.path === 'schemagen.handler.ts')).toBeDefined();
    expect(files.find(f => f.path === 'schemagen.types.ts')).toBeDefined();
    expect(files.find(f => f.path === 'schemagen.adapter.ts')).toBeDefined();
  });
});
