# Worked Example: RealWorld App Implementations

All concept handler implementations from the RealWorld (Conduit) blogging platform. Each shows the concept spec's requirements and the complete implementation pattern.

## Overview

| Concept | File | Actions | Relations | Lines | Key Pattern |
|---------|------|---------|-----------|-------|-------------|
| Echo | echo.impl.ts | send | echo | 12 | Minimal: put + return |
| User | user.impl.ts | register | user | 27 | Uniqueness check |
| Password | password.impl.ts | set, check, validate | password | 47 | Crypto (hash + salt) |
| JWT | jwt.impl.ts | generate, verify | tokens | 56 | Crypto (HMAC), helper functions |
| Article | article.impl.ts | create, update, delete, get | article | 93 | Full CRUD, derived fields |
| Comment | comment.impl.ts | create, delete, list | comment | 50 | Query + JSON serialization |
| Profile | profile.impl.ts | update, get | profile | 31 | Simple read/write |
| Follow | follow.impl.ts | follow, unfollow, isFollowing | follow | 48 | Array mutation |
| Favorite | favorite.impl.ts | favorite, unfavorite, isFavorited, count | favorite | 63 | Array mutation + aggregation |

---

## Echo — Minimal Handler

**Spec requirements**: One action, one variant, one relation.

```typescript
// echo.impl.ts — 12 lines
import type { ConceptHandler } from '@copf/kernel';

export const echoHandler: ConceptHandler = {
  async send(input, storage) {
    const id = input.id as string;
    const text = input.text as string;
    await storage.put('echo', id, { text });
    return { variant: 'ok', id, echo: text };
  },
};
```

**Pattern**: Extract inputs → store → return ok with output fields. This is the simplest possible handler.

---

## User — Uniqueness Checks

**Spec requirements**: Register user with unique name and email.

```typescript
// user.impl.ts — 27 lines
import type { ConceptHandler } from '@copf/kernel';

export const userHandler: ConceptHandler = {
  async register(input, storage) {
    const user = input.user as string;
    const name = input.name as string;
    const email = input.email as string;

    // Check for duplicate name
    const existingByName = await storage.find('user', { name });
    if (existingByName.length > 0) {
      return { variant: 'error', message: 'name already taken' };
    }

    // Check for duplicate email
    const existingByEmail = await storage.find('user', { email });
    if (existingByEmail.length > 0) {
      return { variant: 'error', message: 'email already taken' };
    }

    await storage.put('user', user, { user, name, email });
    return { variant: 'ok', user };
  },
};
```

**Pattern**: Validate uniqueness via `find()` before `put()`. Return `error` variant with descriptive message on duplicate.

---

## Password — Crypto Operations

**Spec requirements**: Salted hash storage, check comparison, stateless validation. Requires `crypto` capability.

```typescript
// password.impl.ts — 47 lines
import { createHash, randomBytes } from 'crypto';
import type { ConceptHandler } from '@copf/kernel';

export const passwordHandler: ConceptHandler = {
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

  async check(input, storage) {
    const user = input.user as string;
    const password = input.password as string;

    const record = await storage.get('password', user);
    if (!record) {
      return { variant: 'notfound', message: 'No credentials for user' };
    }

    const salt = Buffer.from(record.salt as string, 'base64');
    const hash = createHash('sha256').update(password).update(salt).digest();
    const storedHash = Buffer.from(record.hash as string, 'base64');

    return { variant: 'ok', valid: hash.equals(storedHash) };
  },

  async validate(input, _storage) {
    const password = input.password as string;
    return { variant: 'ok', valid: password.length >= 8 };
  },
};
```

**Patterns**:
- **set**: Input validation → random salt → hash → store base64-encoded. Three variants: ok, invalid.
- **check**: Fetch record → not-found guard → recompute hash → compare. Returns boolean `valid`.
- **validate**: Stateless (no storage). Uses `_storage` to indicate unused param.

---

## JWT — Helper Functions and Module-Level State

**Spec requirements**: Token generation and verification. Requires `crypto` capability.

```typescript
// jwt.impl.ts — 56 lines
import { createHmac, randomBytes } from 'crypto';
import type { ConceptHandler } from '@copf/kernel';

const JWT_SECRET = randomBytes(32);

function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature !== expected) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

export const jwtHandler: ConceptHandler = {
  async generate(input, storage) {
    const user = input.user as string;
    const token = signToken({ user, iat: Date.now() });
    await storage.put('tokens', user, { user, token });
    return { variant: 'ok', token };
  },

  async verify(input, _storage) {
    const token = input.token as string;
    const payload = verifyToken(token);

    if (!payload || !payload.user) {
      return { variant: 'error', message: 'Invalid or expired token' };
    }

    return { variant: 'ok', user: payload.user as string };
  },
};
```

