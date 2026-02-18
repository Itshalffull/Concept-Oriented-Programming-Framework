# Handler Anatomy Reference

The complete interface, patterns, and conventions for writing concept handlers.

## The ConceptHandler Interface

```typescript
// From kernel/src/types.ts
export interface ConceptHandler {
  [actionName: string]: (
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) => Promise<{ variant: string; [key: string]: unknown }>;
}
```

Every handler is a plain object where each key is an action name and each value is an async function that:

1. Receives `input` — the action's parameters as untyped key-value pairs
2. Receives `storage` — the concept's isolated storage instance
3. Returns a **variant completion** — an object with a `variant` string discriminant plus output fields

## Handler Structure

```typescript
import type { ConceptHandler } from '@copf/kernel';

export const conceptNameHandler: ConceptHandler = {
  async action1(input, storage) {
    // ...
    return { variant: 'ok', /* output fields */ };
  },

  async action2(input, storage) {
    // ...
    return { variant: 'ok', /* output fields */ };
  },
};
```

**Naming convention**: `<conceptName>Handler` in camelCase. Examples: `userHandler`, `articleHandler`, `passwordHandler`, `jwtHandler`.

**Export**: Always use named export `export const`, not `export default`.

## Input Extraction

Inputs arrive as `Record<string, unknown>`. Extract each field with a type assertion matching the spec's declared type:

```typescript
async create(input, storage) {
  const article = input.article as string;    // A (type param) → string
  const title = input.title as string;        // String → string
  const count = input.count as number;        // Int → number
  const rate = input.rate as number;          // Float → number
  const active = input.active as boolean;     // Bool → boolean
  const data = input.data as string;          // Bytes → string (base64)
  const when = input.when as string;          // DateTime → string (ISO 8601)
```

**Type mapping from spec to TypeScript:**

| Spec Type | TypeScript | Cast |
|-----------|-----------|------|
| `String` | `string` | `as string` |
| `Int` | `number` | `as number` |
| `Float` | `number` | `as number` |
| `Bool` | `boolean` | `as boolean` |
| `Bytes` | `string` | `as string` (base64-encoded) |
| `DateTime` | `string` | `as string` (ISO 8601) |
| `ID` | `string` | `as string` |
| Type param (`U`, `A`, etc.) | `string` | `as string` |
| `list T` | `T[]` | `as string[]` etc. |
| `set T` | `string[]` | `as string[]` |
| `option T` | `T \| null` | `as string \| null` |

## Variant Completions

Every action return is a discriminated union. The `variant` field is the tag. Other fields match the spec's variant declaration.

### Single variant (success only)

```
// Spec: action send(id: M, text: String) { -> ok(id: M, echo: String) { ... } }

async send(input, storage) {
  const id = input.id as string;
  const text = input.text as string;
  await storage.put('echo', id, { text });
  return { variant: 'ok', id, echo: text };
},
```

### Two variants (success or error)

```
// Spec: action register(user: U, name: String, email: String) {
//         -> ok(user: U) { ... }
//         -> error(message: String) { ... }
//       }

async register(input, storage) {
  const user = input.user as string;
  const name = input.name as string;
  const email = input.email as string;

  const existing = await storage.find('user', { name });
  if (existing.length > 0) {
    return { variant: 'error', message: 'name already taken' };
  }

  await storage.put('user', user, { user, name, email });
  return { variant: 'ok', user };
},
```

### Boolean output variant

```
// Spec: action check(user: U, password: String) {
//         -> ok(valid: Bool) { ... }
//         -> notfound(message: String) { ... }
//       }

async check(input, storage) {
  const user = input.user as string;
  const password = input.password as string;

  const record = await storage.get('password', user);
  if (!record) {
    return { variant: 'notfound', message: 'No credentials for user' };
  }

  // ... hash comparison ...
  return { variant: 'ok', valid: hashesMatch };
},
```

### Multi-field output variant

```
// Spec: action get(article: A) {
//         -> ok(article: A, slug: String, title: String, ...) { ... }
//         -> notfound(message: String) { ... }
//       }

async get(input, storage) {
  const article = input.article as string;

  const record = await storage.get('article', article);
  if (!record) {
    return { variant: 'notfound', message: 'Article not found' };
  }

  return {
    variant: 'ok',
    article,
    slug: record.slug as string,
    title: record.title as string,
    description: record.description as string,
    body: record.body as string,
    author: record.author as string,
  };
},
```

## Common Action Patterns

### Create (with uniqueness check)

