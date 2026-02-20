// ============================================================
// Integration Tests — All Deployment Targets
//
// Validates deployment manifest parsing and validation for all
// five deployment templates: AWS Event-Driven, AWS Persistent
// Engine, GCP Event-Driven, GCP Persistent Engine, and Hybrid
// PostgreSQL. Tests cross-cutting concerns like transport/provider
// alignment, serverless durability, capability checking, and
// deployment plan generation.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseDeploymentManifest,
  validateDeploymentManifest,
} from '../implementations/typescript/framework/deployment-validator.impl.js';
import type {
  DeploymentManifest,
  RuntimeConfig,
} from '../implementations/typescript/framework/deployment-validator.impl.js';
import { createInMemoryStorage } from '../kernel/src/index.js';
import type {
  ActionInvocation,
  ActionCompletion,
  ConceptHandler,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';
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

// ============================================================
// Test Helpers
// ============================================================

function createTestHandler(): ConceptHandler {
  return {
    async greet(input, _storage) {
      return { variant: 'ok', message: `Hello, ${input.name}!` };
    },
    async store(input, storage) {
      await storage.put('items', input.key as string, { value: input.value });
      return { variant: 'ok', key: input.key };
    },
    async fail(_input, _storage) {
      throw new Error('Handler exploded');
    },
  };
}

function createInvocation(overrides?: Partial<ActionInvocation>): ActionInvocation {
  return {
    id: generateId(),
    concept: 'TestConcept',
    action: 'greet',
    input: { name: 'World' },
    flow: 'test-flow',
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
    eventId: 'evt-1',
    timestamp: new Date().toISOString(),
    eventType: 'google.pubsub.topic.publish',
    resource: { service: 'pubsub.googleapis.com', name: 'test-topic' },
  };
}

function createMinimalManifest(
  runtimes: DeploymentManifest['runtimes'],
  concepts?: DeploymentManifest['concepts'],
  syncs?: DeploymentManifest['syncs'],
): DeploymentManifest {
  const firstRuntime = Object.keys(runtimes)[0];
  return {
    app: { name: 'integration-test', version: '1.0.0', uri: 'app://integration-test' },
    runtimes,
    concepts: concepts || {
      TestConcept: {
        spec: 'concepts/test.concept',
        implementations: [{
          language: 'typescript',
          path: 'impls/test.ts',
          runtime: firstRuntime,
          storage: 'memory',
          queryMode: 'lite',
        }],
      },
    },
    syncs: syncs || [],
  };
}

// ============================================================
// 1. AWS Event-Driven Deployment Template
// ============================================================

describe('Deployment Integration — AWS Event-Driven', () => {
  const awsEventDrivenManifest = (): DeploymentManifest => createMinimalManifest(
    {
      concepts: {
        type: 'aws-lambda',
        engine: false,
        transport: 'sqs',
        upstream: 'engine',
        storage: 'dynamodb',
        memory: 256,
        timeout: 30,
      },
      engine: {
        type: 'aws-lambda',
        engine: true,
        transport: 'sqs',
        storage: 'dynamodb',
        actionLog: 'dynamodb',
        syncCache: 's3',
        memory: 512,
        timeout: 60,
      },
    },
    {
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
    [{
      path: 'syncs/auth.sync',
      engine: 'engine',
      annotations: ['eager'],
    }],
  );

  it('validates an AWS event-driven manifest successfully', () => {
    const manifest = awsEventDrivenManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.plan).not.toBeNull();
  });

  it('produces correct concept placements for AWS event-driven', () => {
    const manifest = awsEventDrivenManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );

    expect(result.plan!.conceptPlacements).toHaveLength(1);
    expect(result.plan!.conceptPlacements[0].runtime).toBe('concepts');
    expect(result.plan!.conceptPlacements[0].transport).toBe('sqs');
  });

  it('no transport mismatch warning for SQS on AWS Lambda', () => {
    const manifest = awsEventDrivenManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const sqsWarnings = result.warnings.filter(w => w.includes('SQS'));
    expect(sqsWarnings).toHaveLength(0);
  });

  it('AWS event-driven with actionLog suppresses durability warning', () => {
    const manifest = awsEventDrivenManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('Lambda SQS handler processes invocations end-to-end', async () => {
    const published: ActionCompletion[] = [];
    const handler = createSqsLambdaHandler({
      conceptName: 'Password',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const invocation = createInvocation({ concept: 'Password' });
    const event: SQSEvent = {
      Records: [{
        messageId: 'msg-aws-ed-1',
        body: JSON.stringify(invocation),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:password-queue',
      }],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(0);
    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
  });
});

// ============================================================
// 2. AWS Persistent Engine Deployment Template
// ============================================================

describe('Deployment Integration — AWS Persistent Engine', () => {
  const awsPersistentManifest = (): DeploymentManifest => createMinimalManifest(
    {
      concepts: {
        type: 'aws-lambda',
        engine: false,
        transport: 'http',
        upstream: 'engine',
        storage: 'dynamodb',
        memory: 256,
        timeout: 30,
      },
      engine: {
        type: 'ecs-fargate',
        engine: true,
        transport: 'http',
        storage: 'dynamodb',
        cpu: 256,
        memory: 512,
        minInstances: 1,
      },
    },
    {
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
      Profile: {
        spec: 'specs/profile.concept',
        implementations: [{
          language: 'typescript',
          path: 'impls/profile.ts',
          runtime: 'concepts',
          storage: 'dynamodb',
          queryMode: 'graphql',
        }],
      },
    },
    [{
      path: 'syncs/auth.sync',
      engine: 'engine',
      annotations: ['eager'],
    }],
  );

  it('validates an AWS persistent engine manifest successfully', () => {
    const manifest = awsPersistentManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password', 'Profile'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'], Profile: [] },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('ECS Fargate engine does not trigger serverless durability warning', () => {
    const manifest = awsPersistentManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('concepts use HTTP transport to persistent engine', () => {
    const manifest = awsPersistentManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password', 'Profile'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'], Profile: [] },
    );

    const placements = result.plan!.conceptPlacements;
    for (const p of placements) {
      expect(p.transport).toBe('http');
    }
  });

  it('Lambda HTTP handler serves invocations for persistent engine mode', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'Password',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation = createInvocation({ concept: 'Password' });
    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(invocation),
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);

    const completion = JSON.parse(response.body);
    expect(completion.variant).toBe('ok');
    expect(completion.output.message).toBe('Hello, World!');
  });

  it('Lambda HTTP handler supports health checks', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'Password',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const event: APIGatewayEvent = {
      httpMethod: 'GET',
      path: '/health',
      body: null,
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.available).toBe(true);
    expect(body.concept).toBe('Password');
  });
});

// ============================================================
// 3. GCP Event-Driven Deployment Template
// ============================================================

describe('Deployment Integration — GCP Event-Driven', () => {
  const gcpEventDrivenManifest = (): DeploymentManifest => createMinimalManifest(
    {
      concepts: {
        type: 'google-cloud-function',
        engine: false,
        transport: 'pubsub',
        upstream: 'engine',
        storage: 'firestore',
        memory: 256,
        timeout: 60,
      },
      engine: {
        type: 'google-cloud-function',
        engine: true,
        transport: 'pubsub',
        storage: 'firestore',
        actionLog: 'firestore',
        syncCache: 'gcs',
        memory: 512,
        timeout: 120,
      },
    },
    {
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
    [{
      path: 'syncs/auth.sync',
      engine: 'engine',
      annotations: ['eager'],
    }],
  );

  it('validates a GCP event-driven manifest successfully', () => {
    const manifest = gcpEventDrivenManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('no transport mismatch warning for Pub/Sub on GCP', () => {
    const manifest = gcpEventDrivenManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const pubsubWarnings = result.warnings.filter(w => w.includes('Pub/Sub'));
    expect(pubsubWarnings).toHaveLength(0);
  });

  it('GCP event-driven with actionLog suppresses durability warning', () => {
    const manifest = gcpEventDrivenManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('GCF Pub/Sub handler processes invocations end-to-end', async () => {
    const published: ActionCompletion[] = [];
    const handler = createPubSubGCFHandler({
      conceptName: 'Password',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const invocation = createInvocation({ concept: 'Password' });
    const message: PubSubMessage = {
      data: Buffer.from(JSON.stringify(invocation)).toString('base64'),
      messageId: 'msg-gcp-ed-1',
      publishTime: new Date().toISOString(),
    };

    await handler(message, createPubSubContext());

    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
    expect(published[0].output.message).toBe('Hello, World!');
  });

  it('GCF HTTP handler serves invocations', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'Password',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const { res, getCode, getBody } = createMockGCFResponse();
    const invocation = createInvocation({ concept: 'Password' });
    const req: GCFHttpRequest = {
      method: 'POST',
      path: '/invoke',
      body: invocation,
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(200);
    expect(getBody().variant).toBe('ok');
  });
});

// ============================================================
// 4. GCP Persistent Engine Deployment Template
// ============================================================

describe('Deployment Integration — GCP Persistent Engine', () => {
  const gcpPersistentManifest = (): DeploymentManifest => createMinimalManifest(
    {
      concepts: {
        type: 'google-cloud-function',
        engine: false,
        transport: 'http',
        upstream: 'engine',
        storage: 'firestore',
        memory: 256,
        timeout: 60,
      },
      engine: {
        type: 'cloud-run',
        engine: true,
        transport: 'http',
        storage: 'firestore',
        cpu: 1,
        memory: 512,
        minInstances: 1,
      },
    },
    {
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
    [{
      path: 'syncs/auth.sync',
      engine: 'engine',
      annotations: ['eager'],
    }],
  );

  it('validates a GCP persistent engine manifest successfully', () => {
    const manifest = gcpPersistentManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Cloud Run engine does not trigger serverless durability warning', () => {
    const manifest = gcpPersistentManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('concepts use HTTP transport to Cloud Run engine', () => {
    const manifest = gcpPersistentManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password'],
      { 'syncs/auth.sync': ['Password'] },
      { Password: ['crypto'] },
    );

    for (const p of result.plan!.conceptPlacements) {
      expect(p.transport).toBe('http');
    }
  });

  it('upstream reference from Cloud Functions to Cloud Run is valid', () => {
    const manifest = gcpPersistentManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    // Should not have upstream-related errors
    const upstreamErrors = result.errors.filter(e => e.includes('upstream'));
    expect(upstreamErrors).toHaveLength(0);
  });
});

// ============================================================
// 5. Hybrid PostgreSQL Deployment Template
// ============================================================

describe('Deployment Integration — Hybrid PostgreSQL', () => {
  const hybridPostgresManifest = (): DeploymentManifest => createMinimalManifest(
    {
      concepts: {
        type: 'aws-lambda',
        engine: false,
        transport: 'http',
        upstream: 'engine',
        storage: 'postgres',
        memory: 256,
        timeout: 30,
      },
      engine: {
        type: 'ecs-fargate',
        engine: true,
        transport: 'http',
        storage: 'postgres',
        cpu: 256,
        memory: 512,
        minInstances: 1,
      },
    },
    {
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
    [
      { path: 'syncs/auth.sync', engine: 'engine', annotations: ['eager'] },
      { path: 'syncs/articles.sync', engine: 'engine', annotations: ['eventual'] },
    ],
  );

  it('validates a hybrid PostgreSQL manifest successfully', () => {
    const manifest = hybridPostgresManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password', 'Article'],
      {
        'syncs/auth.sync': ['Password'],
        'syncs/articles.sync': ['Article'],
      },
      { Password: ['crypto'], Article: [] },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('produces correct sync assignments for hybrid deployment', () => {
    const manifest = hybridPostgresManifest();
    const result = validateDeploymentManifest(
      manifest,
      ['Password', 'Article'],
      {
        'syncs/auth.sync': ['Password'],
        'syncs/articles.sync': ['Article'],
      },
      { Password: ['crypto'], Article: [] },
    );

    expect(result.plan!.syncAssignments).toHaveLength(2);
    const authSync = result.plan!.syncAssignments.find(s => s.sync === 'syncs/auth.sync')!;
    expect(authSync.engine).toBe('engine');
    expect(authSync.crossRuntime).toBe(false);
  });

  it('ECS Fargate engine does not need actionLog', () => {
    const manifest = hybridPostgresManifest();
    const result = validateDeploymentManifest(manifest, ['Password'], {}, {});

    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('HTTP transport works for both concepts and engine', () => {
    const manifest = hybridPostgresManifest();
    expect(manifest.runtimes.concepts.transport).toBe('http');
    expect(manifest.runtimes.engine.transport).toBe('http');
  });
});

// ============================================================
// 6. Cross-Deployment Target Validation
// ============================================================

describe('Deployment Integration — Cross-Target Validation', () => {
  it('detects transport/provider mismatch: SQS on GCP', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'google-cloud-function',
        engine: true,
        transport: 'sqs',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('SQS') && w.includes('google-cloud-function'))).toBe(true);
  });

  it('detects transport/provider mismatch: Pub/Sub on AWS', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'aws-lambda',
        engine: true,
        transport: 'pubsub',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('Pub/Sub') && w.includes('aws-lambda'))).toBe(true);
  });

  it('warns when serverless engine has no actionLog', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'aws-lambda',
        engine: true,
        transport: 'sqs',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('actionLog'))).toBe(true);
  });

  it('errors when concept requires capability not provided by browser runtime', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        browser: { type: 'browser', engine: true, transport: 'in-process' },
      },
      concepts: {
        Password: {
          spec: 'specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: 'browser/password',
            runtime: 'browser',
            storage: 'localstorage',
            queryMode: 'lite',
          }],
        },
      },
      syncs: [],
    });

    const result = validateDeploymentManifest(
      manifest,
      ['Password'],
      {},
      { Password: ['crypto'] },
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('crypto'))).toBe(true);
  });

  it('errors when sync assigned to non-engine runtime', () => {
    const manifest = createMinimalManifest(
      {
        worker: { type: 'node', engine: false, transport: 'worker' },
      },
      {},
      [{ path: 'syncs/test.sync', engine: 'worker', annotations: [] }],
    );

    const result = validateDeploymentManifest(manifest, [], {}, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('engine: true'))).toBe(true);
  });

  it('errors when runtime references undefined upstream', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        ios: { type: 'swift', engine: true, transport: 'websocket', upstream: 'nonexistent' },
      },
      concepts: {},
      syncs: [],
    });

    const result = validateDeploymentManifest(manifest, [], {}, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('upstream'))).toBe(true);
  });

  it('warns about cross-runtime eager syncs', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        server: { type: 'node', engine: true, transport: 'in-process' },
        ios: { type: 'swift', engine: true, transport: 'websocket', upstream: 'server' },
      },
      concepts: {
        Profile: {
          spec: 'specs/profile.concept',
          implementations: [
            { language: 'typescript', path: 'server/profile', runtime: 'server', storage: 'postgres', queryMode: 'graphql' },
            { language: 'swift', path: 'ios/profile', runtime: 'ios', storage: 'coredata', queryMode: 'lite' },
          ],
        },
      },
      syncs: [{
        path: 'syncs/profile.sync',
        engine: 'server',
        annotations: [],
      }],
    });

    const result = validateDeploymentManifest(
      manifest,
      [],
      { 'syncs/profile.sync': ['Profile'] },
      { Profile: [] },
    );

    expect(result.warnings.some(w => w.includes('multiple runtimes'))).toBe(true);
  });
});