**Patterns**:
- **Module-level constant**: `JWT_SECRET` initialized once at import time
- **Private helper functions**: `signToken()` and `verifyToken()` above the handler
- **generate**: Stateful — stores token for the user
- **verify**: Stateless — only reads the token itself, not storage

---

## Article — Full CRUD with Derived Fields

**Spec requirements**: Create/update/delete/get with slug generation, timestamps, not-found handling.

```typescript
// article.impl.ts — 93 lines
import type { ConceptHandler } from '@copf/kernel';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const articleHandler: ConceptHandler = {
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
  },

  async update(input, storage) {
    const article = input.article as string;
    const title = input.title as string;
    const description = input.description as string;
    const body = input.body as string;

    const existing = await storage.get('article', article);
    if (!existing) {
      return { variant: 'notfound', message: 'Article not found' };
    }

    const now = new Date().toISOString();
    const slug = slugify(title);

    await storage.put('article', article, {
      ...existing, slug, title, description, body,
      updatedAt: now,
    });

    return { variant: 'ok', article };
  },

  async delete(input, storage) {
    const article = input.article as string;

    const existing = await storage.get('article', article);
    if (!existing) {
      return { variant: 'notfound', message: 'Article not found' };
    }

    await storage.del('article', article);
    return { variant: 'ok', article };
  },

  async get(input, storage) {
    const article = input.article as string;

    const record = await storage.get('article', article);
    if (!record) {
      return { variant: 'notfound', message: 'Article not found' };
    }

    return {
      variant: 'ok', article,
      slug: record.slug as string,
      title: record.title as string,
      description: record.description as string,
      body: record.body as string,
      author: record.author as string,
    };
  },
};
```

**Patterns**:
- **create**: Derived fields (slug, timestamps), all-at-once put
- **update**: Existence check → spread existing → overwrite fields → put
- **delete**: Existence check → del
- **get**: Existence check → return all fields from spec's ok variant

---

## Comment — Query and List

**Spec requirements**: Create/delete/list with target (article) association.

```typescript
// comment.impl.ts — 50 lines
import type { ConceptHandler } from '@copf/kernel';

export const commentHandler: ConceptHandler = {
  async create(input, storage) {
    const comment = input.comment as string;
    const body = input.body as string;
    const target = input.target as string;
    const author = input.author as string;
    const now = new Date().toISOString();

    await storage.put('comment', comment, {
      comment, body, target, author, createdAt: now,
    });

    return { variant: 'ok', comment };
  },

  async delete(input, storage) {
    const comment = input.comment as string;

    const existing = await storage.get('comment', comment);
    if (!existing) {
      return { variant: 'notfound', message: 'Comment not found' };
    }

    await storage.del('comment', comment);
    return { variant: 'ok', comment };
  },

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
};
```

**Patterns**:
- **list**: Uses `find()` with criteria, maps results, serializes with `JSON.stringify()`
- **create**: Includes `target` field for parent association (used by cascade syncs)

---

## Favorite — Array Mutation and Aggregation

**Spec requirements**: Toggle favorite status, check status, count favorites.

```typescript
// favorite.impl.ts — 63 lines
import type { ConceptHandler } from '@copf/kernel';

export const favoriteHandler: ConceptHandler = {
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

  async isFavorited(input, storage) {
    const user = input.user as string;
    const article = input.article as string;

    const existing = await storage.get('favorite', user);
    const favorites: string[] = existing ? (existing.favorites as string[]) : [];

    return { variant: 'ok', favorited: favorites.includes(article) };
  },

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
  },
};
```

**Patterns**:
- **Array-as-set**: Store arrays in single record, keyed by user
- **favorite**: Read or init array → push if not present → put
- **unfavorite**: Read → filter → put
- **isFavorited**: Read → includes check
- **count**: Scan all records → count occurrences (O(n) but simple)

---

## Pattern Summary

| Pattern | Used By | Key Technique |
|---------|---------|---------------|
| Store + return | Echo, Article/create, Comment/create | `put()` then return ok |
| Uniqueness check | User | `find()` before `put()` |
| Existence check | Article/update/delete/get, Comment/delete | `get()`, return notfound if null |
| Read-modify-write | Article/update | `get()`, spread `...existing`, `put()` |
| Array mutation | Favorite, Follow, Tag | Read or init array, push/filter, `put()` |
| Crypto | Password, JWT | `createHash`, `createHmac`, `randomBytes` |
| Helper functions | Article (slugify), JWT (signToken/verifyToken) | Private to file, defined above handler |
| Stateless | Password/validate, JWT/verify | Uses `_storage` to mark unused |
| Query + map | Comment/list | `find()`, `.map()`, return serialized |
| Aggregation | Favorite/count | `find()` all, iterate and count |