```typescript
async register(input, storage) {
  const user = input.user as string;
  const name = input.name as string;
  const email = input.email as string;

  // Uniqueness check
  const existingByName = await storage.find('user', { name });
  if (existingByName.length > 0) {
    return { variant: 'error', message: 'name already taken' };
  }
  const existingByEmail = await storage.find('user', { email });
  if (existingByEmail.length > 0) {
    return { variant: 'error', message: 'email already taken' };
  }

  // Store
  await storage.put('user', user, { user, name, email });
  return { variant: 'ok', user };
},
```

### Create (with derived fields)

```typescript
async create(input, storage) {
  const article = input.article as string;
  const title = input.title as string;
  // ... extract other inputs ...

  const now = new Date().toISOString();
  const slug = slugify(title);  // Derived field

  await storage.put('article', article, {
    article, slug, title, description, body, author,
    createdAt: now, updatedAt: now,
  });
  return { variant: 'ok', article };
},
```

### Update (read-modify-write)

```typescript
async update(input, storage) {
  const article = input.article as string;
  const title = input.title as string;
  // ... extract other inputs ...

  const existing = await storage.get('article', article);
  if (!existing) {
    return { variant: 'notfound', message: 'Article not found' };
  }

  const now = new Date().toISOString();
  await storage.put('article', article, {
    ...existing,           // Preserve unchanged fields
    title, description, body,  // Overwrite changed fields
    slug: slugify(title),
    updatedAt: now,
  });
  return { variant: 'ok', article };
},
```

### Delete (with existence check)

```typescript
async delete(input, storage) {
  const article = input.article as string;

  const existing = await storage.get('article', article);
  if (!existing) {
    return { variant: 'notfound', message: 'Article not found' };
  }

  await storage.del('article', article);
  return { variant: 'ok', article };
},
```

### Get (read and return)

```typescript
async get(input, storage) {
  const article = input.article as string;

  const record = await storage.get('article', article);
  if (!record) {
    return { variant: 'notfound', message: 'Article not found' };
  }

  return {
    variant: 'ok',
    article,
    slug: record.slug as string,
    title: record.title as string,
    // ... all fields from spec's ok variant ...
  };
},
```

### List (query and return)

```typescript
async list(input, storage) {
  const target = input.target as string;

  const results = await storage.find('comment', { target });
  const comments = results.map(r => ({
    comment: r.comment,
    body: r.body,
    author: r.author,
    createdAt: r.createdAt,
  }));

  return { variant: 'ok', comments: JSON.stringify(comments) };
},
```

### Set-valued relation (array mutation)

```typescript
async favorite(input, storage) {
  const user = input.user as string;
  const article = input.article as string;

  const existing = await storage.get('favorite', user);
  const favorites: string[] = existing ? (existing.favorites as string[]) : [];

  if (!favorites.includes(article)) {
    favorites.push(article);
  }

  await storage.put('favorite', user, { user, favorites });
  return { variant: 'ok', user, article };
},

async unfavorite(input, storage) {
  const user = input.user as string;
  const article = input.article as string;

  const existing = await storage.get('favorite', user);
  if (existing) {
    const favorites = (existing.favorites as string[]).filter(a => a !== article);
    await storage.put('favorite', user, { user, favorites });
  }

  return { variant: 'ok', user, article };
},
```

### Stateless validation

```typescript
async validate(input, _storage) {
  const password = input.password as string;
  return { variant: 'ok', valid: password.length >= 8 };
},
```

Note the `_storage` parameter — unused but required by the interface.

### Crypto operation

```typescript
import { createHash, randomBytes } from 'crypto';

async set(input, storage) {
  const user = input.user as string;
  const password = input.password as string;

  if (password.length < 8) {
    return { variant: 'invalid', message: 'Password must be at least 8 characters' };
  }

  const salt = randomBytes(16);
  const hash = createHash('sha256').update(password).update(salt).digest();

  await storage.put('password', user, {
    user,
    hash: hash.toString('base64'),
    salt: salt.toString('base64'),
  });

  return { variant: 'ok', user };
},
```

## Helper Functions

Keep helpers **private** to the implementation file. Define them above the handler:

```typescript
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const articleHandler: ConceptHandler = {
  async create(input, storage) {
    const slug = slugify(input.title as string);
    // ...
  },
};
```

For crypto helpers (JWT, HMAC):

```typescript
const JWT_SECRET = randomBytes(32);

function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}
```

Module-level constants like `JWT_SECRET` are fine — each concept runs in its own process/context.

## What NOT to Do

- **Never import or reference other concept handlers** — concepts are independent
- **Never call `require()` or dynamic imports** in action handlers
- **Never throw exceptions** — return error variants instead
- **Never store derived state in module-level variables** — use storage
- **Never assume action ordering** — each action call is independent
- **Never modify `input` directly** — treat it as read-only
