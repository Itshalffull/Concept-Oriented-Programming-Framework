---
name: storage-adapter-scaffold-gen
description: Use when adding a new storage backend to a COPF application. Generates a ConceptStorage adapter implementation with put, get, find, del, and delMany methods for the specified backend.
argument-hint: --name <AdapterName> --backend <backend>
allowed-tools: Read, Write, Bash
---

# StorageAdapterScaffoldGen

Scaffold a **$ARGUMENTS** storage adapter implementing the ConceptStorage interface with all five required methods.

> **When to use:** Use when adding a new storage backend to a COPF application. Generates a ConceptStorage adapter implementation with put, get, find, del, and delMany methods for the specified backend.

## Design Principles

- **Interface Compliance:** Every adapter must implement all five ConceptStorage methods — put, get, find, del, delMany. No optional methods.
- **Backend Transparency:** Concept handlers use storage through the interface without knowing which backend is active. Swapping backends requires no handler changes.
- **Relation-Key Namespace:** Storage is organized by relation name and key. Each concept uses its own relation names, preventing cross-concept conflicts.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track StorageConfig → StorageAdapter transformations.

**Examples:**
*Register the storage adapter scaffold generator*
```typescript
const result = await storageAdapterScaffoldGenHandler.register({}, storage);

```

### Step 2: Generate Storage Adapter

Generate a ConceptStorage adapter implementation for the specified backend (SQLite, PostgreSQL, Redis, DynamoDB, or in-memory) with put, get, find, del, and delMany methods.

**Examples:**
*Generate a PostgreSQL adapter*
```bash
copf scaffold storage --name AppStorage --backend postgresql
```
*Generate a Redis adapter*
```bash
copf scaffold storage --name CacheStorage --backend redis
```
*Generate an in-memory adapter*
```bash
copf scaffold storage --name TestStorage --backend memory
```

**Checklist:**
- [ ] Backend is valid (sqlite, postgresql, redis, dynamodb, memory)?
- [ ] Adapter class implements ConceptStorage interface?
- [ ] All five methods (put, get, find, del, delMany) are implemented?
- [ ] Constructor accepts backend-specific configuration?
- [ ] Find method supports criteria-based filtering?
- [ ] Proper serialization (JSON.stringify/parse) for non-native types?

## References

- [Storage adapter implementation guide](references/storage-adapter-guide.md)

## Supporting Materials

- [Storage adapter scaffolding walkthrough](examples/scaffold-storage-adapter.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | Adapter class name (PascalCase) |
| backend | String | Backend type (sqlite, postgresql, redis, dynamodb, memory) |

| Backend | Import | Constructor |
|---------|--------|-------------|
| sqlite | better-sqlite3 | `new SqliteStorage(dbPath)` |
| postgresql | pg | `new PgStorage(connectionString)` |
| redis | redis | `new RedisStorage(url)` |
| dynamodb | @aws-sdk/client-dynamodb | `new DynamoStorage(region, table)` |
| memory | (none) | `new MemoryStorage()` |


## Anti-Patterns

### Missing find criteria filtering
Find method ignores criteria parameter — returns all records regardless.

**Bad:**
```
async find(relation) {
  return this.db.all('SELECT * FROM store WHERE relation = ?', relation);
}
```

**Good:**
```
async find(relation, criteria?) {
  let results = this.db.all('SELECT * FROM store WHERE relation = ?', relation);
  if (criteria) {
    results = results.filter(r =>
      Object.entries(criteria).every(([k, v]) => r[k] === v)
    );
  }
  return results;
}
```

## Validation

*Generate a storage adapter:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold storage --name AppStorage --backend postgresql
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| deployment-config | Configure storage backends in deploy manifests |
| handler-scaffold | Generate handlers that use the storage adapter |

