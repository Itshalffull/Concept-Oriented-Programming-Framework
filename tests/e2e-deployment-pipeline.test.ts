// ============================================================
// E2E Tests — Full Deployment Pipeline
//
// End-to-end tests that verify the complete deployment flow:
// concept compilation → deployment manifest creation →
// validation → plan generation → handler wiring for all five
// deployment topologies (AWS Event-Driven, AWS Persistent,
// GCP Event-Driven, GCP Persistent, Hybrid PostgreSQL).
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { specParserHandler } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import {
  parseDeploymentManifest,
  validateDeploymentManifest,
  deploymentValidatorHandler,
} from '../handlers/ts/framework/deployment-validator.handler.js';
import type { DeploymentManifest } from '../handlers/ts/framework/deployment-validator.handler.js';
import {
  createHttpLambdaHandler,
  createSqsLambdaHandler,
} from '../infrastructure/serverless/lambda-handler.js';
import type { APIGatewayEvent, SQSEvent } from '../infrastructure/serverless/lambda-handler.js';
import {
  createHttpGCFHandler,
  createPubSubGCFHandler,
} from '../infrastructure/serverless/gcf-handler.js';
import type {
  GCFHttpRequest,
  GCFHttpResponse,
  PubSubMessage,
  PubSubContext,
} from '../infrastructure/serverless/gcf-handler.js';
import type {
  ConceptAST,
  ConceptManifest,
  ConceptHandler,
  ActionCompletion,
  ActionInvocation,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate(
    { spec: 'test', ast },
    storage,
  );
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

// Simulated concept handlers for deployment testing
function createPasswordHandler(): ConceptHandler {
  return {
    async set(input, storage) {
      const user = input.user as string;
      const password = input.password as string;
      if (!password || password.length < 6) {
        return { variant: 'invalid', message: 'Password too short' };
      }
      await storage.put('entries', user, {
        u: user,
        hash: `hash_${password}`,
        salt: `salt_${user}`,
      });
      return { variant: 'ok', user };
    },
    async check(input, storage) {
      const user = input.user as string;
      const password = input.password as string;
      const entry = await storage.get('entries', user);
      if (!entry) {
        return { variant: 'notfound', message: `No entry for ${user}` };
      }
      const valid = entry.hash === `hash_${password}`;
      return { variant: 'ok', valid };
    },
    async validate(input, _storage) {
      const password = input.password as string;
      return { variant: 'ok', valid: password.length >= 6 };
    },
  };
}

function createProfileHandler(): ConceptHandler {
  return {
    async create(input, storage) {
      const user = input.user as string;
      await storage.put('profiles', user, {
        user,
        bio: input.bio || '',
        image: input.image || '',
      });
      return { variant: 'ok', user };
    },
    async get(input, storage) {
      const user = input.user as string;
      const profile = await storage.get('profiles', user);
      if (!profile) {
        return { variant: 'notfound', message: `Profile for ${user} not found` };
      }
      return { variant: 'ok', ...profile };
    },
  };
}

function createInvocation(overrides?: Partial<ActionInvocation>): ActionInvocation {
  return {
    id: generateId(),
    concept: 'Password',
    action: 'set',
    input: { user: 'alice', password: 'secret123' },
    flow: 'e2e-flow',
    timestamp: timestamp(),
    ...overrides,
  };
}

function createMockGCFResponse() {
  let responseCode = 0;
  let responseBody: any = null;
  const res: GCFHttpResponse = {
    status(code) { responseCode = code; return res; },
    json(data) { responseBody = data; },
    send(_body) {},
    set(_header, _value) { return res; },
  };
  return { res, getCode: () => responseCode, getBody: () => responseBody };
}

function createPubSubContext(): PubSubContext {
  return {
    eventId: 'evt-e2e',
    timestamp: new Date().toISOString(),
    eventType: 'google.pubsub.topic.publish',
    resource: { service: 'pubsub.googleapis.com', name: 'test-topic' },
  };
}

// ============================================================
// 1. E2E: Compile Concepts → Create Deployment → Validate → Wire Handlers
// ============================================================

describe('E2E Deployment Pipeline — AWS Event-Driven', () => {
  it('full pipeline: compile concepts, validate deployment, wire SQS handlers', async () => {
    // Step 1: Compile Password concept
    const pwdSource = readSpec('app', 'password');
    const pwdStorage = createInMemoryStorage();
    const pwdParseResult = await specParserHandler.parse({ source: pwdSource }, pwdStorage);
    expect(pwdParseResult.variant).toBe('ok');
    const pwdAst = pwdParseResult.ast as ConceptAST;
    const pwdManifest = await generateManifest(pwdAst);
    expect(pwdManifest.name).toBe('Password');
    expect(pwdManifest.capabilities).toContain('crypto');

    // Step 2: Create and validate AWS event-driven deployment manifest
    const manifest: DeploymentManifest = {
      app: { name: 'conduit', version: '0.1.0', uri: 'urn:conduit' },
      runtimes: {
        concepts: {
          type: 'aws-lambda',
          engine: false,
          transport: 'sqs',
          upstream: 'engine',
          storage: 'dynamodb',
        },
        engine: {
          type: 'aws-lambda',
          engine: true,
          transport: 'sqs',
          storage: 'dynamodb',
          actionLog: 'dynamodb',
        },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'impls/password.ts',
            runtime: 'concepts',
            storage: 'dynamodb',
            queryMode: 'lite',
          }],
        },
      },
      syncs: [{
        path: 'syncs/auth.sync',
        engine: 'engine',
        annotations: ['eager'],
      }],
    };

    const validationResult = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );
    expect(validationResult.valid).toBe(true);
    expect(validationResult.plan!.conceptPlacements).toHaveLength(1);
    expect(validationResult.plan!.conceptPlacements[0].transport).toBe('sqs');

    // Step 3: Wire the SQS handler and process invocations
    const published: ActionCompletion[] = [];
    const sqsHandler = createSqsLambdaHandler({
      conceptName: 'Password',
      handler: createPasswordHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(c) { published.push(c); },
      },
    });

    // Process a set action
    const setInvocation = createInvocation();
    const event: SQSEvent = {
      Records: [{
        messageId: 'msg-e2e-1',
        body: JSON.stringify(setInvocation),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:password-queue',
      }],
    };
    const sqsResult = await sqsHandler(event);
    expect(sqsResult.batchItemFailures).toHaveLength(0);
    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
    expect(published[0].output.user).toBe('alice');
  });
});

