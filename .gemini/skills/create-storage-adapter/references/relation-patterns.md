# Relation Patterns Reference

How Clef concept handlers use storage in practice. Patterns observed across all RealWorld concept implementations.

## Relation Naming Convention

Each concept typically uses a **single relation** named after the concept (lowercased, singular):

| Concept | Relation | Key | Value Fields | Source |
|---------|----------|-----|-------------|--------|
| User | `'user'` | user ID | `user, name, email` | `app/user.handler.ts` |
| Article | `'article'` | article ID | `article, slug, title, description, body, author, createdAt, updatedAt` | `app/article.handler.ts` |
| Password | `'password'` | user ID | `user, hash, salt` | `app/password.handler.ts` |
| Profile | `'profile'` | user ID | `user, bio, image` | `app/profile.handler.ts` |
| Comment | `'comment'` | comment ID | `comment, target, author, body, createdAt` | `app/comment.handler.ts` |
| Follow | `'follow'` | user ID | `user, following: string[]` | `app/follow.handler.ts` |
| Favorite | `'favorite'` | user ID | `user, favorites: string[]` | `app/favorite.handler.ts` |
| Tag | `'tag'` | tag name | `tag, articles: string[]` | `app/tag.handler.ts` |
| Echo | `'echo'` | id | `id, message` | `app/echo.handler.ts` |
| JWT | `'tokens'` | user ID | `user, token` | `app/jwt.handler.ts` |

**Exception — multi-relation concepts:** The Registry concept uses four relations (`'concepts'`, `'uri'`, `'transport'`, `'available'`), all keyed by concept ID.

**Reserved relation:** `'_meta'` with key `'schema'` is used by the migration framework to track schema versions.

## Pattern 1: Simple CRUD

The most common pattern. One relation, keyed by entity ID.

### Create

```typescript
// article.handler.ts — create action
async create(input, storage) {
  const article = input.article as string;
  const title = input.title as string;
  const description = input.description as string;
  const body = input.body as string;
  const author = input.author as string;
  const now = new Date().toISOString();
  const slug = slugify(title);

  await storage.put('article', article, {
    article, slug, title, description, body, author,
    createdAt: now, updatedAt: now,
  });

  return { variant: 'ok', article };
}
```

**Pattern:** Extract input fields → compute derived fields → `put()` → return success variant.

### Read

```typescript
// article.handler.ts — get action
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
    // ... extract fields
  };
}
```

**Pattern:** `get()` → null check → return `notfound` or extract fields into variant output.

### Update (Spread + Overwrite)

```typescript
// article.handler.ts — update action
async update(input, storage) {
  const article = input.article as string;

  const existing = await storage.get('article', article);
  if (!existing) {
    return { variant: 'notfound', message: 'Article not found' };
  }

  const now = new Date().toISOString();
  const slug = slugify(input.title as string);

  await storage.put('article', article, {
    ...existing,           // Preserve fields not being updated
    slug, title, description, body,
    updatedAt: now,        // Update timestamp
  });

  return { variant: 'ok', article };
}
```

**Pattern:** `get()` → null check → spread existing + new fields → `put()`. This is the canonical update pattern because `put()` does full replacement.

### Delete

```typescript
// article.handler.ts — delete action
async delete(input, storage) {
  const article = input.article as string;

  const existing = await storage.get('article', article);
  if (!existing) {
    return { variant: 'notfound', message: 'Article not found' };
  }

  await storage.del('article', article);

  return { variant: 'ok', article };
}
```

**Pattern:** `get()` → null check → `del()`. Read before delete to verify existence and return the right variant.

## Pattern 2: Uniqueness Check via find()

```typescript
// user.handler.ts — register action
async register(input, storage) {
  const user = input.user as string;
  const name = input.name as string;
  const email = input.email as string;

  // Check name uniqueness
  const existingByName = await storage.find('user', { name });
  if (existingByName.length > 0) {
    return { variant: 'error', message: 'name already taken' };
  }

  // Check email uniqueness
  const existingByEmail = await storage.find('user', { email });
  if (existingByEmail.length > 0) {
    return { variant: 'error', message: 'email already taken' };
  }

  await storage.put('user', user, { user, name, email });
  return { variant: 'ok', user };
}
```

**Pattern:** `find()` with criteria to check for duplicate values on non-key fields. This is how concepts enforce uniqueness constraints beyond the primary key.

**Important for adapter authors:** This pattern relies on `find()` correctly matching criteria fields with equality semantics.

## Pattern 3: Array-Valued Fields (Read-Modify-Write)

For set-typed state (e.g., "users a user follows"), concepts store arrays inside a single record keyed by the owner.

### Add to Array

```typescript
// follow.handler.ts — follow action
async follow(input, storage) {
  const user = input.user as string;
  const target = input.target as string;

  // Read current list (or initialize empty)
  const existing = await storage.get('follow', user);
  const following: string[] = existing
    ? (existing.following as string[])
    : [];

  // Add if not present
  if (!following.includes(target)) {
    following.push(target);
  }

  // Write back the full record
  await storage.put('follow', user, { user, following });

  return { variant: 'ok', user, target };
}
```

