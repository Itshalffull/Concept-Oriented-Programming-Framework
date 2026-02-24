# Generator Pattern Reference

## The ConceptHandler Interface

Every code generator is itself a COPF concept implementation. It exports a `ConceptHandler` with a single `generate` action:

```typescript
// From kernel/src/types.ts
interface ConceptHandler {
  [actionName: string]: (
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) => Promise<{ variant: string; [key: string]: unknown }>;
}
```

Your generator handler has this shape:

```typescript
export const <lang>GenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;          // Reference identifier
    const manifest = input.manifest as ConceptManifest;  // The IR to generate from

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const files: { path: string; content: string }[] = [
        { path: '<name>.<ext>', content: generateTypesFile(manifest) },
        { path: '<name>.<ext>', content: generateHandlerFile(manifest) },
        { path: '<name>.<ext>', content: generateAdapterFile(manifest) },
      ];

      // Only add conformance tests if invariants exist
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: '<name>.<ext>', content: conformanceTest });
      }

      // Return files — BuildCache and Emitter handle caching and writing via syncs
      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
```

## The 4-File Output Structure

### File 1: Type Definitions

Generates type definitions for every action's input and output.

**Input types**: One struct/interface per action with fields matching the action's `params`.

**Output types**: A discriminated union (tagged enum) per action. Each variant has a `variant` tag string plus its own fields.

Pattern for action `check(user: U, password: String) -> ok(valid: Bool) | notfound(message: String)`:

- Input type: `{ user: string, password: string }`
- Output type: `{ variant: "ok", valid: boolean } | { variant: "notfound", message: string }`

**Naming convention**: `<ConceptName><ActionName>Input` and `<ConceptName><ActionName>Output`

Example for `Password` concept, `check` action:
- TypeScript: `PasswordCheckInput`, `PasswordCheckOutput`
- Rust: `PasswordCheckInput`, `PasswordCheckOutput` (enum)
- Swift might use: `PasswordCheckInput`, `PasswordCheckOutput` (enum with associated values)

### File 2: Handler Interface

Generates an interface/trait/protocol with one method per action.

Each method:
- Takes the action's input type
- Takes a `ConceptStorage` reference
- Returns the action's output type (wrapped in async/Promise/Result as appropriate)

Pattern:
```
interface <Concept>Handler {
  <action>(input: <Concept><Action>Input, storage: ConceptStorage): Promise<<Concept><Action>Output>;
}
```

### File 3: Transport Adapter

Generates a transport adapter that bridges the handler to the COPF runtime. The adapter:

1. Receives an `ActionInvocation` (JSON)
2. Deserializes the input into the typed input struct
3. Dispatches to the correct handler method based on `invocation.action`
4. Wraps the handler result into an `ActionCompletion` (JSON)

The adapter implements/conforms to `ConceptTransport`:

```typescript
interface ConceptTransport {
  invoke(invocation: ActionInvocation): Promise<ActionCompletion>;
  query(request: ConceptQuery): Promise<Record<string, unknown>[]>;
  health(): Promise<{ available: boolean; latency: number }>;
  queryMode: 'graphql' | 'lite';
}
```

Key types the adapter works with:

```typescript
interface ActionInvocation {
  id: string;
  concept: string;
  action: string;
  input: Record<string, unknown>;
  flow: string;
  timestamp: string;
}

interface ActionCompletion {
  id: string;
  concept: string;
  action: string;
  input: Record<string, unknown>;
  variant: string;
  output: Record<string, unknown>;
  flow: string;
  timestamp: string;
}
```

### File 4: Conformance Tests (Conditional)

Generated **only** when the concept has invariants. Invariants are behavioral specifications that define expected action sequences and outcomes.

Each invariant has:
- **Free variables**: Placeholder values for testing (e.g., `x` gets value `"u-test-invariant-001"`)
- **Setup steps** (AFTER clause): Actions that establish state
- **Assertion steps** (THEN clause): Actions that verify behavior

The test:
1. Creates a fresh in-memory storage
2. Declares free variable bindings with deterministic test values
3. Executes each setup step, asserting the expected variant
4. Executes each assertion step, asserting both the variant and output field values

### File Path Conventions

**TypeScript target**: flat file naming
```
password.types.ts
password.handler.ts
password.adapter.ts
password.conformance.test.ts
```

**Rust target**: module directory naming
```
password/types.rs
password/handler.rs
password/adapter.rs
password/conformance.rs
```

Choose the convention that's idiomatic for the target language:
- **Flat files**: TypeScript, Python, Swift, C#
- **Module directories**: Rust, Go, Java, Kotlin

## Import Patterns in Generated Code

Generated code references two kinds of imports:

1. **Runtime types** from `@copf/runtime` (or language-equivalent):
   - `ConceptStorage`, `ActionInvocation`, `ActionCompletion`, `ConceptTransport`, `ConceptQuery`

2. **Sibling generated files**:
   - Types file imports nothing (it's the root)
   - Handler file imports types from the types file
   - Adapter file imports handler interface and runtime types
   - Conformance tests import the handler implementation and runtime utilities

Use the appropriate import/module syntax for the target language.
