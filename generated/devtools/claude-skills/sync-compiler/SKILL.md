---
name: sync-compiler
description: Compile parsed synchronizations into executable registrations
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# SyncCompiler

Compile parsed synchronizations into executable registrations

## Step 1: Compile Sync Rules

Compile .sync files that wire concepts together through pattern matching on completions.

**Arguments:** `$0` **sync** (Y), `$1` **ast** (syncast)

**Checklist:**
- [ ] Sync references valid concept actions?
- [ ] Variable bindings are consistent?
- [ ] Where-clause queries are well-formed?

**Examples:**
*Compile sync rules*
```bash
copf compile-syncs --dir ./syncs
```

## References

- [Sync language and patterns](references/sync-design.md)
- [Reusable sync templates](references/sync-patterns.md)
