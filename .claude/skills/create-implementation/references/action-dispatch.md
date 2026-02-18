# Action Dispatch, Registration, and Testing Reference

How actions are dispatched to handlers, how concepts are registered, and how to test implementations.

## Action Dispatch Flow

When an action is invoked (either by a sync or directly), the framework follows this path:

```
1. ActionInvocation arrives
   ├── concept: "urn:copf/Article"
   ├── action: "create"
   └── input: { article: "...", title: "...", ... }

2. Registry resolves concept URI → ConceptTransport

3. Transport dispatches to handler
   ├── handler["create"](input, storage)
   └── Returns { variant: "ok", article: "..." }

4. ActionCompletion produced
   ├── concept: "urn:copf/Article"
   ├── action: "create"
   ├── variant: "ok"
   └── output: { article: "..." }

5. Sync engine receives completion → triggers matching syncs
```

### ActionInvocation Shape

```typescript
interface ActionInvocation {
  id: string;           // Unique invocation ID
  concept: string;      // Concept URI (e.g., "urn:copf/Article")
  action: string;       // Action name (e.g., "create")
  input: Record<string, unknown>;  // Action parameters
  flow: string;         // Flow ID (groups related actions)
  sync?: string;        // Which sync produced this invocation
  timestamp: string;    // ISO 8601
}
```

### ActionCompletion Shape

```typescript
interface ActionCompletion {
  id: string;           // Unique completion ID
  concept: string;      // Concept URI
  action: string;       // Action name
  input: Record<string, unknown>;   // Original input (preserved)
  variant: string;      // Discriminant tag ("ok", "error", "notfound", etc.)
  output: Record<string, unknown>;  // Variant output fields
  flow: string;         // Flow ID
  timestamp: string;    // ISO 8601
}
```

The **completion** is what syncs match against. The `variant` field determines which sync path fires (e.g., `valid: true` vs `valid: false`).

## Concept Registration

### Basic Registration

```typescript
import { createKernel } from './kernel-factory';
import { articleHandler } from './article.impl';

const kernel = createKernel();
kernel.registerConcept('urn:copf/Article', articleHandler);
```

The kernel:
1. Creates an `InMemoryStorage` for the concept
2. Wraps the handler in an `InProcessAdapter` (ConceptTransport)
3. Registers the transport in the `ConceptRegistry`

### Versioned Registration (with migration support)

```typescript
await kernel.registerVersionedConcept('urn:copf/Article', articleHandler, 2);
```

This additionally:
1. Checks if the stored schema version differs from the spec version
2. If migration needed, wraps the transport in a `MigrationGatedTransport` that blocks non-migrate actions
3. Returns a `MigrationStatus` object

### Concept URIs

Convention: `urn:copf/<ConceptName>`

```
urn:copf/User
urn:copf/Password
urn:copf/JWT
urn:copf/Article
urn:copf/Comment
urn:copf/Echo
```

For testing, you may use `urn:test/<Name>` prefixes.

## The Kernel

The `createKernel()` factory produces a `FullKernel` with these methods:

```typescript
interface FullKernel {
  // Register a concept handler
  registerConcept(uri: string, handler: ConceptHandler): void;

  // Register a compiled sync
  registerSync(sync: CompiledSync): void;

  // Load and register syncs from a .sync file
  loadSyncs(path: string): Promise<void>;

  // Simulate an HTTP request (triggers Web/request completion)
  handleRequest(input: Record<string, unknown>): Promise<{
    flowId: string;
    body?: unknown;
    error?: string;
    code?: number;
  }>;

  // Invoke a concept action directly
  invokeConcept(uri: string, action: string, input: Record<string, unknown>):
    Promise<{ variant: string; [key: string]: unknown }>;

  // Get the action log for a flow
  getFlowLog(flowId: string): ActionRecord[];

  // Get a trace tree for a flow
  getFlowTrace(flowId: string): FlowTrace | null;

  // Parse a concept spec
  parseConcept(path: string): ConceptAST;

  // Register with migration support
  registerVersionedConcept(
    uri: string,
    handler: ConceptHandler,
    specVersion?: number,
  ): Promise<MigrationStatus | null>;
}
```

## Testing Implementations

### Test Framework

Tests use **Vitest**:

```typescript
import { describe, it, expect } from 'vitest';
```

Run tests with:

```bash
npx vitest run tests/<name>.test.ts
npx vitest run                        # All tests
```

### Test Level 1: Direct Handler Invocation

Test the handler via the kernel's `invokeConcept()` method:

```typescript
import { createKernel } from '../implementations/typescript/framework/kernel-factory';
import { echoHandler } from '../implementations/typescript/app/echo.impl';

describe('Echo Concept', () => {
  it('stores and echoes message', async () => {
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/Echo', echoHandler);

    const result = await kernel.invokeConcept('urn:copf/Echo', 'send', {
      id: 'msg-1',
      text: 'hello world',
    });

    expect(result.variant).toBe('ok');
    expect(result.echo).toBe('hello world');
    expect(result.id).toBe('msg-1');
  });
});
```

### Test Level 2: Invariant Conformance

