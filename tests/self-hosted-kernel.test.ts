// ============================================================
// Self-Hosted Kernel Tests
//
// Validates the self-hosted kernel — echo flow, registration
// flow, compiler pipeline, direct invocation, and the
// refactored pipeline.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createSelfHostedKernel,
  createInMemoryStorage,
  createConceptRegistry,
} from '../runtime/index.js';
import { createKernel } from '../handlers/ts/framework/kernel-factory.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import type {
  ConceptHandler,
  ConceptAST,
  ConceptManifest,
} from '../runtime/types.js';

// Framework concept handlers
import { specParserHandler } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { actionLogHandler } from '../handlers/ts/framework/action-log.handler.js';
import { registryHandler } from '../handlers/ts/framework/registry.handler.js';

// SyncEngine concept handler
import { createSyncEngineHandler } from '../handlers/ts/framework/sync-engine.handler.js';

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

describe('Self-Hosted Kernel: Echo Flow', () => {
  // Echo concept handler (same as used in echo flow tests)
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

  it('processes echo flow identically to basic kernel', async () => {
    // Set up self-hosted kernel
    const kernel = setupSelfHostedKernel();

    // Register Echo concept
    kernel.registerConcept('urn:clef/Echo', echoHandler);

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

    // Verify response matches basic kernel behavior
    expect(response.body).toBeDefined();
    expect(response.body!.echo).toBe('hello world');
    expect(response.flowId).toBeTruthy();
  });

  it('matches basic kernel echo response exactly', async () => {
    // Run through basic kernel
    const basicKernel = createKernel();
    basicKernel.registerConcept('urn:clef/Echo', echoHandler);
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'app', 'echo.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      basicKernel.registerSync(sync);
    }
    const basicResponse = await basicKernel.handleRequest({
      method: 'echo',
      text: 'test-message',
    });

    // Run through self-hosted kernel
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const selfHosted = createSelfHostedKernel(handler, log, registry);
    selfHosted.registerConcept('urn:clef/Echo', echoHandler);
    for (const sync of syncs) {
      selfHosted.registerSync(sync);
    }
    const selfHostedResponse = await selfHosted.handleRequest({
      method: 'echo',
      text: 'test-message',
    });

    // Body content should be identical
    expect(selfHostedResponse.body).toEqual(basicResponse.body);
  });
});

// ============================================================
// 2. Self-Hosted Kernel — Registration Flow
// ============================================================

describe('Self-Hosted Kernel: Registration Flow', () => {
  // Concept handlers (same as registration flow tests)
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

    kernel.registerConcept('urn:clef/User', userHandler);
    kernel.registerConcept('urn:clef/Password', passwordHandler);
    kernel.registerConcept('urn:clef/JWT', jwtHandler);

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

  it('matches basic kernel valid registration response', async () => {
    // Basic kernel
    const basicKernel = createKernel();
    basicKernel.registerConcept('urn:clef/User', userHandler);
    basicKernel.registerConcept('urn:clef/Password', passwordHandler);
    basicKernel.registerConcept('urn:clef/JWT', jwtHandler);
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'app', 'registration.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      basicKernel.registerSync(sync);
    }
    const s0 = await basicKernel.handleRequest({
      method: 'register',
      username: 'dave',
      email: 'dave@example.com',
      password: 'password123',
    });

    // Self-hosted kernel
    const selfHosted = setupRegistrationKernel();
    const s3 = await selfHosted.handleRequest({
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

describe('Self-Hosted Kernel: Compiler Pipeline', () => {
  it('compiler pipeline works through the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    // Register framework concepts
    kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
    kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:clef/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:clef/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:clef/Registry', registryHandler);

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
      'urn:clef/SpecParser',
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

describe('Self-Hosted Kernel: Direct Invocation', () => {
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

    kernel.registerConcept('urn:clef/Echo', echoHandler);

    const result = await kernel.invokeConcept(
      'urn:clef/Echo',
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

    kernel.registerConcept('urn:clef/Registry', registryHandler);

    // Register a concept through the Registry
    await kernel.invokeConcept(
      'urn:clef/Registry',
      'register',
      { uri: 'urn:app/Test', transport: { type: 'in-process' } },
    );

    // Query the registry
    const results = await kernel.queryConcept(
      'urn:clef/Registry',
      'concepts',
    );

    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 5. Self-Hosted Kernel — Refactored Pipeline
// ============================================================

describe('Self-Hosted Kernel: Refactored Pipeline', () => {
  it('compiler pipeline works through the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    // Register framework concepts (with TypeScriptGen replacing CodeGen)
    kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
    kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:clef/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:clef/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:clef/Registry', registryHandler);

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
      'urn:clef/SpecParser',
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
    expect(manifest.actions).toHaveLength(2);
    const generateAction = manifest.actions.find(a => a.name === 'generate')!;
    expect(generateAction).toBeDefined();
    expect(generateAction.variants[0].tag).toBe('ok');
    expect(generateAction.variants[0].fields[0].name).toBe('manifest');

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
