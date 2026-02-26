# Clef Serverless Deployment Architecture

## Overview

Clef concepts can be deployed on AWS and GCP serverless platforms with shared
storage across three engine topology options. All three topologies use the same
storage adapters, transport adapters, and concept deployment model — they differ
only in where and how the sync engine runs.

---

## Engine Topologies

### Option A: Persistent Engine

```
┌──────────────┐     HTTP      ┌─────────────────┐
│  Lambda/GCF  │──completions──▶  Engine Service  │
│  (concepts)  │◀──invocations──│  (ECS/Cloud Run)│
└──────────────┘               └────────┬────────┘
       │                                │
       ▼                                ▼
┌──────────────────────────────────────────┐
│         Shared Storage (DynamoDB/        │
│         Firestore/Aurora/CloudSQL)       │
└──────────────────────────────────────────┘
```

- Engine runs as a persistent lightweight service
- Concepts are serverless functions — stateless, scale to zero
- Lowest latency for eager sync chains (<50ms)
- Engine cost: ~$5-15/month

### Option B: Per-Request Engine

```
┌──────────────────────────────────┐
│        Lambda/GCF                │
│  ┌──────────┐  ┌──────────────┐ │
│  │ Concept   │  │ Engine       │ │
│  │ Handler   │──▶ (cold-loaded │ │
│  │           │  │  from cache) │ │
│  └──────────┘  └──────────────┘ │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Shared Storage + Action Log     │
│  (DynamoDB/Firestore)            │
└──────────────────────────────────┘
```

- Engine boots per-request from cached compiled artifacts
- Action log MUST be in shared storage (not in-memory)
- Fully serverless — zero idle cost
- Higher per-request overhead (<150ms latency)