From the concept spec's `invariant` section. Translate each `after`/`then` block into sequential calls:

```
invariant {
  after set(user: x, password: "secret") -> ok(user: x)
  then check(user: x, password: "secret") -> ok(valid: true)
  and  check(user: x, password: "wrong")  -> ok(valid: false)
}
```

Becomes:

```typescript
it('invariant: after set, check returns correct validity', async () => {
  const kernel = createKernel();
  kernel.registerConcept('urn:copf/Password', passwordHandler);

  // AFTER: set(user: x, password: "secret") -> ok(user: x)
  const step1 = await kernel.invokeConcept('urn:copf/Password', 'set', {
    user: 'test-user-x',
    password: 'secret12',   // Must satisfy validation (>= 8 chars)
  });
  expect(step1.variant).toBe('ok');
  expect(step1.user).toBe('test-user-x');

  // THEN: check(user: x, password: "secret") -> ok(valid: true)
  const step2 = await kernel.invokeConcept('urn:copf/Password', 'check', {
    user: 'test-user-x',
    password: 'secret12',
  });
  expect(step2.variant).toBe('ok');
  expect(step2.valid).toBe(true);

  // AND: check(user: x, password: "wrong") -> ok(valid: false)
  const step3 = await kernel.invokeConcept('urn:copf/Password', 'check', {
    user: 'test-user-x',
    password: 'wrongpassword',
  });
  expect(step3.variant).toBe('ok');
  expect(step3.valid).toBe(false);
});
```

**Free variable convention**: Invariant variables like `x`, `y`, `a` become deterministic test IDs: `'test-user-x'`, `'test-article-a'`, etc.

### Test Level 3: Error Paths

Test each error variant explicitly:

```typescript
it('returns notfound for missing article', async () => {
  const kernel = createKernel();
  kernel.registerConcept('urn:copf/Article', articleHandler);

  const result = await kernel.invokeConcept('urn:copf/Article', 'get', {
    article: 'nonexistent',
  });

  expect(result.variant).toBe('notfound');
  expect(result.message).toBeDefined();
});

it('returns error for duplicate name', async () => {
  const kernel = createKernel();
  kernel.registerConcept('urn:copf/User', userHandler);

  // First registration succeeds
  await kernel.invokeConcept('urn:copf/User', 'register', {
    user: 'u1', name: 'alice', email: 'a@b.com',
  });

  // Duplicate name fails
  const dup = await kernel.invokeConcept('urn:copf/User', 'register', {
    user: 'u2', name: 'alice', email: 'c@d.com',
  });
  expect(dup.variant).toBe('error');
  expect(dup.message).toContain('name already taken');
});
```

### Test Level 4: Flow Tests (with Syncs)

Test the concept within a complete sync-driven flow:

```typescript
it('processes echo flow with syncs', async () => {
  const kernel = createKernel();
  kernel.registerConcept('urn:copf/Echo', echoHandler);
  await kernel.loadSyncs(resolve(SYNCS_DIR, 'echo.sync'));

  const response = await kernel.handleRequest({
    method: 'echo',
    text: 'hello from sync',
  });

  expect(response.body).toBeDefined();

  // Verify provenance
  const flow = kernel.getFlowLog(response.flowId);
  expect(flow.length).toBeGreaterThanOrEqual(4);

  const completions = flow.filter(r => r.type === 'completion');
  const actions = completions.map(r => `${r.concept}/${r.action}`);
  expect(actions).toContain('urn:copf/Echo/send');
  expect(actions).toContain('urn:copf/Web/respond');
});
```

### Test Helpers

```typescript
import { resolve } from 'path';

const SPECS_DIR = resolve(__dirname, '../specs/app');
const SYNCS_DIR = resolve(__dirname, '../syncs/app');
```

### Test File Placement

```
tests/
├── echo-flow.test.ts           # Echo concept + flow
├── registration-flow.test.ts   # User + Password + JWT flow
├── sync-engine.test.ts         # Framework engine tests
├── sync-parser-compiler.test.ts # Parser/compiler tests
└── <concept>-flow.test.ts      # Your new tests
```

## Sync Registration for Tests

Two approaches for registering syncs in tests:

### Inline (precise control)

```typescript
kernel.registerSync({
  name: 'HandleEcho',
  when: [{
    concept: 'urn:copf/Web', action: 'request',
    inputFields: [
      { name: 'method', match: { type: 'literal', value: 'echo' } },
      { name: 'text', match: { type: 'variable', name: 'text' } },
    ],
    outputFields: [
      { name: 'request', match: { type: 'variable', name: 'request' } },
    ],
  }],
  where: [{ type: 'bind', expr: 'uuid()', as: 'id' }],
  then: [{
    concept: 'urn:test/Echo', action: 'send',
    fields: [
      { name: 'id', value: { type: 'variable', name: 'id' } },
      { name: 'text', value: { type: 'variable', name: 'text' } },
    ],
  }],
});
```

### From file (production-like)

```typescript
await kernel.loadSyncs(resolve(SYNCS_DIR, 'echo.sync'));
```

Prefer file-based for flow tests, inline for precise unit tests.