describe('E2E Deployment Pipeline — AWS Persistent Engine', () => {
  it('full pipeline: compile, validate, wire HTTP handlers with storage', async () => {
    // Step 1: Compile
    const pwdSource = readSpec('app', 'password');
    const pwdAst = parseConceptFile(pwdSource);
    const pwdManifest = await generateManifest(pwdAst);

    // Step 2: Validate
    const manifest: DeploymentManifest = {
      app: { name: 'conduit', version: '0.1.0', uri: 'urn:conduit' },
      runtimes: {
        concepts: {
          type: 'aws-lambda',
          engine: false,
          transport: 'http',
          upstream: 'engine',
          storage: 'dynamodb',
        },
        engine: {
          type: 'ecs-fargate',
          engine: true,
          transport: 'http',
          storage: 'dynamodb',
          minInstances: 1,
        },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'impls/password.ts',
            runtime: 'concepts',
            storage: 'dynamodb',
            queryMode: 'graphql',
          }],
        },
      },
      syncs: [{
        path: 'syncs/auth.sync',
        engine: 'engine',
        annotations: ['eager'],
      }],
    };

    const validationResult = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );
    expect(validationResult.valid).toBe(true);

    // Step 3: Wire HTTP handler with persistent storage
    const conceptStorage = createInMemoryStorage();
    const httpHandler = createHttpLambdaHandler({
      conceptName: 'Password',
      handler: createPasswordHandler(),
      storage: conceptStorage,
    });

    // Set password
    const setEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(createInvocation()),
      headers: {},
    };
    const setResponse = await httpHandler(setEvent);
    expect(setResponse.statusCode).toBe(200);
    const setCompletion = JSON.parse(setResponse.body);
    expect(setCompletion.variant).toBe('ok');

    // Check password (valid)
    const checkEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(createInvocation({
        action: 'check',
        input: { user: 'alice', password: 'secret123' },
      })),
      headers: {},
    };
    const checkResponse = await httpHandler(checkEvent);
    expect(checkResponse.statusCode).toBe(200);
    const checkCompletion = JSON.parse(checkResponse.body);
    expect(checkCompletion.variant).toBe('ok');
    expect(checkCompletion.output.valid).toBe(true);

    // Check password (invalid)
    const badCheckEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(createInvocation({
        action: 'check',
        input: { user: 'alice', password: 'wrong' },
      })),
      headers: {},
    };
    const badCheckResponse = await httpHandler(badCheckEvent);
    const badCheckCompletion = JSON.parse(badCheckResponse.body);
    expect(badCheckCompletion.variant).toBe('ok');
    expect(badCheckCompletion.output.valid).toBe(false);

    // Query stored entries
    const queryEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/query',
      body: JSON.stringify({ relation: 'entries' }),
      headers: {},
    };
    const queryResponse = await httpHandler(queryEvent);
    expect(queryResponse.statusCode).toBe(200);
    const entries = JSON.parse(queryResponse.body);
    expect(entries).toHaveLength(1);
    expect(entries[0].u).toBe('alice');
  });
});

