---
name: create-concept
description: Design and create a new concept for the Concept-Oriented Programming Framework following Daniel Jackson's concept design methodology. Ensures proper scoping, independence, state sufficiency, and operational principles.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<concept-name> [--domain app|framework]"
---

# Create a New COPF Concept

Design and implement a new concept named **$ARGUMENTS** following Daniel Jackson's concept design methodology from "The Essence of Software."

## Core Design Principles (Always Apply)

Before writing any code, internalize these three principles:

1. **Singularity** — Every concept has exactly ONE purpose. If you find yourself writing "and also..." in the purpose, you need two concepts.
2. **Independence** — A concept can be understood entirely on its own. It never references another concept's types or calls another concept's actions. Use type parameters for polymorphism.
3. **Sufficiency & Necessity** — State must contain everything actions need (sufficiency), and nothing they don't (necessity). If a field is never read by any action, remove it.

## Step-by-Step Design Process

### Step 1: Articulate the Purpose

The purpose answers: **What is this concept for?** Not what it does — what it's *for*.

Write 1-3 sentences. Use imperative present tense. Be specific about the value delivered.

Read [references/jackson-methodology.md](references/jackson-methodology.md) for Jackson's full methodology on purpose, the operational principle, and the three design criteria.

**Purpose checklist:**
- [ ] Can you state the purpose in one sentence?
- [ ] Does it describe a *why*, not just a *what*?
- [ ] Would a user understand this purpose without seeing the implementation?
- [ ] Is there exactly ONE purpose, not two stitched together?

**Purpose wording patterns from this codebase:**

| Pattern | Example |
|---------|---------|
| Entity management | "Manage articles with slugs, titles, bodies, and metadata." |
| Relationship tracking | "Track follower relationships between users." |
| Secure operation | "Securely store and validate user credentials using salted hashing." |
| Transformation | "Transform parsed concept ASTs into language-neutral ConceptManifests." |
| Generation | "Generate TypeScript skeleton code from a ConceptManifest." |

### Step 2: Identify the Type Parameter

Every COPF concept is parameterized by exactly one type parameter — the primary entity or resource it manages. This makes the concept polymorphic and independent.

Choose a single uppercase letter:
- **U** for user-keyed concepts (Password, Profile, Follow, JWT)
- **A** for article-like content entities
- **C** for comments or items
- **T** for tags or tokens
- **S** for specs or schemas
- **F** for flows
- **R** for records
- **M** for messages or manifests

The type parameter appears in state relations and action signatures. On the wire, it is always an opaque string identifier.

### Step 3: Design the State

Read [references/state-design.md](references/state-design.md) for the complete state design reference.

State is what the concept remembers. Apply these rules:

1. **Start from the purpose** — What must the concept remember to fulfill its purpose?
2. **Primary collection** — Does the concept manage a set of entities? If yes, declare `items: set T` (or `users: set U`, etc.)
3. **Properties as relations** — Each property of an entity becomes a relation: `title: A -> String`
4. **User-to-many mappings** — For relationships: `following: U -> set String`
5. **No dead state** — Every field must be read or written by at least one action

**State checklist:**
- [ ] Every action's input can be served from this state
- [ ] Every action's output can be produced from this state
- [ ] No field is unused by all actions
- [ ] Type parameter is used in at least one relation
- [ ] State is visible/understandable to users (not internal bookkeeping)

### Step 4: Design the Actions

Read [references/action-design.md](references/action-design.md) for action design patterns and variant conventions.

Actions are the concept's API. Each action:
- Reads and/or modifies state
- Returns a discriminated union of variants (at minimum `ok`)
- Has a prose description explaining *when* each variant occurs

**Action design rules:**
1. **Complete coverage** — For every state field, there must be at least one action that writes it and one that reads it
2. **Return variants** — `ok` is always first. Add `notfound` when looking up by ID, `error` for validation failures, `invalid` for constraint violations
3. **Mutations return the entity** — `-> ok(article: A)` echoes back the entity ID
4. **Queries return the data** — `-> ok(following: Bool)` returns the queried value
5. **Prose in variants** — Describe the *condition* for each variant, not the implementation

**Description quality rules (mandatory):**

Every variant description MUST be a clear, concise explanation of *when this outcome occurs and what it means*. 1-2 sentences. Apply these checks:

1. **Don't echo the action name** — The description must add information beyond what the action/variant name already conveys.
   - BAD: `-> ok() { State registered. }` (just echoes "defineState")
   - GOOD: `-> ok() { Add a new named state to the workflow's state graph with the given flags. }`

2. **Don't be vague** — Avoid generic phrases like "failed", "error occurred", "operation succeeded".
   - BAD: `-> error(message: String) { Capture failed. }`
   - GOOD: `-> error(message: String) { The URL was unreachable or returned an unsupported content type. }`

