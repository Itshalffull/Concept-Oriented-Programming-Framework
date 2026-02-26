# Generator Scaffold Template

Copy this template as your starting point for `handlers/ts/framework/<lang>-gen.handler.ts`. Replace all `<Lang>`, `<lang>`, and `<ext>` placeholders.

```typescript
// ============================================================
// <Lang>Gen Concept Implementation
//
// Generates <Lang> skeleton code from a ConceptManifest.
// Follows the COPF code generation pattern (Section 10.1).
//
// Type mapping table:
//   String  → <?>       Int    → <?>
//   Float   → <?>       Bool   → <?>
//   Bytes   → <?>       DateTime → <?>
//   ID      → <?>       option T → <?>
//   set T   → <?>       list T   → <?>
//   A -> B  → <?>       params   → <string-type> (opaque)
//
// Generated files:
//   - types.<ext>         (type definitions for inputs/outputs)
//   - handler.<ext>       (handler interface/trait/protocol)
//   - adapter.<ext>       (transport adapter: deser/dispatch/ser)
//   - conformance.<ext>   (conformance tests from invariants)
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ResolvedType,
  ActionSchema,
  VariantSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../kernel/src/types.js';

// --- ResolvedType → <Lang> mapping ---

function resolvedTypeToLang(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToLang(t.primitive);
    case 'param':
      return '<string-type>'; // type parameters are opaque string IDs on wire
    case 'set':
      return `<SetType><${resolvedTypeToLang(t.inner)}>`;
    case 'list':
      return `<ListType><${resolvedTypeToLang(t.inner)}>`;
    case 'option':
      return `<OptionalWrapper><${resolvedTypeToLang(t.inner)}>`;
    case 'map':
      return `<MapType><${resolvedTypeToLang(t.keyType)}, ${resolvedTypeToLang(t.inner)}>`;
    case 'record': {
      // TODO: Handle inline records idiomatically for <Lang>
      const fields = t.fields.map(f =>
        `${formatFieldName(f.name)}: ${resolvedTypeToLang(f.type)}`
      );
      return `{ ${fields.join(', ')} }`;
    }
  }
}

function primitiveToLang(name: string): string {
  switch (name) {
    case 'String':   return '???';
    case 'Int':      return '???';
    case 'Float':    return '???';
    case 'Bool':     return '???';
    case 'Bytes':    return '???';
    case 'DateTime': return '???';
    case 'ID':       return '???';
    default:         return '???'; // fallback type
  }
}

// --- Naming helpers ---
// Adjust these for your target language conventions

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFieldName(s: string): string {
  // For snake_case languages (Rust, Python, Go):
  //   return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  // For camelCase languages (Java, Kotlin, Swift, TypeScript):
  //   return s;
  return s;
}

function formatTypeName(s: string): string {
  // PascalCase is standard for most languages
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Import collection (if your target language needs conditional imports) ---

function collectImports(manifest: ConceptManifest): string[] {
  const imports: string[] = [];

  // TODO: Scan manifest.actions for types that require imports
  // Example: if any type uses DateTime, add the datetime import
  // Example: if any type uses set/map, add collection imports

  return imports;
}

// --- Type Definitions File ---

function generateTypesFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}/types.<ext>`,
    '',
    ...collectImports(manifest),
    '',
  ];

  for (const action of manifest.actions) {
    const inputTypeName = `${conceptName}${capitalize(action.name)}Input`;
    const outputTypeName = `${conceptName}${capitalize(action.name)}Output`;

    // --- Input type ---
    // TODO: Emit input type definition
    // Pattern: one field per action.params entry
    //
    // for (const p of action.params) {
    //   // p.name -> field name (apply formatFieldName)
    //   // p.type -> ResolvedType (apply resolvedTypeToLang)
    // }

    lines.push('');

    // --- Output type (discriminated union) ---
    // TODO: Emit output type as discriminated union / enum / sealed class
    // Pattern: one variant per action.variants entry
    //
    // for (const v of action.variants) {
    //   // v.tag -> variant name/discriminator ("ok", "error", etc.)
    //   // v.fields -> variant fields (same pattern as params)
    // }

    lines.push('');
  }

  return lines.join('\n');
}

// --- Handler Interface/Trait/Protocol File ---

function generateHandlerFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}/handler.<ext>`,
    '',
    // TODO: Add imports for types file and runtime types
  ];

  // TODO: Emit handler interface/trait/protocol
  // Pattern: one method per action
  //
  // for (const action of manifest.actions) {
  //   const inputType = `${conceptName}${capitalize(action.name)}Input`;
  //   const outputType = `${conceptName}${capitalize(action.name)}Output`;
  //   // Emit: method signature taking (input, storage) -> output
  // }

  return lines.join('\n');
}

// --- Transport Adapter File ---

function generateAdapterFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}/adapter.<ext>`,
    '',
    // TODO: Add imports for handler, types, and runtime types
  ];

  // TODO: Emit adapter class/struct/function that:
  // 1. Takes handler + storage
  // 2. Implements ConceptTransport
  // 3. invoke(): deserialize input, match action name, dispatch to handler, serialize output
  // 4. query(): delegate to storage.find
  // 5. health(): return available=true
  //
  // The action dispatch should be:
  //   for (const action of manifest.actions) {
  //     // case "<action.name>" => deserialize, call handler.<action.name>, serialize
  //   }

  return lines.join('\n');
}

// --- Conformance Test File ---

function generateConformanceTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) {
    return null;
  }

  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName.toLowerCase()}/conformance.<ext>`,
    '',
    // TODO: Add test framework imports and type imports
  ];

  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];

    // TODO: Emit test function header
    // Name pattern: <concept>_invariant_<N> or <concept>Invariant<N>

    // Emit free variable declarations
    for (const fv of inv.freeVariables) {
      // fv.name -> variable name
      // fv.testValue -> deterministic test value string
    }

    // Emit AFTER clause (setup steps)
    let stepNum = 1;
    for (const step of inv.setup) {
      // TODO: generate step code (see generateStepCode helper below)
      stepNum++;
    }

    // Emit THEN clause (assertion steps)
    for (const step of inv.assertions) {
      // TODO: generate step code with assertions
      stepNum++;
    }

    // TODO: Emit test function footer
  }

  return lines.join('\n');
}

// Helper: generate code for a single invariant step
function generateStepCode(
  step: InvariantStep,
  stepNum: number,
  conceptName: string,
): string[] {
  const lines: string[] = [];

  // Build input construction
  for (const input of step.inputs) {
    if (input.value.kind === 'literal') {
      // Use the literal value directly
      // typeof input.value.value === 'string' | 'number' | 'boolean'
    } else {
      // Reference the free variable by name
      // input.value.name -> variable name declared earlier
    }
  }

  // Assert expected variant
  // step.expectedVariant -> "ok", "error", etc.

  // Assert expected output values
  for (const output of step.expectedOutputs) {
    if (output.value.kind === 'literal') {
      // Assert field equals literal value
    } else {
      // Assert field equals variable value
    }
  }

  return lines;
}

// --- Handler Export ---

export const langGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      // Choose file path convention:
      // Flat: `${lowerName}.types.<ext>` (TypeScript, Python, Swift)
      // Module: `${lowerName}/types.<ext>` (Rust, Go, Java, Kotlin)
      const lowerName = manifest.name.toLowerCase();

      const files: { path: string; content: string }[] = [
        { path: `${lowerName}/types.<ext>`, content: generateTypesFile(manifest) },
        { path: `${lowerName}/handler.<ext>`, content: generateHandlerFile(manifest) },
        { path: `${lowerName}/adapter.<ext>`, content: generateAdapterFile(manifest) },
      ];

      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${lowerName}/conformance.<ext>`, content: conformanceTest });
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

## Test File Template

Create `tests/<lang>-gen.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { langGenHandler } from '../handlers/ts/framework/<lang>-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'test', ast }, storage);
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

describe('<Lang>Gen Type Mapping', () => {
  it('<Lang>Gen concept spec exists and matches generator pattern', () => {
    const source = readSpec('framework', '<lang>-gen');
    const ast = parseConceptFile(source);
    expect(ast.name).toBe('<Lang>Gen');
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
  });

  it('Password concept generates correct <Lang> type definitions', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await langGenHandler.generate(
      { spec: 'pwd-1', manifest }, storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];

    // Expect 4 files for Password (has invariants): types, handler, adapter, conformance
    expect(files).toHaveLength(4);

    // TODO: Assert type file contains expected type definitions
    // TODO: Assert handler file contains expected method signatures
    // TODO: Assert adapter file contains action dispatch
  });

  it('generates files for concept without invariants (no conformance file)', async () => {
    const ast = parseConceptFile(readSpec('framework', 'schema-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await langGenHandler.generate(
      { spec: 'sg-1', manifest }, storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files).toHaveLength(3); // No conformance file
  });

  it('returns error for invalid manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await langGenHandler.generate(
      { spec: 'bad', manifest: {} }, storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('missing concept name');
  });
});
```

## Concept Spec Template

Create `specs/framework/<lang>-gen.concept`:

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