describe('E2E Deployment Pipeline — GCP Event-Driven', () => {
  it('full pipeline: compile, validate, wire Pub/Sub handlers', async () => {
    // Step 1: Compile
    const pwdAst = parseConceptFile(readSpec('app', 'password'));
    const pwdManifest = await generateManifest(pwdAst);

    // Step 2: Validate
    const manifest: DeploymentManifest = {
      app: { name: 'conduit', version: '0.1.0', uri: 'urn:conduit' },
      runtimes: {
        concepts: {
          type: 'google-cloud-function',
          engine: false,
          transport: 'pubsub',
          upstream: 'engine',
          storage: 'firestore',
        },
        engine: {
          type: 'google-cloud-function',
          engine: true,
          transport: 'pubsub',
          storage: 'firestore',
          actionLog: 'firestore',
        },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'impls/password.ts',
            runtime: 'concepts',
            storage: 'firestore',
            queryMode: 'lite',
          }],
        },
      },
      syncs: [{
        path: 'syncs/auth.sync',
        engine: 'engine',
        annotations: ['eager'],
      }],
    };

    const validationResult = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );
    expect(validationResult.valid).toBe(true);

    // Step 3: Wire Pub/Sub handler
    const published: ActionCompletion[] = [];
    const pubsubHandler = createPubSubGCFHandler({
      conceptName: 'Password',
      handler: createPasswordHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(c) { published.push(c); },
      },
    });

    const invocation = createInvocation();
    const message: PubSubMessage = {
      data: Buffer.from(JSON.stringify(invocation)).toString('base64'),
      messageId: 'msg-gcp-e2e-1',
      publishTime: new Date().toISOString(),
    };

    await pubsubHandler(message, createPubSubContext());
    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
  });
});

describe('E2E Deployment Pipeline — GCP Persistent Engine', () => {
  it('full pipeline: compile, validate, wire HTTP handler on Cloud Run', async () => {
    // Step 1: Compile
    const pwdAst = parseConceptFile(readSpec('app', 'password'));
    const pwdManifest = await generateManifest(pwdAst);

    // Step 2: Validate
    const manifest: DeploymentManifest = {
      app: { name: 'conduit', version: '0.1.0', uri: 'urn:conduit' },
      runtimes: {
        concepts: {
          type: 'google-cloud-function',
          engine: false,
          transport: 'http',
          upstream: 'engine',
          storage: 'firestore',
        },
        engine: {
          type: 'cloud-run',
          engine: true,
          transport: 'http',
          storage: 'firestore',
          minInstances: 1,
        },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'impls/password.ts',
            runtime: 'concepts',
            storage: 'firestore',
            queryMode: 'graphql',
          }],
        },
      },
      syncs: [{
        path: 'syncs/auth.sync',
        engine: 'engine',
        annotations: ['eager'],
      }],
    };

    const validationResult = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );
    expect(validationResult.valid).toBe(true);

    // Step 3: Wire GCF HTTP handler
    const conceptStorage = createInMemoryStorage();
    const handler = createHttpGCFHandler({
      conceptName: 'Password',
      handler: createPasswordHandler(),
      storage: conceptStorage,
    });

    // Set
    const { res: setRes, getCode: setCode, getBody: setBody } = createMockGCFResponse();
    await handler(
      { method: 'POST', path: '/invoke', body: createInvocation(), headers: {} },
      setRes,
    );
    expect(setCode()).toBe(200);
    expect(setBody().variant).toBe('ok');

    // Check
    const { res: checkRes, getCode: checkCode, getBody: checkBody } = createMockGCFResponse();
    await handler(
      {
        method: 'POST',
        path: '/invoke',
        body: createInvocation({ action: 'check', input: { user: 'alice', password: 'secret123' } }),
        headers: {},
      },
      checkRes,
    );
    expect(checkCode()).toBe(200);
    expect(checkBody().variant).toBe('ok');
    expect(checkBody().output.valid).toBe(true);
  });
});