3. **Explain the "why" for non-ok variants** — Error/failure variants should explain what condition triggers them.
   - BAD: `-> notfound(message: String) { Not found. }`
   - GOOD: `-> notfound(message: String) { No session exists with this identifier. }`

4. **Don't over-explain ok variants** — For the happy path, describe what the action accomplishes, not how it works internally.
   - BAD: `-> ok(token: String) { This function generates a cryptographically secure random token using the crypto module, stores it in the sessions map indexed by session ID, sets the expiration timestamp to current time plus the configured TTL, and marks the session as valid in the isValid map. }`
   - GOOD: `-> ok(token: String) { Create a new session for the given user and device, generate a token, and set the expiration. }`

5. **One sentence is often enough** — Don't pad descriptions. If "No session exists with this identifier." fully explains the variant, stop there.

### Step 5: Write the Operational Principle (Invariants)

Read [references/invariant-design.md](references/invariant-design.md) for invariant patterns, anti-patterns, and detailed guidance.

The operational principle is a "defining story" — a scenario that proves the concept fulfills its purpose. In COPF, these are expressed as `invariant` blocks.

**Every concept MUST have at least one invariant.** A concept without invariants has no machine-verifiable behavioral contract and cannot generate meaningful conformance tests.

```
invariant {
  after <setup-action>(...) -> ok(...)
  then <verification-action>(...) -> ok(...)
  and  <additional-check>(...) -> <expected-variant>(...)
}
```

#### What makes an invariant meaningful

A meaningful invariant would **catch a real bug** if the implementation were broken. The litmus test: *if you replaced the handler with a stub that always returns `{ variant: 'ok' }`, would this invariant fail?* If not, it's testing nothing.

**Three rules for meaningful invariants:**

1. **Exercise real logic** — Input must be rich enough to pass through the handler's actual code paths, not just hit a guard clause. For a code generator that iterates over `manifest.actions[].variants[]`, you need at least one action with one variant. An empty `actions: []` tests nothing.

2. **Test different behaviors** — The `after` and `then` steps must exercise different code paths. Good pairings:
   - Create → Query (state was stored correctly)
   - Register → Match (registration enables matching)
   - Valid input → Invalid input (happy path vs error path)
   - Bad pairings: same action twice with slightly different strings, or two identical error checks

3. **Match the handler's interface** — Field names and nesting must match what the handler code actually reads. If the handler reads `variant.tag`, don't write `tag: "ok"` in the spec but `name: "ok"` in the invariant. Read the handler code or type definitions.

#### Common anti-patterns to avoid

```
// BAD: Guard clause only — both steps do the same thing
invariant {
  after generate(spec: "x") -> ok(manifest: m)
  then generate(spec: "y") -> ok(manifest: n)
}

// BAD: Degenerate input — empty object skips all logic
invariant {
  after generate(spec: "s1", ast: {}) -> error(message: e1)
  then generate(spec: "s2", ast: {}) -> error(message: e2)
}
```

#### Domain concept patterns

| Pattern | What it proves | Example |
|---------|---------------|---------|
| Create → Query | "What you store is what you get back" | Article: create then get |
| Mutate → Verify → Reverse | "Changes are observable and reversible" | Follow: follow → isFollowing → unfollow |
| Set → Check correct → Check wrong | "Validation distinguishes good from bad" | Password: set → check right → check wrong |
| Create → Create duplicate | "Constraints are enforced" | User: register → register same name |

#### Framework/infrastructure concept patterns

For concepts that process structured data (ASTs, manifests, configs), use record `{ }` and list `[ ]` literals:

```
invariant {
  after generate(spec: "s1", manifest: {
    name: "Ping", uri: "urn:copf/Ping", typeParams: [],
    actions: [{ name: "ping", params: [],
      variants: [{ tag: "ok", fields: [] }] }],
    invariants: [], graphqlSchema: "",
    jsonSchemas: { invocations: {}, completions: {} },
    capabilities: [], purpose: "A test."
  }) -> ok(files: f)
  then generate(spec: "s2", manifest: { name: "" }) -> error(message: e)
}
```

The first step passes the **smallest complete input** that exercises the handler's core logic. The second step passes structurally broken input.

For multi-step flow concepts (SyncEngine, FlowTrace), the second step should **depend on state** from the first:
```
invariant {
  after registerSync(sync: { ... when-clause matching concept A ... }) -> ok()
  then onCompletion(completion: { concept: A, action: "act", ... }) -> ok(invocations: inv)
}
```

#### Final quality check

Before finalizing, answer these questions:
- Would a trivial stub handler pass this invariant? **It must not.**
- Does the first step input include enough structure to exercise the handler's core transformation/logic? **Not just guard clauses.**
- Does the second step test genuinely different behavior from the first? **Not the same call with a different string.**
- Do field names exactly match the types the handler reads? **Read the code or types.**

### Step 6: Declare Capabilities (If Needed)

