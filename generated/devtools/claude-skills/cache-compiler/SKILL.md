---
name: cache-compiler
description: Build pre compiled artifacts from concept specs , syncs , 
 and implementations into the copf cache directory for 
 faster startup and deployment
argument-hint: [command] [specs] [syncs] [implementations]
allowed-tools: Read, Bash
---

# CacheCompiler

Build pre compiled artifacts from concept specs , syncs , 
 and implementations into the copf cache directory for 
 faster startup and deployment

## Step 1: Build Cache

Parse all specs and syncs , generate manifests , compile 
 sync rules , and write pre compiled artifacts to the 
 cache directory Skips unchanged files using content hashing

**Arguments:** `$0` **specs** (string), `$1` **syncs** (string), `$2` **implementations** (string)

**Examples:**
*Build cache*
```bash
copf compile --cache
```