describe('E2E Deployment Pipeline — Hybrid PostgreSQL', () => {
  it('full pipeline: compile multiple concepts, validate hybrid deployment', async () => {
    // Step 1: Compile multiple concepts
    const pwdAst = parseConceptFile(readSpec('app', 'password'));
    const pwdManifest = await generateManifest(pwdAst);
    const articleAst = parseConceptFile(readSpec('app', 'article'));
    const articleManifest = await generateManifest(articleAst);

    // Step 2: Validate hybrid deployment
    const manifest: DeploymentManifest = {
      app: { name: 'conduit', version: '0.1.0', uri: 'urn:conduit' },
      runtimes: {
        concepts: {
          type: 'aws-lambda',
          engine: false,
          transport: 'http',
          upstream: 'engine',
          storage: 'postgres',
        },
        engine: {
          type: 'ecs-fargate',
          engine: true,
          transport: 'http',
          storage: 'postgres',
          minInstances: 1,
        },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'impls/password.ts',
            runtime: 'concepts',
            storage: 'postgres',
            queryMode: 'graphql',
          }],
        },
        Article: {
          spec: 'specs/article.concept',
          implementations: [{
            language: 'typescript',
            path: 'impls/article.ts',
            runtime: 'concepts',
            storage: 'postgres',
            queryMode: 'graphql',
          }],
        },
      },
      syncs: [
        { path: 'syncs/auth.sync', engine: 'engine', annotations: ['eager'] },
        { path: 'syncs/articles.sync', engine: 'engine', annotations: ['eventual'] },
      ],
    };

    const validationResult = validateDeploymentManifest(
      manifest,
      ['Password', 'Article'],
      {
        'syncs/auth.sync': ['Password'],
        'syncs/articles.sync': ['Article'],
      },
      { Password: ['crypto'], Article: [] },
    );

    expect(validationResult.valid).toBe(true);
    expect(validationResult.plan!.conceptPlacements).toHaveLength(2);
    expect(validationResult.plan!.syncAssignments).toHaveLength(2);

    // Step 3: Wire handlers for both concepts
    const pwdStorage = createInMemoryStorage();
    const articleStorage = createInMemoryStorage();

    const pwdHandler = createHttpLambdaHandler({
      conceptName: 'Password',
      handler: createPasswordHandler(),
      storage: pwdStorage,
    });
    const articleHandler = createHttpLambdaHandler({
      conceptName: 'Article',
      handler: createProfileHandler(),
      storage: articleStorage,
    });

    // Password set
    const pwdSetEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(createInvocation()),
      headers: {},
    };
    const pwdSetResponse = await pwdHandler(pwdSetEvent);
    expect(pwdSetResponse.statusCode).toBe(200);

    // Article create
    const articleCreateEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(createInvocation({
        concept: 'Article',
        action: 'create',
        input: { user: 'alice', bio: 'Hello world' },
      })),
      headers: {},
    };
    const articleResponse = await articleHandler(articleCreateEvent);
    expect(articleResponse.statusCode).toBe(200);
  });
});

// ============================================================
// 2. E2E: DeploymentValidator Concept Handler
// ============================================================

describe('E2E Deployment Pipeline — DeploymentValidator Concept', () => {
  it('parse action parses and stores a deployment manifest', async () => {
    const storage = createInMemoryStorage();
    const raw = JSON.stringify({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        main: { type: 'node', engine: true, transport: 'in-process' },
      },
      concepts: {},
      syncs: [],
    });

    const result = await deploymentValidatorHandler.parse(
      { raw },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.manifest).toBeTruthy();
  });

  it('parse action returns error for invalid JSON', async () => {
    const storage = createInMemoryStorage();
    const result = await deploymentValidatorHandler.parse(
      { raw: 'not-json{{{' },
      storage,
    );

    expect(result.variant).toBe('error');
  });

  it('parse action returns error for missing app fields', async () => {
    const storage = createInMemoryStorage();
    const result = await deploymentValidatorHandler.parse(
      { raw: JSON.stringify({ app: { name: 'test' } }) },
      storage,
    );

    expect(result.variant).toBe('error');
    expect(result.message).toContain('app.version');
  });
});

// ============================================================
// 3. E2E: Cross-Cloud Handler Behavior Equivalence
// ============================================================

