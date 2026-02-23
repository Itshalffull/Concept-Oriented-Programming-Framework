---
name: schema-gen
description: Transform parsed concept ASTs into rich , language neutral 
 ConceptManifests The manifest contains everything a code 
 generator needs : relation schemas ( after merge grouping ) , 
 fully typed action signatures , structured invariants with 
 test values , GraphQL schema fragments , and JSON Schemas
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# SchemaGen

Transform parsed concept ASTs into rich , language neutral 
 ConceptManifests The manifest contains everything a code 
 generator needs : relation schemas ( after merge grouping ) , 
 fully typed action signatures , structured invariants with 
 test values , GraphQL schema fragments , and JSON Schemas

## Step 1: Generate Schema from Spec

Generate ConceptManifest from parsed AST. The manifest provides typed action signatures for implementation.

**Arguments:** `$0` **spec** (S), `$1` **ast** (ast)

**Examples:**
*Generate manifest from AST*
```typescript
import { schemaGenHandler } from './schema-gen.impl';
const result = await schemaGenHandler.generate(
  { conceptAst: JSON.stringify(ast) }, storage
);
```

## References

- [Implementation patterns and storage](references/implementation-patterns.md)
