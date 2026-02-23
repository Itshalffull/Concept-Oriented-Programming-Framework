---
name: spec-parser
description: Parse concept files into structured ASTs
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# SpecParser

Parse concept files into structured ASTs

## Step 1: Parse and Validate

Parse all .concept specs in the project and report syntax or structural errors.

**Arguments:** `$0` **source** (string)

**Checklist:**
- [ ] Has purpose block?
- [ ] Actions have at least one variant?
- [ ] Invariants reference valid actions?
- [ ] Type parameters declared and used?

**Examples:**
*Parse a concept file*
```typescript
import { parseConceptFile } from './parser';
const ast = parseConceptFile(source);
```

## References

- [Concept grammar reference](references/concept-grammar.md)
- [Jackson's concept design methodology](references/jackson-methodology.md)