describe('E2E Deployment Pipeline — Cross-Cloud Equivalence', () => {
  it('same concept handler produces identical results on Lambda HTTP and GCF HTTP', async () => {
    const pwdHandler = createPasswordHandler();
    const invocation = createInvocation();

    // Lambda HTTP
    const lambdaStorage = createInMemoryStorage();
    const lambdaH = createHttpLambdaHandler({
      conceptName: 'Password',
      handler: pwdHandler,
      storage: lambdaStorage,
    });
    const lambdaResp = await lambdaH({
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(invocation),
      headers: {},
    });
    const lambdaBody = JSON.parse(lambdaResp.body);

    // GCF HTTP
    const gcfStorage = createInMemoryStorage();
    const gcfH = createHttpGCFHandler({
      conceptName: 'Password',
      handler: pwdHandler,
      storage: gcfStorage,
    });
    const { res, getCode, getBody } = createMockGCFResponse();
    await gcfH({ method: 'POST', path: '/invoke', body: invocation, headers: {} }, res);

    expect(lambdaBody.variant).toBe(getBody().variant);
    expect(lambdaBody.output.user).toBe(getBody().output.user);
  });

  it('same handler produces identical results on Lambda SQS and GCF Pub/Sub', async () => {
    const pwdHandler = createPasswordHandler();
    const invocation = createInvocation();
    const lambdaCompletions: ActionCompletion[] = [];
    const gcfCompletions: ActionCompletion[] = [];

    // Lambda SQS
    const sqsH = createSqsLambdaHandler({
      conceptName: 'Password',
      handler: pwdHandler,
      storage: createInMemoryStorage(),
      completionPublisher: { async publish(c) { lambdaCompletions.push(c); } },
    });
    await sqsH({
      Records: [{
        messageId: 'e2e-cross-1',
        body: JSON.stringify(invocation),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:q',
      }],
    });

    // GCF Pub/Sub
    const pubsubH = createPubSubGCFHandler({
      conceptName: 'Password',
      handler: pwdHandler,
      storage: createInMemoryStorage(),
      completionPublisher: { async publish(c) { gcfCompletions.push(c); } },
    });
    await pubsubH(
      {
        data: Buffer.from(JSON.stringify(invocation)).toString('base64'),
        messageId: 'e2e-cross-2',
        publishTime: new Date().toISOString(),
      },
      createPubSubContext(),
    );

    expect(lambdaCompletions).toHaveLength(1);
    expect(gcfCompletions).toHaveLength(1);
    expect(lambdaCompletions[0].variant).toBe(gcfCompletions[0].variant);
    expect(lambdaCompletions[0].output.user).toBe(gcfCompletions[0].output.user);
  });
});

// ============================================================
// 4. E2E: Multi-Concept Deployment
// ============================================================

describe('E2E Deployment Pipeline — Multi-Concept Multi-Runtime', () => {
  it('deploys Password + Profile across server and iOS runtimes', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'conduit', version: '0.1.0', uri: 'urn:conduit' },
      runtimes: {
        server: { type: 'node', engine: true, transport: 'in-process' },
        ios: { type: 'swift', engine: true, transport: 'websocket', upstream: 'server' },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'server/password',
            runtime: 'server',
            storage: 'sqlite',
            queryMode: 'graphql',
          }],
        },
        Profile: {
          spec: 'specs/profile.concept',
          implementations: [
            { language: 'typescript', path: 'server/profile', runtime: 'server', storage: 'postgres', queryMode: 'graphql' },
            { language: 'swift', path: 'ios/profile', runtime: 'ios', storage: 'coredata', queryMode: 'lite', cacheTtl: 10000 },
          ],
        },
      },
      syncs: [
        { path: 'syncs/auth.sync', engine: 'server', annotations: ['eager'] },
        { path: 'syncs/profile.sync', engine: 'server', annotations: ['eventual'] },
      ],
    });

    const result = validateDeploymentManifest(
      manifest,
      ['Password', 'Profile'],
      {
        'syncs/auth.sync': ['Password'],
        'syncs/profile.sync': ['Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    expect(result.valid).toBe(true);
    expect(result.plan!.conceptPlacements).toHaveLength(3);
    expect(result.plan!.syncAssignments).toHaveLength(2);

    // Profile sync should be cross-runtime
    const profileSync = result.plan!.syncAssignments.find(s => s.sync === 'syncs/profile.sync')!;
    expect(profileSync.crossRuntime).toBe(true);

    // Auth sync is NOT cross-runtime (Password only on server)
    const authSync = result.plan!.syncAssignments.find(s => s.sync === 'syncs/auth.sync')!;
    expect(authSync.crossRuntime).toBe(false);
  });
});
