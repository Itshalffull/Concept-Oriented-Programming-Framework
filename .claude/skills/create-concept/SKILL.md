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

### Step 5: Write the Operational Principle (Invariants)

Read [references/invariant-design.md](references/invariant-design.md) for invariant patterns.

The operational principle is a "defining story" — a scenario that proves the concept fulfills its purpose. In COPF, these are expressed as `invariant` blocks.

**Every concept with user-facing behavior should have at least one invariant.** The invariant demonstrates the concept's core workflow:

```
invariant {
  after <setup-action>(...) -> ok(...)
  then <verification-action>(...) -> ok(...)
  and  <additional-check>(...) -> <expected-variant>(...)
}
```

**Invariant patterns:**
- **Create then query**: Verify created entities are retrievable
- **Mutate then verify**: Verify state changes are observable
- **Action then reverse**: Verify undo/toggle behavior
- **Constraint violation**: Verify that invalid operations fail correctly

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
- [ ] **Not missing invariants** — At least one operational principle for domain concepts
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
import { parseConceptFile } from './implementations/typescript/framework/spec-parser.impl.js';

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
import { parseConceptFile } from './implementations/typescript/framework/spec-parser.impl.js';
import { createInMemoryStorage } from './kernel/src/storage.js';
import { schemaGenHandler } from './implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from './implementations/typescript/framework/typescript-gen.impl.js';

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
npx tsx tools/copf-cli/src/index.ts check
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
        What happens on success.
      }
      -> error(message: String) {
        When this variant is returned.
      }
    }

    action get(item: T) {
      -> ok(item: T, property: String) {
        Returns the item's data.
      }
      -> notfound(message: String) {
        If the item does not exist.
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
