# ConceptManifest IR Reference

The `ConceptManifest` is the language-neutral intermediate representation that your generator reads from. It contains everything needed to generate target-language code without ever touching the parser or raw `.concept` files.

## Full Interface (from `kernel/src/types.ts`)

```typescript
interface ConceptManifest {
  uri: string;                      // "urn:app/Password"
  name: string;                     // "Password"
  typeParams: TypeParamInfo[];      // [{ name: "U", wireType: "string" }]
  relations: RelationSchema[];      // Storage schema (post-merge)
  actions: ActionSchema[];          // Fully typed action declarations
  invariants: InvariantSchema[];    // Behavioral specifications
  graphqlSchema: string;            // GraphQL type fragment (you can ignore this)
  jsonSchemas: {                    // JSON validation schemas (you can ignore this)
    invocations: Record<string, object>;
    completions: Record<string, Record<string, object>>;
  };
  capabilities: string[];           // ["crypto", "persistent-storage"]
  purpose: string;                  // Human-readable purpose text
}
```

## Key Substructures

### TypeParamInfo

```typescript
interface TypeParamInfo {
  name: string;         // "U"
  wireType: 'string';   // Always 'string' — params are opaque IDs
  description?: string;
}
```

### ActionSchema

This is the primary structure your generator iterates over:

```typescript
interface ActionSchema {
  name: string;                    // "check"
  params: ActionParamSchema[];     // Input parameters
  variants: VariantSchema[];       // Return variants (discriminated union)
}

interface ActionParamSchema {
  name: string;           // "user"
  type: ResolvedType;     // { kind: 'param', paramRef: 'U' }
}

interface VariantSchema {
  tag: string;                     // "ok", "notfound", "invalid"
  fields: ActionParamSchema[];     // Output fields for this variant
  prose?: string;                  // Description from spec
}
```

### Example: Password concept manifest actions

For the Password concept with actions `set`, `check`, `validate`:

```json
{
  "actions": [
    {
      "name": "set",
      "params": [
        { "name": "user", "type": { "kind": "param", "paramRef": "U" } },
        { "name": "password", "type": { "kind": "primitive", "primitive": "String" } }
      ],
      "variants": [
        {
          "tag": "ok",
          "fields": [
            { "name": "user", "type": { "kind": "param", "paramRef": "U" } }
          ]
        },
        {
          "tag": "invalid",
          "fields": [
            { "name": "message", "type": { "kind": "primitive", "primitive": "String" } }
          ]
        }
      ]
    },
    {
      "name": "check",
      "params": [
        { "name": "user", "type": { "kind": "param", "paramRef": "U" } },
        { "name": "password", "type": { "kind": "primitive", "primitive": "String" } }
      ],
      "variants": [
        {
          "tag": "ok",
          "fields": [
            { "name": "valid", "type": { "kind": "primitive", "primitive": "Bool" } }
          ]
        },
        {
          "tag": "notfound",
          "fields": [
            { "name": "message", "type": { "kind": "primitive", "primitive": "String" } }
          ]
        }
      ]
    },
    {
      "name": "validate",
      "params": [
        { "name": "password", "type": { "kind": "primitive", "primitive": "String" } }
      ],
      "variants": [
        {
          "tag": "ok",
          "fields": [
            { "name": "valid", "type": { "kind": "primitive", "primitive": "Bool" } }
          ]
        }
      ]
    }
  ]
}
```

### RelationSchema

Storage relations — relevant if your adapter needs to implement query support:

```typescript
interface RelationSchema {
  name: string;                                 // "entries", "followers"
  source: 'merged' | 'explicit' | 'set-valued'; // How the relation was derived
  keyField: { name: string; paramRef: string }; // Primary key field
  fields: FieldSchema[];                        // All fields in the relation
}
```

### InvariantSchema

Used for generating conformance tests:

```typescript
interface InvariantSchema {
  description: string;        // Human-readable description
  setup: InvariantStep[];     // AFTER clause — establish state
  assertions: InvariantStep[];// THEN clause — verify behavior
  freeVariables: {
    name: string;             // "x"
    testValue: string;        // "u-test-invariant-001"
  }[];
}

interface InvariantStep {
  action: string;                              // "set", "check"
  inputs: { name: string; value: InvariantValue }[];
  expectedVariant: string;                     // "ok", "notfound"
  expectedOutputs: { name: string; value: InvariantValue }[];
}

type InvariantValue =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'variable'; name: string };
```

### Example: Password invariant

From the spec:
```
invariant {
  after set(user: x, password: "secret") -> ok(user: x)
  then check(user: x, password: "secret") -> ok(valid: true)
  and  check(user: x, password: "wrong")  -> ok(valid: false)
}
```

Becomes:
```json
{
  "description": "invariant 1: after set -> ok then check -> ok, check -> ok",
  "freeVariables": [{ "name": "x", "testValue": "u-test-invariant-001" }],
  "setup": [
    {
      "action": "set",
      "inputs": [
        { "name": "user", "value": { "kind": "variable", "name": "x" } },
        { "name": "password", "value": { "kind": "literal", "value": "secret" } }
      ],
      "expectedVariant": "ok",
      "expectedOutputs": [
        { "name": "user", "value": { "kind": "variable", "name": "x" } }
      ]
    }
  ],
  "assertions": [
    {
      "action": "check",
      "inputs": [
        { "name": "user", "value": { "kind": "variable", "name": "x" } },
        { "name": "password", "value": { "kind": "literal", "value": "secret" } }
      ],
      "expectedVariant": "ok",
      "expectedOutputs": [
        { "name": "valid", "value": { "kind": "literal", "value": true } }
      ]
    },
    {
      "action": "check",
      "inputs": [
        { "name": "user", "value": { "kind": "variable", "name": "x" } },
        { "name": "password", "value": { "kind": "literal", "value": "wrong" } }
      ],
      "expectedVariant": "ok",
      "expectedOutputs": [
        { "name": "valid", "value": { "kind": "literal", "value": false } }
      ]
    }
  ]
}
```

## How to Iterate Over the Manifest

The typical generation loop:

```typescript
function generateTypesFile(manifest: ConceptManifest): string {
  const lines: string[] = [];

  for (const action of manifest.actions) {
    // 1. Generate input type from action.params
    for (const param of action.params) {
      // param.name -> field name
      // param.type -> ResolvedType to map
    }

    // 2. Generate output type from action.variants
    for (const variant of action.variants) {
      // variant.tag -> discriminator value ("ok", "error", etc.)
      for (const field of variant.fields) {
        // field.name -> field name
        // field.type -> ResolvedType to map
      }
    }
  }

  return lines.join('\n');
}
```
