# Example: TypeScript Code Generator

This is the complete walkthrough of how the TypeScript language target is implemented. Use this as the primary reference for building new targets.

## File Location

`handlers/ts/framework/typescript-gen.handler.ts`

## Type Mapping Function

```typescript
function resolvedTypeToTS(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToTS(t.primitive);
    case 'param':
      return 'string'; // type parameters are opaque string IDs
    case 'set':
      return `Set<${resolvedTypeToTS(t.inner)}>`;
    case 'list':
      return `${resolvedTypeToTS(t.inner)}[]`;
    case 'option':
      return `${resolvedTypeToTS(t.inner)} | null`;
    case 'map':
      return `Map<${resolvedTypeToTS(t.keyType)}, ${resolvedTypeToTS(t.inner)}>`;
    case 'record': {
      const fields = t.fields.map(f => `${f.name}: ${resolvedTypeToTS(f.type)}`);
      return `{ ${fields.join('; ')} }`;
    }
  }
}

function primitiveToTS(name: string): string {
  switch (name) {
    case 'String': return 'string';
    case 'Int': return 'number';
    case 'Float': return 'number';
    case 'Bool': return 'boolean';
    case 'Bytes': return 'Buffer';
    case 'DateTime': return 'Date';
    case 'ID': return 'string';
    default: return 'unknown';
  }
}
```

## Generated Types File

For `Password` concept with actions `set`, `check`, `validate`:

```typescript
// generated: password.types.ts

export interface PasswordSetInput {
  user: string;
  password: string;
}

export type PasswordSetOutput =
  { variant: "ok"; user: string }
  | { variant: "invalid"; message: string };

export interface PasswordCheckInput {
  user: string;
  password: string;
}

export type PasswordCheckOutput =
  { variant: "ok"; valid: boolean }
  | { variant: "notfound"; message: string };

export interface PasswordValidateInput {
  password: string;
}

export type PasswordValidateOutput =
  { variant: "ok"; valid: boolean };
```

**Key patterns:**
- Input types are `interface` (always a flat set of fields)
- Output types are `type` aliases of discriminated unions
- Variant tag is always the string `variant`
- Type params map to `string`

### How it's generated:

```typescript
function generateTypesFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}.types.ts`,
    '',
  ];

  for (const action of manifest.actions) {
    // Input type: interface with one field per param
    const inputTypeName = `${conceptName}${capitalize(action.name)}Input`;
    lines.push(`export interface ${inputTypeName} {`);
    for (const p of action.params) {
      lines.push(`  ${p.name}: ${resolvedTypeToTS(p.type)};`);
    }
    lines.push(`}`);
    lines.push('');

    // Output type: discriminated union of variants
    const outputTypeName = `${conceptName}${capitalize(action.name)}Output`;
    const variantTypes: string[] = [];
    for (const v of action.variants) {
      const fields = v.fields.map(p => `${p.name}: ${resolvedTypeToTS(p.type)}`);
      const fieldStr = fields.length > 0 ? `; ${fields.join('; ')}` : '';
      variantTypes.push(`{ variant: "${v.tag}"${fieldStr} }`);
    }
    lines.push(`export type ${outputTypeName} =`);
    for (let i = 0; i < variantTypes.length; i++) {
      const sep = i === 0 ? '  ' : '  | ';
      lines.push(`${sep}${variantTypes[i]}${i < variantTypes.length - 1 ? '' : ';'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
```

## Generated Handler File

```typescript
// generated: password.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./password.types";

export interface PasswordHandler {
  set(input: T.PasswordSetInput, storage: ConceptStorage):
    Promise<T.PasswordSetOutput>;
  check(input: T.PasswordCheckInput, storage: ConceptStorage):
    Promise<T.PasswordCheckOutput>;
  validate(input: T.PasswordValidateInput, storage: ConceptStorage):
    Promise<T.PasswordValidateOutput>;
}
```

**Key patterns:**
- Imports types via namespace import `* as T`
- One method per action
- Each method takes `(input, storage)` and returns a Promise of the output type

## Generated Adapter File

```typescript
// generated: password.adapter.ts
import type {
  ActionInvocation, ActionCompletion,
  ConceptTransport, ConceptQuery
} from "@copf/runtime";
import type { PasswordHandler } from "./password.handler";
import type { ConceptStorage } from "@copf/runtime";

export function createPasswordLiteAdapter(
  handler: PasswordHandler,
  storage: ConceptStorage,
): ConceptTransport {
  return {
    queryMode: "lite",
    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const result = await (handler as any)[invocation.action](
        invocation.input,
        storage
      );
      const { variant, ...output } = result;
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant,
        output,
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    },
    async query(request: ConceptQuery) {
      return storage.find(request.relation, request.args);
    },
    async health() {
      return { available: true, latency: 0 };
    },
  };
}
```

**Key patterns:**
- Factory function `create<Concept>LiteAdapter` taking handler + storage
- Dynamic dispatch via `(handler as any)[invocation.action]`
- Destructure variant from result, pass rest as output
- Always uses `queryMode: "lite"`

## Generated Conformance Test File

```typescript
// generated: password.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { passwordHandler } from "./password.impl";

describe("Password conformance", () => {

  it("invariant 1: after set -> ok then check -> ok, check -> ok", async () => {
    const storage = createInMemoryStorage();

    const x = "u-test-invariant-001";

    // --- AFTER clause ---
    // set(user: x, password: "secret") -> ok(user: x)
    const step1 = await passwordHandler.set(
      { user: x, password: "secret" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).user).toBe(x);

    // --- THEN clause ---
    // check(user: x, password: "secret") -> ok(valid: true)
    const step2 = await passwordHandler.check(
      { user: x, password: "secret" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).valid).toBe(true);
    // check(user: x, password: "wrong") -> ok(valid: false)
    const step3 = await passwordHandler.check(
      { user: x, password: "wrong" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).valid).toBe(false);
  });

});
```

**Key patterns:**
- Free variables get deterministic test values like `"u-test-invariant-001"`
- Setup steps go under `// --- AFTER clause ---`
- Assertion steps go under `// --- THEN clause ---`
- Variant is asserted with `expect(...).toBe("variant")`
- Output fields asserted via `(result as any).fieldName`

## Handler Export

```typescript
export const typescriptGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const lowerName = manifest.name.toLowerCase();
      const files: { path: string; content: string }[] = [
        { path: `${lowerName}.types.ts`, content: generateTypesFile(manifest) },
        { path: `${lowerName}.handler.ts`, content: generateHandlerFile(manifest) },
        { path: `${lowerName}.adapter.ts`, content: generateAdapterFile(manifest) },
      ];

      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${lowerName}.conformance.test.ts`, content: conformanceTest });
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

**File paths use flat naming**: `password.types.ts`, `password.handler.ts`, etc.
