# Deployment Configuration Guide

A deployment manifest maps concepts to runtimes, assigns syncs
to engines, and configures transport between runtimes.

## Manifest Structure

```yaml
deployment:
  name: my-app
  version: 1.0.0

runtimes:
  api:
    type: node
    concepts: [User, Article, Comment]
    capabilities: [storage-postgres, transport-http]
  worker:
    type: node
    concepts: [Email, Notification]
    capabilities: [storage-redis, transport-amqp]

engines:
  default:
    type: in-process
    syncs: [CreateProfile, UpdateCache]
  async:
    type: queue
    syncs: [WelcomeEmail, NotifyOnComment]

transports:
  api-to-worker:
    type: http
    from: api
    to: worker
    endpoint: http://worker:3001
```

## Runtime Configuration

Each runtime declares:
- **type** — Execution environment (node, deno, edge)
- **concepts** — Which concepts run in this runtime
- **capabilities** — Available storage and transport types

## Engine Assignment

Sync engines execute sync rules. Types:
- `in-process` — Runs within the concept's runtime. For eager syncs.
- `queue` — Uses a message queue. For eventual syncs.
- `distributed` — Cross-runtime engine. For multi-runtime syncs.

## Validation Rules

The validator checks:
1. Every concept is assigned to exactly one runtime.
2. Every sync is assigned to an engine.
3. Cross-runtime syncs have a transport adapter configured.
4. Runtime capabilities satisfy concept requirements.
