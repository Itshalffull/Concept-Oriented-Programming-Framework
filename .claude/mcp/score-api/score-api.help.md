# score_api — MCP Tool Guide

Unified facade over the five Score suites ( parse , symbol , semantic , analysis , discovery ) providing a single LLM friendly surface for querying any Clef project s structure , symbols , semantics , data flows , and search indexes . Every Clef app gets ScoreApi registered automatically LLMs can immediately ask questions about the codebase without configuration . Actions are designed for natural language invocation : parameter names read as English , results are structured for tool use consumption , and error variants include actionable suggestions

## Design Principles

- **Query, Don't Grep:** Score provides structured queries — use them instead of raw file reading.
- **Concepts Are Independent:** No concept references another — all coupling is through syncs.
- **Variants Over Exceptions:** Every action outcome is an explicit named variant.
## Anti-Patterns

### Bypassing Score for raw file access
Reading .concept files directly instead of using Score queries — misses parsing, validation, and cross-references.

**Bad:**
```
# Manually grep for concept actions
grep -r "action create" repertoire/

```

**Good:**
```
# Use Score API
score listConcepts
score getConcept --name User
score getFlow --from User/create

```

### Assuming concept coupling
Looking for direct references between concepts — concepts are independent by design.

**Bad:**
```
# Wrong: searching for concept-to-concept imports
grep "import.*from.*User" repertoire/profile/

```

**Good:**
```
# Right: find syncs that connect User and Profile
score listSyncs --involves User,Profile

```
