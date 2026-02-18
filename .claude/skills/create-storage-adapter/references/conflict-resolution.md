# Conflict Resolution Reference

How COPF storage adapters detect and resolve concurrent write conflicts. Two-phase system: LWW timestamps + `onConflict` hooks with four resolution strategies.

## Overview

When multiple runtimes (e.g., phone offline + server) write to the same concept, their storage changes may conflict. The conflict detection system has two phases:

```
Phase 1: LWW Timestamps (always active)
  Every put() stores a lastWrittenAt timestamp.
  If no onConflict callback → last-writer-wins with console warning.

Phase 2: onConflict Hooks (opt-in)
  Caller sets storage.onConflict callback.
  put() calls it when overwriting existing records.
  Four resolution strategies: keep-existing, accept-incoming, merge, escalate.
```

## Phase 1: Last-Writer-Wins (LWW) with Timestamps

Every `put()` automatically stores a `lastWrittenAt` timestamp alongside the record data. When no `onConflict` callback is set:

```typescript
// Default behavior in put() when overwriting
if (existing.meta.lastWrittenAt > now) {
  console.warn(
    `[copf/storage] LWW conflict: overwriting ${relation}/${key} ` +
    `(existing: ${existing.meta.lastWrittenAt}, incoming: ${now})`,
  );
}
// Always writes the incoming value regardless
```

**Behavior:** The incoming value always wins, but a warning is logged if the existing record has a more recent timestamp (clock skew or replay scenario).

## Phase 2: onConflict Callback

When the `onConflict` callback is set on the storage instance, `put()` calls it before overwriting:

```typescript
storage.onConflict = (info: ConflictInfo): ConflictResolution => {
  // Decide what to do with the conflict
  return { action: 'accept-incoming' };
};
```

### ConflictInfo

The callback receives full details about both the existing and incoming records:

```typescript
interface ConflictInfo {
  relation: string;     // Which relation has the conflict
  key: string;          // Which key has the conflict
  existing: {
    fields: Record<string, unknown>;  // Current stored data
    writtenAt: string;                // ISO 8601 timestamp of last write
  };
  incoming: {
    fields: Record<string, unknown>;  // Data being written
    writtenAt: string;                // ISO 8601 timestamp of this write
  };
}
```

### Four Resolution Strategies

#### 1. `keep-existing` — Reject the incoming write

```typescript
storage.onConflict = () => ({ action: 'keep-existing' });
```

- `put()` returns without writing
- The existing record is unchanged
- Use case: Rejecting stale writes during offline replay

**Test:**
```typescript
await storage.put('users', 'u-1', { name: 'alice' });
storage.onConflict = () => ({ action: 'keep-existing' });
await storage.put('users', 'u-1', { name: 'bob' });
const data = await storage.get('users', 'u-1');
expect(data!.name).toBe('alice');  // Original preserved
```

#### 2. `accept-incoming` — Write the incoming value (same as default LWW)

```typescript
storage.onConflict = () => ({ action: 'accept-incoming' });
```

- `put()` proceeds normally, overwriting the existing record
- Use case: Explicit acknowledgment that the new value should win

**Test:**
```typescript
await storage.put('users', 'u-1', { name: 'alice' });
storage.onConflict = () => ({ action: 'accept-incoming' });
await storage.put('users', 'u-1', { name: 'bob' });
const data = await storage.get('users', 'u-1');
expect(data!.name).toBe('bob');  // New value accepted
```

#### 3. `merge` — Write a custom merged record

```typescript
storage.onConflict = (info) => ({
  action: 'merge',
  merged: {
    name: info.incoming.fields.name,
    score: (info.existing.fields.score as number)
         + (info.incoming.fields.score as number),
  },
});
```

- `put()` writes the `merged` object instead of the incoming value
- Use case: Combining data from both versions (counters, lists, etc.)

**Test:**
```typescript
await storage.put('users', 'u-1', { name: 'alice', score: 10 });
storage.onConflict = (info) => ({
  action: 'merge',
  merged: {
    name: info.incoming.fields.name,
    score: (info.existing.fields.score as number) + (info.incoming.fields.score as number),
  },
});
await storage.put('users', 'u-1', { name: 'alice', score: 5 });
const data = await storage.get('users', 'u-1');
expect(data!.score).toBe(15);  // Merged: 10 + 5
```

#### 4. `escalate` — Write but signal the conflict to the sync layer

