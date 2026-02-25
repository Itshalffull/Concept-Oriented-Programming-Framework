---
name: transport-adapter-scaffold-gen
description: Use when adding a new transport protocol to a COPF application. Generates a transport adapter with invoke, query, and health methods for the specified protocol.
argument-hint: --name <AdapterName> --protocol <protocol>
allowed-tools: Read, Write, Bash
---

# TransportAdapterScaffoldGen

Scaffold a **$ARGUMENTS** transport adapter with invoke, query, and health methods for cross-runtime communication.

> **When to use:** Use when adding a new transport protocol to a COPF application. Generates a transport adapter with invoke, query, and health methods for the specified protocol.

## Design Principles

- **Protocol Transparency:** Concept handlers call invoke/query without knowing the transport. Swapping from HTTP to WebSocket requires no handler changes.
- **Health Monitoring:** Every adapter provides a health() method that returns latency and status — enables the framework to detect and route around failures.
- **Connection Lifecycle:** Stateful transports (WebSocket, Worker) manage their own connection lifecycle — connect on first use, reconnect on failure, clean up on dispose.

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (TransportConfig → TransportAdapter).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual transport adapter implementation is produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track TransportConfig → TransportAdapter transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the transport adapter scaffold generator*
```typescript
const result = await transportAdapterScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "TransportConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "TransportAdapterScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `TransportAdapterScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold transport preview --name ApiTransport --protocol http
```

### Step 5: Generate Transport Adapter

Generate a transport adapter implementation for the specified protocol (HTTP, WebSocket, Worker, or in-process) with invoke, query, and health methods.

**Examples:**
*Generate an HTTP adapter*
```bash
copf scaffold transport --name ApiTransport --protocol http
```
*Generate a WebSocket adapter*
```bash
copf scaffold transport --name RealtimeTransport --protocol websocket
```
*Generate an in-process adapter*
```bash
copf scaffold transport --name TestTransport --protocol in-process
```

**Checklist:**
- [ ] Protocol is valid (http, websocket, worker, in-process)?
- [ ] Adapter implements invoke(), query(), and health()?
- [ ] HTTP adapter uses fetch with proper error handling?
- [ ] WebSocket adapter manages connection lifecycle?
- [ ] Worker adapter handles message passing?
- [ ] In-process adapter dispatches to registered handlers?

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

## References

- [Transport adapter implementation guide](references/transport-adapter-guide.md)

## Supporting Materials

- [Transport adapter scaffolding walkthrough](examples/scaffold-transport-adapter.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | Adapter class name (PascalCase) |
| protocol | String | Protocol (http, websocket, worker, in-process) |
| baseUrl | String | Base URL for HTTP/WS (default: http://localhost:3000) |


## Anti-Patterns

### Missing health check
Transport adapter has no health() method — framework can't detect failures.

**Bad:**
```
class MyTransport {
  async invoke(...) { ... }
  async query(...) { ... }
  // No health()!
}
```

**Good:**
```
class MyTransport {
  async invoke(...) { ... }
  async query(...) { ... }
  async health() {
    const start = Date.now();
    try {
      await fetch(`${this.baseUrl}/health`);
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
```

## Validation

*Generate a transport adapter:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold transport --name ApiTransport --protocol http
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| deployment-config | Configure transport adapters in deploy manifests |
| storage-adapter-scaffold | Generate storage adapters alongside transport adapters |
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

