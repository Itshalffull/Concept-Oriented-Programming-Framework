// ============================================================
// Deployment Validator — Serverless Rule Tests
//
// Tests for:
//   - Rule 6: Serverless engine without durable action log warning
//   - Rule 7: Queue-transport / cloud-provider mismatch warning
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  validateDeploymentManifest,
} from '../implementations/typescript/framework/deployment-validator.impl.js';
import type { DeploymentManifest } from '../implementations/typescript/framework/deployment-validator.impl.js';

function createMinimalManifest(
  runtimes: DeploymentManifest['runtimes'],
): DeploymentManifest {
  const firstRuntime = Object.keys(runtimes)[0];
  return {
    app: { name: 'test', version: '1.0.0', uri: 'app://test' },
    runtimes,
    concepts: {
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
    syncs: [],
  };
}

// ============================================================
// Rule 6: Serverless engine without actionLog
// ============================================================

describe('Rule 6 — Serverless Engine Durability Warning', () => {
  it('warns when aws-lambda engine has no actionLog', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'aws-lambda',
        engine: true,
        transport: 'sqs',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('actionLog'))).toBe(true);
    expect(result.warnings.some(w => w.includes('aws-lambda'))).toBe(true);
  });

  it('warns when google-cloud-function engine has no actionLog', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'google-cloud-function',
        engine: true,
        transport: 'pubsub',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('actionLog'))).toBe(true);
    expect(result.warnings.some(w => w.includes('google-cloud-function'))).toBe(true);
  });

  it('does not warn when serverless engine has actionLog configured', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'aws-lambda',
        engine: true,
        transport: 'sqs',
        actionLog: 'dynamodb',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('does not warn for non-serverless engine (ecs-fargate)', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'ecs-fargate',
        engine: true,
        transport: 'http',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });

  it('does not warn for non-engine serverless runtime', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'aws-lambda',
        engine: false,
        transport: 'http',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    const actionLogWarnings = result.warnings.filter(w => w.includes('actionLog'));
    expect(actionLogWarnings).toHaveLength(0);
  });
});

// ============================================================
// Rule 7: Transport / cloud-provider mismatch
// ============================================================

describe('Rule 7 — Transport-Provider Mismatch Warning', () => {
  it('warns when SQS transport used on GCP runtime', () => {
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

  it('warns when Pub/Sub transport used on AWS runtime', () => {
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

  it('warns when SQS transport used on cloud-run', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'cloud-run',
        engine: true,
        transport: 'sqs',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('SQS') && w.includes('cloud-run'))).toBe(true);
  });

  it('warns when Pub/Sub transport used on ecs-fargate', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'ecs-fargate',
        engine: true,
        transport: 'pubsub',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    expect(result.warnings.some(w => w.includes('Pub/Sub') && w.includes('ecs-fargate'))).toBe(true);
  });

  it('no warning for SQS on aws-lambda', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'aws-lambda',
        engine: false,
        transport: 'sqs',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    const sqsWarnings = result.warnings.filter(w => w.includes('SQS'));
    expect(sqsWarnings).toHaveLength(0);
  });

  it('no warning for Pub/Sub on google-cloud-function', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'google-cloud-function',
        engine: false,
        transport: 'pubsub',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    const pubsubWarnings = result.warnings.filter(w => w.includes('Pub/Sub'));
    expect(pubsubWarnings).toHaveLength(0);
  });

  it('no warning for SQS on generic node runtime', () => {
    const manifest = createMinimalManifest({
      main: {
        type: 'node',
        engine: true,
        transport: 'sqs',
      },
    });

    const result = validateDeploymentManifest(manifest, ['TestConcept'], {}, {});
    const sqsWarnings = result.warnings.filter(w => w.includes('SQS'));
    expect(sqsWarnings).toHaveLength(0);
  });
});
