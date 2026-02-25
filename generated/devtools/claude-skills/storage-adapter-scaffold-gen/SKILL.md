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

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (StorageConfig → StorageAdapter).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual storage adapter implementation is produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track StorageConfig → StorageAdapter transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the storage adapter scaffold generator*
```typescript
const result = await storageAdapterScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "StorageConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "StorageAdapterScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `StorageAdapterScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold storage preview --name AppStorage --backend postgresql
```

### Step 5: Generate Storage Adapter

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

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

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
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