Only add capabilities if the concept requires external runtime support:

```
capabilities {
  requires crypto           // Needs cryptographic operations
  requires persistent-storage  // Needs durable storage
}
```

Most concepts don't need this section.

### Step 7: Check Against Anti-Patterns

Read [references/anti-patterns.md](references/anti-patterns.md) for common mistakes.

Run through this final checklist:

- [ ] **Not overloaded** — Concept has exactly one purpose
- [ ] **Not over-scoped** — No state fields or actions that serve a different purpose
- [ ] **Not coupled** — No references to other concept types (use type params instead)
- [ ] **Not under-specified** — All state fields are covered by actions
- [ ] **Not missing invariants** — At least one operational principle for EVERY concept (domain and framework)
- [ ] **Proper naming** — Actions use verb-first names, variants use lowercase tags

### Step 8: Write the .concept File

Place the file at:
- `specs/app/<name>.concept` for domain/application concepts
- `specs/framework/<name>.concept` for infrastructure/framework concepts

See [references/concept-grammar.md](references/concept-grammar.md) for the complete grammar reference.

Section order is always:
1. `purpose { ... }`
2. `state { ... }`
3. `capabilities { ... }` (optional)
4. `actions { ... }`
5. `invariant { ... }` (one block per invariant)

### Step 9: Validate by Parsing

Run the parser to verify your concept is syntactically valid:

```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { parseConceptFile } from './handlers/ts/framework/spec-parser.handler.js';

const source = readFileSync('specs/<domain>/<name>.concept', 'utf-8');
const ast = parseConceptFile(source);
console.log('Parsed:', ast.name);
console.log('Type params:', ast.typeParams);
console.log('State fields:', ast.state.length);
console.log('Actions:', ast.actions.map(a => a.name));
console.log('Invariants:', ast.invariants.length);
console.log('Capabilities:', ast.capabilities);
"
```

### Step 10: Generate Schema and Code

Run the full pipeline to verify your concept produces valid output:

```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { parseConceptFile } from './handlers/ts/framework/spec-parser.handler.js';
import { createInMemoryStorage } from './kernel/src/storage.js';
import { schemaGenHandler } from './handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from './handlers/ts/framework/typescript-gen.handler.js';

const source = readFileSync('specs/<domain>/<name>.concept', 'utf-8');
const ast = parseConceptFile(source);

// Generate manifest
const s1 = createInMemoryStorage();
const schema = await schemaGenHandler.generate({ spec: 'test', ast }, s1);
if (schema.variant !== 'ok') { console.error('Schema error:', schema.message); process.exit(1); }
console.log('Manifest URI:', schema.manifest.uri);
console.log('Relations:', schema.manifest.relations.length);
console.log('Actions:', schema.manifest.actions.map(a => a.name));

// Generate TypeScript
const s2 = createInMemoryStorage();
const code = await typescriptGenHandler.generate({ spec: 'test', manifest: schema.manifest }, s2);
if (code.variant !== 'ok') { console.error('Codegen error:', code.message); process.exit(1); }
for (const f of code.files) {
  console.log('---', f.path, '---');
  console.log(f.content.slice(0, 200) + '...');
}
"
```

### Step 11: Run Full Check

```bash
npx tsx cli/src/index.ts check
```

This validates all concepts in the project parse correctly.

## Quick Reference: Concept Structure

```
concept Name [T] {

  purpose {
    One to three sentences explaining what this concept is FOR.
    Not what it does — what value it delivers.
  }

  state {
    items: set T                    // Primary entity collection
    property: T -> String           // Entity property (single value)
    relation: T -> set String       // Entity to many (set of IDs)
    metadata: T -> DateTime         // Typed property
  }

  capabilities {
    requires <capability>           // Only if needed
  }

  actions {
    action create(item: T, property: String) {
      -> ok(item: T) {
        Add a new item with the given property value.
      }
      -> error(message: String) {
        An item with this identifier already exists, or the
        property value violates a constraint.
      }
    }

    action get(item: T) {
      -> ok(item: T, property: String) {
        Return the item and its current property value.
      }
      -> notfound(message: String) {
        No item exists with this identifier.
      }
    }
  }

  invariant {
    after create(item: x, property: "test") -> ok(item: x)
    then get(item: x) -> ok(item: x, property: "test")
  }
}
```

## Example Walkthroughs

For complete examples with design rationale:
- [examples/domain-concepts.md](examples/domain-concepts.md) — Password, Follow, Article, User
- [examples/framework-concepts.md](examples/framework-concepts.md) — SchemaGen, Registry, SyncEngine

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept-kit` | Bundle multiple related concepts into a reusable kit |
| `/create-sync` | Write sync rules that connect this concept to others |
| `/create-implementation` | Write the TypeScript implementation for this concept |
| `/decompose-feature` | Break down a feature into concepts before designing each one |
