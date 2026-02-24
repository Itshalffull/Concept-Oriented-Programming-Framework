---
name: kind-system
description: Define the taxonomy of intermediate representations and 
 artifacts in generation pipelines Track which kinds can 
 transform into which others Enable pipeline validation , 
 execution ordering , and cascading invalidation without 
 any concept needing to know the full taxonomy
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Bash
---

# KindSystem

Inspect the generation pipeline topology for **$ARGUMENTS** showing IR kinds, transform edges, and routing paths.


> **When to use:** Use when inspecting the IR kind taxonomy, finding transform paths between kinds, or querying which generators consume or produce a kind.


## Design Principles

- **Cycle-Free DAG:** The kind graph must be a directed acyclic graph. Cycle detection runs on every connect() call.
- **Static Topology:** Kinds and edges are registered at startup from kit.yaml metadata, not at generation time.

## Step-by-Step Process

### Step 1: View Kind Graph

Display the full IR kind taxonomy showing all kinds and transform edges.

**Checklist:**
- [ ] All generator kinds registered?
- [ ] No orphan kinds (unreachable from any source)?

**Examples:**
*Show full kind graph*
```bash
copf kind-system graph
```

### Step 2: Find Transform Path

Find the shortest transform path between two IR kinds.

**Arguments:** `$0` **from** (K), `$1` **to** (K)

**Checklist:**
- [ ] Path exists between the two kinds?

**Examples:**
*Find path from source to artifact*
```bash
copf kind-system route --from ConceptDSL --to TypeScriptFiles
```

### Step 3: Show Consumers

List all transforms that consume a given kind.

**Arguments:** `$0` **kind** (K)

**Examples:**
*What consumes ConceptManifest?*
```bash
copf kind-system consumers --kind ConceptManifest
```

### Step 4: Show Producers

List all transforms that produce a given kind.

**Arguments:** `$0` **kind** (K)

**Examples:**
*What produces TypeScriptFiles?*
```bash
copf kind-system producers --kind TypeScriptFiles
```

## References

- [KindSystem taxonomy and routing](references/kind-system-architecture.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| graph | `copf kind-system graph` | Show full kind taxonomy |
| route | `copf kind-system route` | Find shortest transform path |
| consumers | `copf kind-system consumers` | What consumes a kind |
| producers | `copf kind-system producers` | What produces a kind |
| define | `copf kind-system define` | Register a new kind |
| connect | `copf kind-system connect` | Declare a transform edge |
| validate | `copf kind-system validate` | Validate an edge |
| dependents | `copf kind-system dependents` | List downstream kinds |


## Validation

*List all kinds:*
```bash
npx tsx tools/copf-cli/src/index.ts kinds list
```
*Find transform path:*
```bash
npx tsx tools/copf-cli/src/index.ts kinds path ConceptDSL TypeScriptFiles
```
## Related Skills

| Skill | When to Use |
| --- | --- |
| `/incremental-caching` | Kind graph drives cascade invalidation |
| `/file-emission` | Kind routing determines generation order |
