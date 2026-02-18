---
name: create-implementation
description: Write a TypeScript implementation for a COPF concept — the handler that implements each action defined in the concept spec. Covers storage patterns, variant returns, input extraction, and testing.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<concept-name>"
---

# Create a COPF Concept Implementation

Write a TypeScript handler for the concept **$ARGUMENTS** that implements every action from its `.concept` spec.

## What is a Concept Implementation?

A concept implementation is a **handler object** that provides one async function per action declared in the concept spec. Each function receives untyped `input` and a `storage` interface, and returns a **variant completion** (a discriminated union like `{ variant: 'ok', ... }` or `{ variant: 'error', ... }`).

```typescript
import type { ConceptHandler } from '@copf/kernel';

export const myHandler: ConceptHandler = {
  async actionName(input, storage) {
    const field = input.field as string;
    // ... business logic using storage ...
    return { variant: 'ok', field };
  },
};
```

Implementations are **pure business logic** — they never reference other concepts. All cross-concept coordination happens through syncs.

## Step-by-Step Process

### Step 1: Read the Concept Spec

Every implementation must match its `.concept` spec exactly. The spec defines:
- **Type parameters** — the generic types (e.g., `[U]` for user, `[A]` for article)
- **State** — the relations (storage tables) the concept manages
- **Actions** — the functions to implement, with their parameters and return variants
- **Invariants** — behavioral contracts the implementation must satisfy

Find and read the spec from `specs/app/<name>.concept` or `specs/framework/<name>.concept`.

Example spec structure:
```
concept Article [A] {
  purpose { Manage articles with title, description, body, and author. }

  state {
    articles: set A
    slug: A -> String
    title: A -> String
    ...
  }

  actions {
    action create(article: A, title: String, ...) {
      -> ok(article: A) { Add article to set. Store all fields. }
    }
    action update(article: A, title: String, ...) {
      -> ok(article: A) { Update fields. }
      -> notfound(message: String) { If article does not exist. }
    }
  }

  invariant {
    after create(article: a, title: "Test", ...) -> ok(article: a)
    then get(article: a) -> ok(article: a, title: "Test", ...)
  }
}
```

### Step 2: Create the Handler File

Place the file at:
```
implementations/typescript/app/<name>.impl.ts        # App concepts
implementations/typescript/framework/<name>.impl.ts   # Framework concepts
```

Start with the imports and handler skeleton:

```typescript
import type { ConceptHandler } from '@copf/kernel';

export const <name>Handler: ConceptHandler = {
  // One async method per action from the spec
};
```

### Step 3: Implement Each Action

For each action in the spec, write an async method on the handler object. Follow this pattern:

```typescript
async actionName(input, storage) {
  // 1. Extract input fields with type assertions
  const field1 = input.field1 as string;
  const field2 = input.field2 as number;

  // 2. Business logic (validation, lookup, computation)

  // 3. Storage operations (read/write)

  // 4. Return a variant completion
  return { variant: 'ok', outputField: value };
},
```

#### Input Extraction

All inputs arrive as `Record<string, unknown>`. Cast each field to its TypeScript type:

| Spec Type | TypeScript Cast | Example |
|-----------|----------------|---------|
| `String` | `as string` | `input.name as string` |
| `Int` | `as number` | `input.count as number` |
| `Float` | `as number` | `input.rate as number` |
| `Bool` | `as boolean` | `input.active as boolean` |
| `Bytes` | `as string` (base64) | `input.data as string` |
| `DateTime` | `as string` (ISO 8601) | `input.created as string` |
| `ID`, type param | `as string` | `input.user as string` |

#### Variant Returns

Return exactly the variants declared in the spec. The `variant` field is the discriminant:

```typescript
// Spec: -> ok(user: U) { ... }
return { variant: 'ok', user };

// Spec: -> error(message: String) { ... }
return { variant: 'error', message: 'name already taken' };

// Spec: -> notfound(message: String) { ... }
return { variant: 'notfound', message: 'Article not found' };

// Spec: -> ok(valid: Bool) { ... }
return { variant: 'ok', valid: true };
```

### Step 4: Wire Up Storage

Read [references/storage-interface.md](references/storage-interface.md) for the complete API.

Each concept gets its own isolated `ConceptStorage`. Storage is document-oriented — each **relation** from the spec maps to a storage collection.

**Relation naming convention**: The spec's state section defines relations. In implementations, use the entity name as the relation:

```
state { articles: set A; title: A -> String; ... }
→ storage relation: 'article'

state { hash: U -> Bytes; salt: U -> Bytes }
→ storage relation: 'password'
```

The key for each record is the type parameter value (the entity ID).

#### Storage Operations

