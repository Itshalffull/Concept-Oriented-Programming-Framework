# Clef Type System Reference

## ResolvedType — The Recursive Type Tree

Every type in a `ConceptManifest` is represented as a `ResolvedType`. Your generator must handle all 7 variants recursively.

### Type Definition (from `kernel/src/types.ts`)

```typescript
type ResolvedType =
  | { kind: 'primitive'; primitive: string }      // String, Int, Float, Bool, Bytes, DateTime, ID
  | { kind: 'param'; paramRef: string }           // Type parameter reference (always string on wire)
  | { kind: 'set'; inner: ResolvedType }          // set T
  | { kind: 'list'; inner: ResolvedType }         // list T
  | { kind: 'option'; inner: ResolvedType }       // option T (nullable)
  | { kind: 'map'; keyType: ResolvedType; inner: ResolvedType }  // A -> B (key-value mapping)
  | { kind: 'record'; fields: FieldSchema[] }     // { field1: T1, field2: T2 }
```

Where `FieldSchema` is:
```typescript
interface FieldSchema {
  name: string;
  type: ResolvedType;
  optional: boolean;
}
```

### Primitive Types

Clef defines exactly 7 primitives. Every generator must map all of them:

| Clef Primitive | JSON Wire | TypeScript | Rust | Description |
|---------------|-----------|------------|------|-------------|
| `String` | string | `string` | `String` | UTF-8 text |
| `Int` | number | `number` | `i64` | 64-bit integer |
| `Float` | number | `number` | `f64` | 64-bit float |
| `Bool` | boolean | `boolean` | `bool` | Boolean |
| `Bytes` | string (base64) | `Buffer` | `Vec<u8>` | Binary data |
| `DateTime` | string (ISO 8601) | `Date` | `DateTime<Utc>` | Timestamp |
| `ID` | string | `string` | `String` | Opaque identifier |

### Collection Types

| Clef Type | JSON Wire | TypeScript | Rust |
|-----------|-----------|------------|------|
| `option T` | `T \| null` | `T \| null` | `Option<T>` |
| `set T` | `T[]` (array) | `Set<T>` | `HashSet<T>` |
| `list T` | `T[]` (array) | `T[]` | `Vec<T>` |
| `A -> B` | object | `Map<A, B>` | `HashMap<A, B>` |

### Type Parameters

Type parameters (like `U` in `concept Password [U]`) are **always opaque string identifiers** on the wire. Your generator should map `{ kind: 'param' }` to the target language's string type.

### Inline Records

Records appear as anonymous struct-like types in action parameters and return values:

```typescript
{ kind: 'record', fields: [
  { name: 'path', type: { kind: 'primitive', primitive: 'String' }, optional: false },
  { name: 'content', type: { kind: 'primitive', primitive: 'String' }, optional: false }
]}
```

How to handle inline records varies by language:
- **TypeScript**: Inline object type `{ path: string; content: string }`
- **Rust**: Define a separate named struct (e.g., `FileEntry { pub path: String, pub content: String }`)
- **Go**: Anonymous struct `struct { Path string; Content string }`
- **Swift**: Nested struct or tuple

### Implementing the Type Mapper

Your type mapper function should follow this recursive pattern:

```typescript
function resolvedTypeTo<Lang>(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveTo<Lang>(t.primitive);
    case 'param':
      return '<string-type>';  // Always string on wire
    case 'set':
      return `<SetType><${resolvedTypeTo<Lang>(t.inner)}>`;
    case 'list':
      return `<ListType><${resolvedTypeTo<Lang>(t.inner)}>`;
    case 'option':
      return `<OptionalType><${resolvedTypeTo<Lang>(t.inner)}>`;
    case 'map':
      return `<MapType><${resolvedTypeTo<Lang>(t.keyType)}, ${resolvedTypeTo<Lang>(t.inner)}>`;
    case 'record': {
      const fields = t.fields.map(f =>
        `${f.name}: ${resolvedTypeTo<Lang>(f.type)}`
      );
      return `<inline-record-syntax>`;
    }
  }
}
```

### Common Patterns for New Languages

**Swift:**
| Clef | Swift |
|------|-------|
| String | `String` |
| Int | `Int` |
| Float | `Double` |
| Bool | `Bool` |
| Bytes | `Data` |
| DateTime | `Date` |
| option T | `T?` |
| set T | `Set<T>` |
| list T | `[T]` |
| A -> B | `[A: B]` |

**Go:**
| Clef | Go |
|------|-----|
| String | `string` |
| Int | `int64` |
| Float | `float64` |
| Bool | `bool` |
| Bytes | `[]byte` |
| DateTime | `time.Time` |
| option T | `*T` |
| set T | `map[T]struct{}` |
| list T | `[]T` |
| A -> B | `map[A]B` |

**Python:**
| Clef | Python |
|------|--------|
| String | `str` |
| Int | `int` |
| Float | `float` |
| Bool | `bool` |
| Bytes | `bytes` |
| DateTime | `datetime` |
| option T | `Optional[T]` |
| set T | `set[T]` |
| list T | `list[T]` |
| A -> B | `dict[A, B]` |

**Kotlin:**
| Clef | Kotlin |
|------|--------|
| String | `String` |
| Int | `Long` |
| Float | `Double` |
| Bool | `Boolean` |
| Bytes | `ByteArray` |
| DateTime | `Instant` |
| option T | `T?` |
| set T | `Set<T>` |
| list T | `List<T>` |
| A -> B | `Map<A, B>` |

**C#:**
| Clef | C# |
|------|----|
| String | `string` |
| Int | `long` |
| Float | `double` |
| Bool | `bool` |
| Bytes | `byte[]` |
| DateTime | `DateTimeOffset` |
| option T | `T?` |
| set T | `HashSet<T>` |
| list T | `List<T>` |
| A -> B | `Dictionary<A, B>` |

### Helper: Detecting Import Requirements

Some languages need import statements based on which types appear. Scan the manifest to detect:

```typescript
function typeNeedsCollection(t: ResolvedType, kind: 'set' | 'map'): boolean {
  if (t.kind === kind) return true;
  if (t.kind === 'list' || t.kind === 'option' || t.kind === 'set')
    return typeNeedsCollection(t.inner, kind);
  if (t.kind === 'map')
    return typeNeedsCollection(t.keyType, kind) || typeNeedsCollection(t.inner, kind);
  if (t.kind === 'record')
    return t.fields.some(f => typeNeedsCollection(f.type, kind));
  return false;
}

function typeNeedsPrimitive(t: ResolvedType, prim: string): boolean {
  if (t.kind === 'primitive') return t.primitive === prim;
  if (t.kind === 'list' || t.kind === 'option' || t.kind === 'set')
    return typeNeedsPrimitive(t.inner, prim);
  if (t.kind === 'map')
    return typeNeedsPrimitive(t.keyType, prim) || typeNeedsPrimitive(t.inner, prim);
  if (t.kind === 'record')
    return t.fields.some(f => typeNeedsPrimitive(f.type, prim));
  return false;
}
```

Use these to conditionally add imports (e.g., `use std::collections::HashSet` in Rust, `import java.time.Instant` in Kotlin).
