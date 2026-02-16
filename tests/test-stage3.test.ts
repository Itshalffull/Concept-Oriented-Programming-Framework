// ============================================================
// Stage 3 — Engine Self-Hosting Tests
//
// From Section 10.1:
// "Replace the Stage 0 kernel engine with a concept-based engine.
//  The SyncEngine concept is itself run by the kernel engine.
//  This is the key bootstrapping moment: the SyncEngine concept
//  processes completions and emits invocations, while the kernel
//  merely dispatches between it and the other concepts."
//
// From Section 10.3 — What stays in the kernel forever:
// - Process entry point
// - Message dispatch
// - Transport adapter instantiation
//
// These tests verify that:
// 1. The SyncEngine concept spec parses correctly
// 2. The SyncEngine concept handler works as a proper concept
// 3. The self-hosted kernel produces identical results to Stage 0
// 4. The echo and registration flows work through the self-hosted kernel
// 5. The full Stage 1 compiler pipeline works on the self-hosted kernel
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createSelfHostedKernel,
  createInMemoryStorage,
  createConceptRegistry,
  parseConceptFile,
  parseSyncFile,
} from '../kernel/src/index.js';
import type {
  ConceptHandler,
  ConceptAST,
  CompiledSync,
  ActionCompletion,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { codeGenHandler } from '../implementations/typescript/framework/code-gen.impl.js';
import { actionLogHandler } from '../implementations/typescript/framework/action-log.impl.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';

// Stage 3: SyncEngine concept handler
import { createSyncEngineHandler } from '../implementations/typescript/framework/sync-engine.impl.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// ============================================================
// 1. SyncEngine Concept Spec
// ============================================================

describe('Stage 3 — SyncEngine Concept Spec', () => {
  it('parses the SyncEngine concept spec', () => {
    const source = readSpec('framework', 'sync-engine');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('SyncEngine');
    expect(ast.typeParams).toEqual(['F']);
    expect(ast.state).toHaveLength(2); // syncs, pendingFlows
    expect(ast.actions).toHaveLength(3); // registerSync, onCompletion, evaluateWhere

    expect(ast.actions[0].name).toBe('registerSync');
    expect(ast.actions[0].variants).toHaveLength(1); // ok

    expect(ast.actions[1].name).toBe('onCompletion');
    expect(ast.actions[1].variants).toHaveLength(1); // ok

    expect(ast.actions[2].name).toBe('evaluateWhere');
    expect(ast.actions[2].variants).toHaveLength(2); // ok, error
  });

  it('SpecParser concept parses its own SyncEngine spec', async () => {
    const storage = createInMemoryStorage();
    const source = readSpec('framework', 'sync-engine');
    const result = await specParserHandler.parse({ source }, storage);

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('SyncEngine');
  });
});

// ============================================================
// 2. SyncEngine Concept Handler
// ============================================================

describe('Stage 3 — SyncEngine Concept Handler', () => {
  it('registerSync stores a sync definition', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    const sync: CompiledSync = {
      name: 'TestSync',
      when: [{
        concept: 'urn:copf/Test',
        action: 'do',
        inputFields: [],
        outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/Other',
        action: 'respond',
        fields: [],
      }],
    };

    const result = await handler.registerSync({ sync }, storage);
    expect(result.variant).toBe('ok');
  });

  it('onCompletion returns empty invocations when no syncs match', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Unknown',
      action: 'nothing',
      input: {},
      variant: 'ok',
      output: {},
      flow: generateId(),
      timestamp: timestamp(),
    };

    const result = await handler.onCompletion({ completion }, storage);
    expect(result.variant).toBe('ok');
    expect(result.invocations).toEqual([]);
  });

  it('onCompletion produces invocations when a sync matches', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    // Register a simple sync: when Test/do completes, invoke Other/respond
    const sync: CompiledSync = {
      name: 'TestReact',
      when: [{
        concept: 'urn:copf/Test',
        action: 'do',
        inputFields: [],
        outputFields: [{ name: 'value', match: { type: 'variable', name: 'val' } }],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/Other',
        action: 'respond',
        fields: [{ name: 'data', value: { type: 'variable', name: 'val' } }],
      }],
    };

    await handler.registerSync({ sync }, storage);

    // Feed a matching completion
    const flowId = generateId();
    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Test',
      action: 'do',
      input: {},
      variant: 'ok',
      output: { value: 'hello' },
      flow: flowId,
      timestamp: timestamp(),
    };

    const result = await handler.onCompletion({ completion }, storage);
    expect(result.variant).toBe('ok');

    const invocations = result.invocations as any[];
    expect(invocations).toHaveLength(1);
    expect(invocations[0].concept).toBe('urn:copf/Other');
    expect(invocations[0].action).toBe('respond');
    expect(invocations[0].input.data).toBe('hello');
    expect(invocations[0].flow).toBe(flowId);
    expect(invocations[0].sync).toBe('TestReact');
  });

  it('onCompletion does not re-fire a sync for the same completion', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    const sync: CompiledSync = {
      name: 'OnceOnly',
      when: [{
        concept: 'urn:copf/A',
        action: 'x',
        inputFields: [],
        outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/B',
        action: 'y',
        fields: [],
      }],
    };

    await handler.registerSync({ sync }, storage);

    const flowId = generateId();
    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/A',
      action: 'x',
      input: {},
      variant: 'ok',
      output: {},
      flow: flowId,
      timestamp: timestamp(),
    };

    // First call should produce invocations
    const r1 = await handler.onCompletion({ completion }, storage);
    expect((r1.invocations as any[]).length).toBe(1);

    // Second call with same completion should not re-fire
    const r2 = await handler.onCompletion({ completion }, storage);
    expect((r2.invocations as any[]).length).toBe(0);
  });
});

// ============================================================
// 3. Self-Hosted Kernel — Echo Flow
//
// Verify that the echo flow produces the same result when
// running through the self-hosted kernel as through Stage 0.
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
// 4. Self-Hosted Kernel — Registration Flow
//
// The full multi-concept registration flow from Stage 0 Test B,
// now running through the self-hosted kernel.
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
// 5. Self-Hosted Kernel — Stage 1 Compiler Pipeline
//
// The Stage 1 compiler pipeline (SpecParser → SchemaGen → CodeGen)
// running on the self-hosted kernel.
// ============================================================

describe('Stage 3 — Self-Hosted Kernel: Compiler Pipeline', () => {
  it('compiler pipeline works through the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    // Register Stage 1 concepts
    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/CodeGen', codeGenHandler);
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
// 6. Direct Concept Invocation on Self-Hosted Kernel
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
