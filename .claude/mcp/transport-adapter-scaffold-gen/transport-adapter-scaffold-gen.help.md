# transport_adapter_scaffold_gen — MCP Tool Guide

Scaffold a **{input}** transport adapter with invoke, query, and health methods for cross-runtime communication.


> **When to use:** Use when adding a new transport protocol to a CLEF application. Generates a transport adapter with invoke, query, and health methods for the specified protocol.


## Design Principles

- **Protocol Transparency:** Concept handlers call invoke/query without knowing the transport. Swapping from HTTP to WebSocket requires no handler changes.
- **Health Monitoring:** Every adapter provides a health() method that returns latency and status — enables the framework to detect and route around failures.
- **Connection Lifecycle:** Stateful transports (WebSocket, Worker) manage their own connection lifecycle — connect on first use, reconnect on failure, clean up on dispose.
**generate:**
- [ ] Protocol is valid (http, websocket, worker, in-process)?
- [ ] Adapter implements invoke(), query(), and health()?
- [ ] HTTP adapter uses fetch with proper error handling?
- [ ] WebSocket adapter manages connection lifecycle?
- [ ] Worker adapter handles message passing?
- [ ] In-process adapter dispatches to registered handlers?
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
npx tsx cli/src/index.ts scaffold transport --name ApiTransport --protocol http
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```
**Related tools:** [object Object], [object Object]