### Option C: Event-Driven Engine

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Lambda/GCF  │────▶│  SQS/Pub-Sub │────▶│  Lambda/GCF  │
│  (concepts)  │     │  (completions│     │  (engine      │
│              │◀────│   + invocat.)│◀────│   evaluator)  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       ▼                                         ▼
┌──────────────────────────────────────────────────────┐
│            Shared Storage + Action Log                │
└──────────────────────────────────────────────────────┘
```

- Completions published to message queue
- Separate function consumes queue, runs engine evaluation
- Fully serverless, auto-scaling
- Higher latency (100-500ms per sync step)
- Best for high-fan-out and batch processing

---

## Topology Selection Guide

| Factor | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Eager chain latency** | <50ms | <150ms | 100-500ms |
| **Idle cost** | ~$5-15/mo | $0 | $0 |
| **Max throughput** | ~10K completions/s | Storage-limited | Unlimited (auto-scaling) |
| **Cold start impact** | None | +1-3s | Per-evaluator, amortized |
| **Complexity** | Lowest | Medium | Highest |
| **Best for** | Production workloads | Dev/staging, low-traffic | High-fan-out, batch |

---

## Implementation Layers

### Layer 1: Storage Adapters

All topologies use these. Each implements `ConceptStorage`.

| Adapter | File | Backend | Best For |
|---------|------|---------|----------|
| DynamoDB | `infrastructure/storage/dynamodb-storage.ts` | AWS DynamoDB | AWS deployments, key-value patterns |
| Firestore | `infrastructure/storage/firestore-storage.ts` | Google Firestore | GCP deployments, real-time capable |
| Redis | `infrastructure/storage/redis-storage.ts` | Redis/Upstash | Session, cache, rate-limit concepts |
| Blob | `infrastructure/storage/blob-storage.ts` | S3/GCS | Large values, media, documents |

### Layer 2: Durable Action Log

Required for Options B and C. Optional durability backup for Option A.

| Implementation | File | Backend |
|---------------|------|---------|
| DynamoDB | `engine/durable-action-log-dynamodb.ts` | AWS DynamoDB |
| Firestore | `engine/durable-action-log-firestore.ts` | Google Firestore |

### Layer 3: Transport Adapters

| Adapter | File | Protocol | Used By |
|---------|------|----------|---------|
| SQS | `infrastructure/transports/sqs-transport.ts` | AWS SQS | Option C (AWS) |
| Pub/Sub | `infrastructure/transports/pubsub-transport.ts` | GCP Pub/Sub | Option C (GCP) |

### Layer 4: Serverless Runtime

| Component | File | Purpose |
|-----------|------|---------|
| Lambda handler | `infrastructure/serverless/lambda-handler.ts` | HTTP + SQS concept handlers |
| GCF handler | `infrastructure/serverless/gcf-handler.ts` | HTTP + Pub/Sub concept handlers |
| Cold start | `infrastructure/serverless/cold-start.ts` | Sync cache, lazy loading |
| Connection pool | `infrastructure/serverless/connection-pool.ts` | Lazy singleton storage |
| Firing guard | `infrastructure/serverless/distributed-lock.ts` | Cross-instance dedup |

### Layer 5: Engine

| Component | File | Purpose |
|-----------|------|---------|
| Per-request engine | `engine/per-request-engine.ts` | Option B embedded engine |
| Evaluator | `engine/serverless-evaluator.ts` | Option C queue consumer |

---

## Deploy Templates

| Template | File | Engine | Concepts | Storage | Transport |
|----------|------|--------|----------|---------|-----------|
| AWS Persistent | `aws-persistent-engine.deploy.yaml` | ECS Fargate | Lambda | DynamoDB | HTTP |
| AWS Event-Driven | `aws-event-driven.deploy.yaml` | Lambda | Lambda | DynamoDB | SQS |
| GCP Persistent | `gcp-persistent-engine.deploy.yaml` | Cloud Run | Cloud Functions | Firestore | HTTP |
| GCP Event-Driven | `gcp-event-driven.deploy.yaml` | Cloud Functions | Cloud Functions | Firestore | Pub/Sub |
| Hybrid PostgreSQL | `hybrid-postgres.deploy.yaml` | ECS/Cloud Run | Lambda/GCF | Aurora/Cloud SQL | HTTP |

Option B uses the persistent engine template with `engine: true` on the Lambda/GCF
runtime (no separate engine service needed).

---

## Storage Adapter Selection Guide

| Use Case | Recommended Adapter |
|----------|-------------------|
| General purpose, AWS | DynamoDB |
| General purpose, GCP | Firestore |
| Session, cache, rate-limit | Redis (Upstash for serverless) |
| Large objects, media | Blob (S3/GCS) with DynamoDB/Firestore index |
| Rich SQL queries, existing DB | PostgreSQL (Aurora Serverless / Cloud SQL) |
| Strong consistency, single-region | Firestore or DynamoDB |
| Global replication | DynamoDB Global Tables or Firestore multi-region |

---

## Connection Patterns

### Serverless (Lambda / Cloud Functions)

Storage connections are initialized outside the handler and reused across
warm invocations via `infrastructure/serverless/connection-pool.ts`:

```typescript
import { getDynamoDBStorage } from './infrastructure/serverless/connection-pool.js';

const storage = getDynamoDBStorage(client, config);

export const handler = async (event) => {
  // storage is reused across warm invocations
  await storage.put('items', 'key', { value: 'data' });
};
```

For Redis in serverless: use Upstash (HTTP-based, no persistent connections).

### Cold Start Optimization

```typescript
import { createModuleInitializer, getSyncIndex } from './infrastructure/serverless/cold-start.js';

const init = createModuleInitializer(() => ({
  syncs: loadCompiledSyncs(bundledSyncs),
  index: getSyncIndex(bundledSyncs),
  storage: getDynamoDBStorage(client, config),
}));

export const handler = async (event) => {
  const { storage, index } = await init();
  // ...
};
```

---

## Concurrency & Deduplication

Multiple serverless instances may process completions for the same flow
simultaneously. The distributed firing guard prevents duplicate sync firings:

```typescript
import { createDynamoDBFiringGuard } from './infrastructure/serverless/distributed-lock.js';

const guard = createDynamoDBFiringGuard(client, { tableName: 'guards' });

const acquired = await guard.tryAcquire([completionId], syncName);
if (!acquired) {
  // Another instance already fired this sync — skip
  return;
}
```

DynamoDB uses conditional `PutItem` with `attribute_not_exists`.
Firestore uses transactions with read-then-write atomicity.
