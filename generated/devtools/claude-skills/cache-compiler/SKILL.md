---
name: cache-compiler
description: Build pre compiled artifacts from concept specs , syncs , 
 and implementations into the copf cache directory for 
 faster startup and deployment
argument-hint: --cache
allowed-tools: Read, Bash
---

# CacheCompiler

Build pre-compiled cache artifacts from all concept specs and sync rules for faster startup and deployment.


> **When to use:** Use when building pre-compiled artifacts for deployment or to speed up startup. Parses all specs, generates manifests, compiles syncs, and writes cache files.


## Design Principles

- **Content-Addressed Cache:** Cached artifacts are keyed by content hash — identical input produces identical output, and unchanged files are never rewritten.
- **Complete Compilation:** Cache includes everything needed for deployment — parsed ASTs, generated manifests, compiled syncs, and type information.

## Step-by-Step Process

### Step 1: Build Cache

Parse all specs and syncs , generate manifests , compile 
 sync rules , and write pre compiled artifacts to the 
 cache directory Skips unchanged files using content hashing

**Arguments:** `$0` **specs** (string), `$1` **syncs** (string), `$2` **implementations** (string)

**Checklist:**
- [ ] All concept specs parse without errors?
- [ ] All sync files compile?
- [ ] Cache directory is writable?
- [ ] Previous cache is cleaned or invalidated?

**Examples:**
*Build cache*
```bash
copf compile --cache
```
*Build cache with verbose output*
```bash
copf compile --cache --verbose
```

## References

- [Cache compilation and invalidation](references/caching.md)
## Supporting Materials

- [Production build walkthrough](examples/build-for-production.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| compile | `copf compile --cache` | Build pre-compiled cache |


## Validation

*Build the cache:*
```bash
npx tsx tools/copf-cli/src/index.ts compile --cache
```
*Verify cache contents:*
```bash
ls -la .copf-cache/
```
## Related Skills

| Skill | When to Use |
| --- | --- |
| `/concept-validator` | Validate specs before caching |
| `/deployment-config` | Deploy using cached artifacts |
| `/dev-workflow` | Dev server uses cache for fast startup |