```typescript
storage.onConflict = () => ({ action: 'escalate' });
```

- `put()` writes the incoming value (same as `accept-incoming`)
- But the caller (sync engine) is expected to produce a **conflict completion**
- The conflict completion can be matched by syncs to trigger resolution logic
- Use case: When the application needs to handle the conflict through sync rules

**Test:**
```typescript
await storage.put('users', 'u-1', { name: 'alice' });
let escalated = false;
storage.onConflict = () => { escalated = true; return { action: 'escalate' }; };
await storage.put('users', 'u-1', { name: 'bob' });
expect(escalated).toBe(true);
const data = await storage.get('users', 'u-1');
expect(data!.name).toBe('bob');  // Incoming written (escalation is post-hoc)
```

### When onConflict Is NOT Called

The callback is only triggered when:
- A record **already exists** at the given (relation, key)
- AND `storage.onConflict` is set (not `undefined`)

It is NOT called for:
- New record insertions (no existing record to conflict with)
- Deletions (`del()`, `delMany()`)
- Reads (`get()`, `find()`, `getMeta()`)

## How to Implement Conflict Detection in Your Adapter

```typescript
async put(relation, key, value) {
  const now = new Date().toISOString();
  const existing = /* get current record at (relation, key) */;

  if (existing) {
    if (storage.onConflict) {
      const info: ConflictInfo = {
        relation,
        key,
        existing: {
          fields: { ...existing.fields },
          writtenAt: existing.meta.lastWrittenAt,
        },
        incoming: {
          fields: { ...value },
          writtenAt: now,
        },
      };

      const resolution = storage.onConflict(info);

      switch (resolution.action) {
        case 'keep-existing':
          return;  // Don't write
        case 'accept-incoming':
          break;   // Fall through to normal write
        case 'merge':
          /* write resolution.merged instead of value */
          /* store with lastWrittenAt = now */
          return;
        case 'escalate':
          break;   // Write incoming, caller handles escalation
      }
    } else {
      // Default LWW: warn if overwriting a more recent entry
      if (existing.meta.lastWrittenAt > now) {
        console.warn(`[copf/storage] LWW conflict: ...`);
      }
    }
  }

  /* write value with lastWrittenAt = now */
}
```

## Conflict Escalation to the Sync Layer

When `escalate` is returned, the sync engine produces a conflict completion:

```typescript
// In the DistributedSyncEngine
const completion = engine.produceConflictCompletion(
  'urn:copf/Article',
  conflictInfo,
  flowId,
);
// completion.variant === 'conflict'
// completion.output === { key, existing: {...}, incoming: {...} }
```

This completion can be matched by a sync:

```
sync HandleArticleConflict {
  when {
    Article/write: [] => conflict(key: ?id, existing: ?old, incoming: ?new)
  }
  then {
    Article/merge: [ id: ?id; versions: [?old, ?new] ]
  }
}
```

## End-to-End Example: Phone + Server Concurrent Writes

```typescript
// Server writes first
const storage = createInMemoryStorage();
await storage.put('articles', 'art-1', {
  title: 'Draft', body: 'server body', edits: 1,
});

// Set up merge resolution
storage.onConflict = (info) => ({
  action: 'merge',
  merged: {
    title: info.incoming.fields.title,
    body: `${info.existing.fields.body}\n---\n${info.incoming.fields.body}`,
    edits: (info.existing.fields.edits as number)
         + (info.incoming.fields.edits as number),
  },
});

// Phone writes (simulating offline sync replay)
await storage.put('articles', 'art-1', {
  title: 'Updated', body: 'phone body', edits: 2,
});

const merged = await storage.get('articles', 'art-1');
// merged = { title: 'Updated', body: 'server body\n---\nphone body', edits: 3 }
```

## Source Locations

| Component | File | Lines |
|-----------|------|-------|
| `ConflictInfo`, `ConflictResolution` | `kernel/src/types.ts` | 54-66 |
| `EntryMeta` | `kernel/src/types.ts` | 49-51 |
| `put()` with conflict detection | `kernel/src/storage.ts` | 43-97 |
| Conflict resolution tests | `tests/conflict-resolution.test.ts` | 132-241 |
| End-to-end concurrent writes | `tests/conflict-resolution.test.ts` | 429-575 |
| `DistributedSyncEngine.produceConflictCompletion` | `framework/sync-engine.impl.ts` | 277-313 |