// ============================================================
// 7. Handler Integration across AWS/GCP
// ============================================================

describe('Deployment Integration — Handler Parity', () => {
  it('Lambda HTTP and GCF HTTP produce equivalent completions', async () => {
    const invocation = createInvocation();

    // Lambda HTTP
    const lambdaHandler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });
    const lambdaEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(invocation),
      headers: {},
    };
    const lambdaResponse = await lambdaHandler(lambdaEvent);
    const lambdaCompletion = JSON.parse(lambdaResponse.body);

    // GCF HTTP
    const gcfHandler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });
    const { res, getCode, getBody } = createMockGCFResponse();
    const gcfReq: GCFHttpRequest = {
      method: 'POST',
      path: '/invoke',
      body: invocation,
      headers: {},
    };
    await gcfHandler(gcfReq, res);

    // Both should produce ok completions
    expect(lambdaResponse.statusCode).toBe(200);
    expect(getCode()).toBe(200);
    expect(lambdaCompletion.variant).toBe('ok');
    expect(getBody().variant).toBe('ok');
    expect(lambdaCompletion.output.message).toBe(getBody().output.message);
  });

  it('Lambda SQS and GCF Pub/Sub produce equivalent completions', async () => {
    const invocation = createInvocation();
    const lambdaPublished: ActionCompletion[] = [];
    const gcfPublished: ActionCompletion[] = [];

    // Lambda SQS
    const sqsHandler = createSqsLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(c) { lambdaPublished.push(c); },
      },
    });
    const sqsEvent: SQSEvent = {
      Records: [{
        messageId: 'msg-parity-1',
        body: JSON.stringify(invocation),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
      }],
    };
    await sqsHandler(sqsEvent);

    // GCF Pub/Sub
    const pubsubHandler = createPubSubGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(c) { gcfPublished.push(c); },
      },
    });
    const pubsubMessage: PubSubMessage = {
      data: Buffer.from(JSON.stringify(invocation)).toString('base64'),
      messageId: 'msg-parity-2',
      publishTime: new Date().toISOString(),
    };
    await pubsubHandler(pubsubMessage, createPubSubContext());

    // Both should produce equivalent completions
    expect(lambdaPublished).toHaveLength(1);
    expect(gcfPublished).toHaveLength(1);
    expect(lambdaPublished[0].variant).toBe(gcfPublished[0].variant);
    expect(lambdaPublished[0].output.message).toBe(gcfPublished[0].output.message);
  });

  it('both Lambda HTTP and GCF HTTP return equivalent query results', async () => {
    const lambdaStorage = createInMemoryStorage();
    const gcfStorage = createInMemoryStorage();

    // Seed identical data
    await lambdaStorage.put('items', 'a', { name: 'Alpha', type: 'report' });
    await gcfStorage.put('items', 'a', { name: 'Alpha', type: 'report' });

    // Lambda query
    const lambdaHandler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: lambdaStorage,
    });
    const lambdaEvent: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/query',
      body: JSON.stringify({ relation: 'items', args: { type: 'report' } }),
      headers: {},
    };
    const lambdaResponse = await lambdaHandler(lambdaEvent);

    // GCF query
    const gcfHandler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: gcfStorage,
    });
    const { res, getCode, getBody } = createMockGCFResponse();
    const gcfReq: GCFHttpRequest = {
      method: 'POST',
      path: '/query',
      body: { relation: 'items', args: { type: 'report' } },
      headers: {},
    };
    await gcfHandler(gcfReq, res);

    expect(lambdaResponse.statusCode).toBe(200);
    expect(getCode()).toBe(200);
    const lambdaResults = JSON.parse(lambdaResponse.body);
    expect(lambdaResults).toHaveLength(1);
    expect(getBody()).toHaveLength(1);
    expect(lambdaResults[0].name).toBe(getBody()[0].name);
  });
});

// ============================================================
// 8. Multi-Runtime Deployment Plans
// ============================================================

describe('Deployment Integration — Multi-Runtime Plans', () => {
  it('generates correct plan for server + iOS multi-runtime deployment', () => {
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

    // Password: only server
    const pwdPlacements = result.plan!.conceptPlacements.filter(p => p.concept === 'Password');
    expect(pwdPlacements).toHaveLength(1);
    expect(pwdPlacements[0].runtime).toBe('server');

    // Profile: server + iOS
    const profilePlacements = result.plan!.conceptPlacements.filter(p => p.concept === 'Profile');
    expect(profilePlacements).toHaveLength(2);
    expect(profilePlacements.map(p => p.language).sort()).toEqual(['swift', 'typescript']);

    // Sync cross-runtime detection
    const profileSync = result.plan!.syncAssignments.find(s => s.sync === 'syncs/profile.sync')!;
    expect(profileSync.crossRuntime).toBe(true);
  });
});
