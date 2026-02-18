---
name: add-language-target
description: Add a new language target (code generator) to the Concept-Oriented Programming Framework. Use when adding support for generating code in a new programming language (e.g., Swift, Go, Python, Kotlin, C#) from concept specifications.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<language-name>"
---

# Add Language Target to COPF

Create a new code generation target for **$ARGUMENTS** in the Concept-Oriented Programming Framework.

## Overview

COPF generates code from `.concept` specification files through a pipeline:

```
.concept file  -->  Parser  -->  ConceptAST  -->  SchemaGen  -->  ConceptManifest (IR)  -->  CodeGen  -->  Target files
```

A language target is a **code generator** that reads from the language-neutral `ConceptManifest` intermediate representation and emits idiomatic target-language files. You do NOT touch the parser or schema generator — only the final CodeGen stage.

Every generator produces exactly **4 file types** per concept:

| File | Purpose |
|------|---------|
| **types** | Type definitions for action inputs and discriminated-union outputs |
| **handler** | Interface/trait with one method per action |
| **adapter** | Transport adapter: deserialize invocation, dispatch to handler, serialize completion |
| **conformance tests** | Test cases generated from concept invariants (only when invariants exist) |

## Step-by-Step Process

Follow these steps in order. Each step references deeper documentation — read those files when you reach that step.

### Step 1: Understand the Type System

Read [references/type-system.md](references/type-system.md) to understand `ResolvedType` — the recursive type tree every generator must map to its target language.

Create a **type mapping table** for $ARGUMENTS before writing any code:

| COPF Type | $ARGUMENTS Type |
|-----------|-----------------|
| String | ? |
| Int | ? |
| Float | ? |
| Bool | ? |
| Bytes | ? |
| DateTime | ? |
| ID | ? |
| option T | ? |
| set T | ? |
| list T | ? |
| A -> B (map) | ? |
| record { fields } | ? |
| Type param (opaque) | ? (always string on wire) |

### Step 2: Understand the ConceptManifest IR

Read [references/concept-manifest.md](references/concept-manifest.md) to understand the exact shape of the data your generator receives. The manifest contains everything needed: actions, params, variants, relations, invariants, capabilities.

### Step 3: Study the Generator Pattern

Read [references/generator-pattern.md](references/generator-pattern.md) to understand the `ConceptHandler` interface your generator must implement, and the 4-file output structure.

For complete working examples of existing generators, see:
- [examples/typescript-target.md](examples/typescript-target.md) — TypeScript generator (simplest reference)
- [examples/rust-target.md](examples/rust-target.md) — Rust generator (shows struct/trait/enum patterns)

### Step 4: Create the Concept Spec

Create a `.concept` file at `specs/framework/<lang>-gen.concept` following the established pattern:

```
concept <Lang>Gen [S] {
  purpose {
    Generate <Language> skeleton code from a ConceptManifest.
    Produces type definitions, handler <interface/trait/protocol>,
    transport adapter, and conformance tests.
  }

  state {
    outputs: S -> list { path: String, content: String }
  }

  actions {
    action generate(spec: S, manifest: ConceptManifest) {
      -> ok(files: list { path: String, content: String }) {
        Map ResolvedTypes to <Language> types.
        Emit type definitions for action inputs/outputs.
        Emit handler <interface/trait/protocol> with one method per action.
        Emit transport adapter.
        Emit conformance tests.
      }
      -> error(message: String) {
        If the manifest contains types not mappable to <Language>.
      }
    }
  }
}
```

### Step 5: Implement the Generator

Create the implementation at `implementations/typescript/framework/<lang>-gen.impl.ts`.

Use the scaffold from [templates/generator-scaffold.md](templates/generator-scaffold.md) as your starting point, then fill in the language-specific type mapping and code generation functions.

The implementation file is a TypeScript file that:
1. Imports `ConceptHandler`, `ConceptManifest`, `ResolvedType` from `kernel/src/types.js`
2. Implements `resolvedTypeTo<Lang>(t: ResolvedType): string` — recursive type mapper
3. Implements `generateTypesFile(manifest)` — type definitions
4. Implements `generateHandlerFile(manifest)` — handler interface/trait/protocol
5. Implements `generateAdapterFile(manifest)` — transport adapter
6. Implements `generateConformanceTestFile(manifest)` — tests from invariants
7. Exports `<lang>GenHandler: ConceptHandler` with a `generate` action

### Step 6: Wire into the CLI

Read [references/cli-integration.md](references/cli-integration.md), then update `tools/copf-cli/src/commands/generate.ts`:

1. Add the language to `SUPPORTED_TARGETS`
2. Import the handler
3. Add the handler to the generator selection logic

### Step 7: Verify by Executing Directly

Do NOT use the `copf` CLI binary. Instead, execute TypeScript files directly via `npx tsx`:

```bash
# Verify the generator works on a known concept
npx tsx -e "
import { readFileSync } from 'fs';
import { parseConceptFile } from './implementations/typescript/framework/spec-parser.impl.js';
import { createInMemoryStorage } from './kernel/src/storage.js';
import { schemaGenHandler } from './implementations/typescript/framework/schema-gen.impl.js';
import { <lang>GenHandler } from './implementations/typescript/framework/<lang>-gen.impl.js';

const source = readFileSync('specs/app/password.concept', 'utf-8');
const ast = parseConceptFile(source);
const storage1 = createInMemoryStorage();
const schemaResult = await schemaGenHandler.generate({ spec: 'test', ast }, storage1);
const manifest = schemaResult.manifest;

const storage2 = createInMemoryStorage();
const result = await <lang>GenHandler.generate({ spec: 'test', manifest }, storage2);
console.log('Variant:', result.variant);
for (const f of result.files) {
  console.log('---', f.path, '---');
  console.log(f.content);
}
"
```

### Step 8: Write Tests

Create `tests/<lang>-gen.test.ts` following the pattern in the existing test files. Tests should verify:

1. The concept spec exists and matches the generator pattern
2. Type definitions are generated correctly (primitive mappings, type params)
3. Handler interface/trait is generated with correct method signatures
4. Adapter dispatches to correct action methods
5. Conformance tests are generated from invariants
6. Concepts without invariants don't produce a conformance file
7. Invalid manifests return error variant

Run tests with:
```bash
npx vitest run tests/<lang>-gen.test.ts
```

### Step 9: Generate for All Concepts

Once tests pass, run the full generate pipeline to verify against all concept specs:

```bash
npx tsx tools/copf-cli/src/index.ts generate --target <lang>
```

This will generate $ARGUMENTS code for all concepts in `specs/` and write output to `generated/<lang>/`.

## Key Principles

- **Read from ConceptManifest, not AST** — your generator never touches the parser
- **Type params are always `string` on the wire** — they're opaque identifiers
- **Idiomatic output** — use the target language's conventions (snake_case for Rust/Python, camelCase for Java/Kotlin, etc.)
- **Deterministic output** — same manifest must always produce identical code
- **No external dependencies in generated code** — only reference the COPF runtime types

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design concept specs that the language target generates code from |
| `/create-implementation` | Write TypeScript implementations (the reference target) |
| `/create-concept-kit` | Create kits whose concepts need code generation in the new language |