### Remove from Array

```typescript
// follow.handler.ts — unfollow action
async unfollow(input, storage) {
  const user = input.user as string;
  const target = input.target as string;

  const existing = await storage.get('follow', user);
  if (existing) {
    const following = (existing.following as string[]).filter(t => t !== target);
    await storage.put('follow', user, { user, following });
  }

  return { variant: 'ok', user, target };
}
```

### Check Membership

```typescript
// follow.handler.ts — isFollowing action
async isFollowing(input, storage) {
  const user = input.user as string;
  const target = input.target as string;

  const existing = await storage.get('follow', user);
  const following: string[] = existing
    ? (existing.following as string[])
    : [];

  return { variant: 'ok', following: following.includes(target) };
}
```

**Pattern:** `get()` → extract array → modify → `put()` back. The array is stored as a JSON-serializable field.

**Important for adapter authors:** Your storage must correctly store and retrieve arrays and nested objects within record values.

## Pattern 4: Scan All + Application-Level Filter

When `find()` criteria isn't sufficient, concepts scan all records and filter in application code:

```typescript
// favorite.handler.ts — count action
async count(input, storage) {
  const article = input.article as string;

  const allUsers = await storage.find('favorite');
  let count = 0;
  for (const record of allUsers) {
    const favorites = record.favorites as string[];
    if (favorites.includes(article)) {
      count++;
    }
  }

  return { variant: 'ok', count };
}
```

**Pattern:** `find()` with no criteria to get all records → application-level filtering. This happens when the filter condition involves array membership or nested field access that `find()` criteria can't express.

## Pattern 5: Bulk Delete via delMany()

```typescript
// Cascade delete: remove all comments on a deleted article
const count = await storage.delMany('comment', { target: articleId });
```

**Pattern:** Used for cascade operations when a parent entity is deleted.

## Pattern 6: Multi-Relation Concepts

Some concepts use multiple relations. Each relation stores a different aspect:

```typescript
// registry.handler.ts — register action
async register(input, storage) {
  const conceptId = generateId();

  await storage.put('concepts', conceptId, {
    id: conceptId,
    name: input.name,
    spec: input.spec,
  });
  await storage.put('uri', conceptId, {
    id: conceptId,
    uri: input.uri,
  });
  await storage.put('transport', conceptId, {
    id: conceptId,
    transportType: input.transportType,
  });
  await storage.put('available', conceptId, {
    id: conceptId,
    isAvailable: true,
  });

  return { variant: 'ok', conceptId };
}
```

### Cascading Delete Across Relations

```typescript
// registry.handler.ts — deregister action
async deregister(input, storage) {
  const conceptId = input.conceptId as string;

  await storage.del('concepts', conceptId);
  await storage.del('uri', conceptId);
  await storage.del('transport', conceptId);
  await storage.del('available', conceptId);

  return { variant: 'ok' };
}
```

**Pattern:** Same key across multiple relations. Delete from all relations when removing the entity.

## Pattern 7: Schema Version Tracking

The migration framework uses a reserved `_meta` relation:

```typescript
// migration.handler.ts
const META_RELATION = '_meta';
const META_KEY = 'schema';

// Read version
const meta = await storage.get('_meta', 'schema');
const version = meta ? (meta.version as number) : 0;

// Write version
await storage.put('_meta', 'schema', { version: 2 });
```

**Important for adapter authors:** The `_meta` relation must work like any other relation. Don't special-case it — just ensure it's supported.

## Pattern 8: Sensitive Data Storage

```typescript
// password.handler.ts — register action
async register(input, storage) {
  const user = input.user as string;
  const password = input.password as string;

  const salt = randomBytes(32);
  const hash = scryptSync(password, salt, 64);

  await storage.put('password', user, {
    user,
    hash: hash.toString('base64'),
    salt: salt.toString('base64'),
  });

  return { variant: 'ok', user };
}
```

**Pattern:** Derived/hashed values stored alongside the key. Storage adapters should not interpret field values — just store and return them as-is.

## Summary: What Your Adapter Must Support

| Requirement | Reason | Example |
|------------|--------|---------|
| String keys | All concepts use string keys | `"art-1"`, `"u-1"`, `"javascript"` |
| Flat objects with arbitrary fields | Records have varying shapes | `{ article, slug, title, ... }` |
| Array-valued fields | Set-typed state | `{ following: ["u-1", "u-2"] }` |
| Lazy relation creation | Relations aren't pre-declared | First `put('tag', ...)` creates the tag relation |
| Equality criteria matching | `find()` with criteria | `find('user', { email: 'a@b.com' })` |
| Silent no-op deletes | `del()` on missing keys | `del('article', 'nonexistent')` |
| Return counts from delMany | Cascade operations | `delMany('comment', { target: 'art-1' })` → `3` |
| Copy-on-read | Data isolation | `get()` returns new object, not internal ref |
| No metadata leakage | Clean API | `get()` result has no `lastWrittenAt` |
