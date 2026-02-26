# Example: Rust Code Generator

This shows how the Rust generator differs from TypeScript — useful for understanding how to adapt the pattern for languages with traits, structs, enums, and module systems.

## File Location

`handlers/ts/framework/rust-gen.handler.ts`

## Type Mapping Function

```typescript
function resolvedTypeToRust(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToRust(t.primitive);
    case 'param':
      return 'String'; // type parameters are opaque string IDs on wire
    case 'set':
      return `HashSet<${resolvedTypeToRust(t.inner)}>`;
    case 'list':
      return `Vec<${resolvedTypeToRust(t.inner)}>`;
    case 'option':
      return `Option<${resolvedTypeToRust(t.inner)}>`;
    case 'map':
      return `HashMap<${resolvedTypeToRust(t.keyType)}, ${resolvedTypeToRust(t.inner)}>`;
    case 'record': {
      const fields = t.fields.map(f => `${snakeCase(f.name)}: ${resolvedTypeToRust(f.type)}`);
      return `{ ${fields.join(', ')} }`;
    }
  }
}

function primitiveToRust(name: string): string {
  switch (name) {
    case 'String': return 'String';
    case 'Int': return 'i64';
    case 'Float': return 'f64';
    case 'Bool': return 'bool';
    case 'Bytes': return 'Vec<u8>';
    case 'DateTime': return 'DateTime<Utc>';
    case 'ID': return 'String';
    default: return 'serde_json::Value';
  }
}
```

**Key differences from TypeScript:**
- Uses `snakeCase()` helper for field names (Rust convention)
- Primitive fallback is `serde_json::Value` instead of `unknown`
- Needs conditional imports based on used types (HashSet, HashMap, DateTime)

## Import Collection

Rust needs explicit `use` declarations. The generator scans the manifest to determine which imports are needed:

```typescript
function collectImports(manifest: ConceptManifest): string[] {
  const imports = new Set<string>();
  imports.add('use serde::{Serialize, Deserialize};');

  const needsHashSet = manifest.actions.some(a =>
    a.params.some(p => typeNeedsCollection(p.type, 'set')) ||
    a.variants.some(v => v.fields.some(f => typeNeedsCollection(f.type, 'set')))
  );
  // ... similar checks for HashMap, DateTime

  if (needsHashSet) imports.add('use std::collections::HashSet;');
  if (needsHashMap) imports.add('use std::collections::HashMap;');
  if (needsDateTime) imports.add('use chrono::{DateTime, Utc};');

  return Array.from(imports).sort();
}
```

## Derive Macros

Rust structs/enums get `#[derive(...)]` attributes. HashSet fields can't derive `PartialEq`:

```typescript
function derivesForStruct(hasHashSet: boolean): string {
  const derives = ['Debug', 'Clone', 'Serialize', 'Deserialize'];
  if (!hasHashSet) derives.push('PartialEq');
  return derives.join(', ');
}
```

## Generated Types File (types.rs)

For Password concept:

```rust
// generated: password/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PasswordSetInput {
    pub user: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PasswordSetOutput {
    Ok {
        user: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PasswordCheckInput {
    pub user: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PasswordCheckOutput {
    Ok {
        valid: bool,
    },
    Notfound {
        message: String,
    },
}
```

**Key differences from TypeScript types:**
- Input types are `pub struct` with `pub` fields
- Output types are `enum` with `#[serde(tag = "variant")]` for JSON compatibility
- Variant names are `Capitalized` (not quoted strings)
- Field names use `snake_case`
- Derive macros added for serialization

## Generated Handler File (handler.rs)

```rust
// generated: password/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PasswordHandler: Send + Sync {
    async fn set(
        &self,
        input: PasswordSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordSetOutput, Box<dyn std::error::Error>>;

    async fn check(
        &self,
        input: PasswordCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordCheckOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: PasswordValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordValidateOutput, Box<dyn std::error::Error>>;
}
```

**Key differences from TypeScript handler:**
- Uses `#[async_trait]` macro for async trait methods
- Methods take `&self` (trait is object-safe with `Send + Sync`)
- Return type is `Result<Output, Box<dyn Error>>` instead of `Promise<Output>`
- Storage is `&dyn ConceptStorage` (trait object reference)

## Generated Adapter File (adapter.rs)

```rust
// generated: password/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PasswordHandler;
use super::types::*;

pub struct PasswordAdapter<H: PasswordHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PasswordHandler> PasswordAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PasswordHandler + 'static> ConceptTransport for PasswordAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "set" => {
                let input: PasswordSetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "check" => {
                let input: PasswordCheckInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validate" => {
                let input: PasswordValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            _ => return Err(format!("Unknown action: {}", invocation.action).into()),
        };

        let variant = result.get("variant")
            .and_then(|v| v.as_str())
            .unwrap_or("ok")
            .to_string();

        Ok(ActionCompletion {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant,
            output: result,
            flow: invocation.flow,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn query(&self, request: ConceptQuery) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
        self.storage.find(&request.relation, request.args.as_ref()).await
    }

    async fn health(&self) -> Result<(bool, u64), Box<dyn std::error::Error>> {
        Ok((true, 0))
    }
}
```

**Key differences from TypeScript adapter:**
- Uses a generic struct `Adapter<H: Handler>` instead of a closure factory
- Action dispatch via `match` on string instead of dynamic property access
- Explicit `serde_json::from_value` / `serde_json::to_value` for (de)serialization
- Timestamp via `chrono::Utc::now().to_rfc3339()`

## Generated Conformance Tests (conformance.rs)

```rust
// generated: password/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PasswordHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn password_invariant_1() {
        // invariant 1: after set -> ok then check -> ok, check -> ok
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // set(user: x, password: "secret") -> ok(user: x)
        let step1 = handler.set(
            SetInput { user: x.clone(), password: "secret".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SetOutput::Ok { user, .. } => {
                assert_eq!(user, x);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // check(user: x, password: "secret") -> ok(valid: true)
        let step2 = handler.check(
            CheckInput { user: x.clone(), password: "secret".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::Ok { valid, .. } => {
                assert_eq!(valid, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }
}
```

**Key differences from TypeScript tests:**
- `#[tokio::test]` attribute for async tests
- `#[cfg(test)]` module wrapper
- Pattern matching (`match`) instead of `.variant` property access
- `.clone()` for string variables used multiple times
- `.to_string()` for string literals assigned to `String` fields

## Handler Export

```typescript
export const rustGenHandler: ConceptHandler = {
  async generate(input, storage) {
    // ... same pattern as TypeScript but with module-based paths
    const modName = snakeCase(manifest.name);
    const files = [
      { path: `${modName}/types.rs`, content: generateTypesFile(manifest) },
      { path: `${modName}/handler.rs`, content: generateHandlerFile(manifest) },
      { path: `${modName}/adapter.rs`, content: generateAdapterFile(manifest) },
    ];
    // ...
  },
};
```

**File paths use module directories**: `password/types.rs`, `password/handler.rs`, etc.