```typescript
// Create / Update
await storage.put('article', articleId, {
  article: articleId, slug, title, description, body, author,
  createdAt: now, updatedAt: now,
});

// Read one
const record = await storage.get('article', articleId);
if (!record) return { variant: 'notfound', message: 'Article not found' };

// Query by criteria
const matches = await storage.find('user', { email });
if (matches.length > 0) return { variant: 'error', message: 'email taken' };

// Delete one
await storage.del('article', articleId);

// Delete many by criteria
const count = await storage.delMany('comment', { target: articleId });
```

### Step 5: Handle State Patterns

Read [references/handler-anatomy.md](references/handler-anatomy.md) for all patterns.

Common patterns that appear across implementations:

| Pattern | When to use | Example |
|---------|-------------|---------|
| **Uniqueness check** | Before creating entities | `find('user', { name })` before `put()` |
| **Existence check** | Before update/delete/get | `get('article', id)`, return `notfound` if null |
| **Read-modify-write** | Updating partial fields | `get()`, spread `{...existing, ...updates}`, `put()` |
| **Array mutation** | Set-valued relations | `get()`, push/filter array, `put()` |
| **Derived fields** | Computed from inputs | Slug from title, hash from password |
| **Timestamps** | Created/updated tracking | `new Date().toISOString()` |

### Step 6: Declare Capabilities

If the concept spec declares `capabilities { requires crypto }`, import from Node.js:

```typescript
import { createHash, createHmac, randomBytes } from 'crypto';
```

Other capability patterns:
- `requires crypto` → `import { createHash, randomBytes } from 'crypto'`
- `requires fs` → `import { readFileSync } from 'fs'`
- No capabilities → No special imports needed

### Step 7: Write Tests

Read [references/action-dispatch.md](references/action-dispatch.md) for the testing framework.

Write tests in `tests/<name>.test.ts` or `tests/<name>-flow.test.ts`. Three test levels:

#### Unit test (handler in isolation)

```typescript
import { describe, it, expect } from 'vitest';
import { createKernel } from '../implementations/typescript/framework/kernel-factory';
import { myHandler } from '../implementations/typescript/app/my.impl';

describe('My Concept', () => {
  it('performs action correctly', async () => {
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/My', myHandler);

    const result = await kernel.invokeConcept('urn:copf/My', 'action', {
      field: 'value',
    });

    expect(result.variant).toBe('ok');
    expect(result.field).toBe('value');
  });
});
```

#### Invariant test (from spec)

The spec's `invariant` section defines behavioral contracts. Implement them as sequential action calls:

```typescript
it('satisfies invariant: after set, check returns true', async () => {
  const kernel = createKernel();
  kernel.registerConcept('urn:copf/Password', passwordHandler);

  // AFTER clause
  const step1 = await kernel.invokeConcept('urn:copf/Password', 'set', {
    user: 'test-user', password: 'secret123',
  });
  expect(step1.variant).toBe('ok');

  // THEN clause
  const step2 = await kernel.invokeConcept('urn:copf/Password', 'check', {
    user: 'test-user', password: 'secret123',
  });
  expect(step2.variant).toBe('ok');
  expect(step2.valid).toBe(true);
});
```

#### Flow test (with syncs)

```typescript
it('processes full flow', async () => {
  const kernel = createKernel();
  kernel.registerConcept('urn:copf/My', myHandler);
  await kernel.loadSyncs(resolve(SYNCS_DIR, 'my.sync'));

  const response = await kernel.handleRequest({ method: 'my_action', ... });
  expect(response.body).toBeDefined();

  const flow = kernel.getFlowLog(response.flowId);
  expect(flow.length).toBeGreaterThanOrEqual(4);
});
```

### Step 8: Register the Concept

In the application bootstrap, register with the kernel:

```typescript
import { createKernel } from './kernel-factory';
import { myHandler } from './my.impl';

const kernel = createKernel();
kernel.registerConcept('urn:copf/My', myHandler);
```

For versioned concepts (with schema migration support):

```typescript
await kernel.registerVersionedConcept('urn:copf/My', myHandler, 2);
```

## Checklist

Before considering the implementation complete:

- [ ] One async method per action in the spec
- [ ] All input fields extracted with correct type casts
- [ ] Every variant from the spec is returned on the appropriate code path
- [ ] Storage relation names match the spec's state section
- [ ] Uniqueness checks before creates (if spec mentions uniqueness)
- [ ] Existence checks before updates/deletes/gets
- [ ] Invariants from the spec pass as tests
- [ ] No references to other concepts (all coordination via syncs)
- [ ] Handler exported as `const <name>Handler: ConceptHandler`
- [ ] Capabilities imported if spec declares them

## Quick Reference

See [references/handler-anatomy.md](references/handler-anatomy.md) for the handler interface and all action patterns.
See [references/storage-interface.md](references/storage-interface.md) for the full storage API.
See [references/action-dispatch.md](references/action-dispatch.md) for dispatch, testing, and registration.
See [examples/realworld-implementations.md](examples/realworld-implementations.md) for all RealWorld app implementations.
See [templates/implementation-scaffold.md](templates/implementation-scaffold.md) for copy-paste templates.
