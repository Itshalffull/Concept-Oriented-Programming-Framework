# Runtime Infrastructure Agent — Implementation Plan

**Version:** 1.0.0  
**Date:** 2026-04-08  
**Status:** Implementation-ready  
**Problem:** No specialized agent for runtime/adapter infrastructure work (storage adapters, interpreter, StorageProgram DSL, transport, effects). General-purpose agents lack the domain context.  
**New derived concepts:** 3 sub-derivations + 1 root  
**New skills:** 1 (runtime-infrastructure) with references  
**Modified:** Agent target handler (add references support), devtools manifest  

### Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Commit |
|---|---|---|---|---|
| **MAG-549** Sub-Derived Concepts | §1 | — | MAG-551, MAG-552 | |
| **MAG-550** Agent Target: References Support | §2 | — | MAG-552 | |
| **MAG-551** Runtime Infrastructure Skill + References | §3 | MAG-549 | MAG-552 | |
| **MAG-552** Agent Definition + Regen | §4 | MAG-549–551 | — | |

---

## 0. Design Rationale

Agents derive their domain expertise from:
1. **Skills** — procedural knowledge (how to create/modify things)
2. **References** — declarative knowledge (what things exist, how they work)
3. **Derived concepts** — structural knowledge (what composes with what)

The runtime infrastructure agent needs all three. Skills for creating adapters and handlers already exist. What's missing is:
- Sub-derived concepts that map infrastructure areas to skill groups
- Reference documentation embedded in the manifest
- The ability for agents (not just skills) to carry references

---

## 1. Sub-Derived Concepts

Three sub-derivations organize the runtime infrastructure into skill-addressable areas:

### 1.1 MonadicExecution

```
derived MonadicExecution [M] {
  purpose {
    The monadic execution pipeline — StorageProgram DSL construction,
    interpretation against storage backends, effect handling for
    transport operations, functional handler registration, and
    program analysis providers (purity, commutativity, parallelism,
    dead branches, variant extraction, lens extraction).
  }

  composes {
    StorageProgram [M]
    ProgramInterpreter [M]
    FunctionalHandler [M]
    EffectHandler [M]
    ProgramAnalysis [M]
    ProgramCache [M]
  }
}
```

**File:** `clef-base/derived/monadic-execution.derived`

### 1.2 AdapterInfrastructure

```
derived AdapterInfrastructure [A] {
  purpose {
    Storage and transport adapter infrastructure — the pluggable
    backends that connect concept handlers to physical systems.
    Storage adapters implement ConceptStorage (in-memory, file,
    PostgreSQL, SQLite, DynamoDB, Redis, Firestore). Transport
    adapters implement ConceptTransport (HTTP, WebSocket, pub/sub,
    SQS, serverless). Includes secondary index support, conflict
    resolution, connection pooling, and cold start optimization.
  }

  composes {
    StorageAdapterScaffoldGen [A]
    TransportAdapterScaffoldGen [A]
    StorageProvider [A]
  }
}
```

**File:** `clef-base/derived/adapter-infrastructure.derived`

### 1.3 RuntimeInfrastructure (root)

```
derived RuntimeInfrastructure [R] {
  purpose {
    Complete runtime infrastructure — monadic execution pipeline,
    storage/transport adapters, and application-level infrastructure
    primitives (cache, plugin registry, event bus). The layer between
    concept handlers and the physical world.
  }

  composes {
    MonadicExecution [R]
    AdapterInfrastructure [R]
    InfrastructureCore [R]
  }
}
```

**File:** `clef-base/derived/runtime-infrastructure.derived` (update existing)

---

## 2. Agent Target: References Support

### 2.1 AgentAnnotation Type Change

Add `references` to the `AgentAnnotation` interface in `handlers/ts/framework/providers/claude-agents-target.handler.ts`:

```typescript
interface AgentAnnotation {
  prompt?: string;
  model?: string;
  skills?: string[];
  tools?: string | string[];
  rules?: string[];
  workflow?: string[];
  references?: Array<{
    path: string;
    label: string;
    tier?: string;
    content: string;
  }>;
}
```

### 2.2 generateAgentMd Changes

After generating the agent .md file, also generate reference files. The `generate` method should return multiple files:

```typescript
// Current: returns [{ path: 'agent-name.md', content: '...' }]
// New: returns [
//   { path: 'agent-name.md', content: '...' },
//   { path: 'agent-name/references/guide.md', content: '...' },
// ]
```

### 2.3 Agent .md Frontmatter

Add a `references:` key to the agent frontmatter that lists available reference files:

```yaml
---
name: runtime-infrastructure
description: ...
model: sonnet
tools: Read, Grep, Glob, Edit, Write, Bash, mcp__vibe_kanban
skills:
  - create-storage-adapter
  - create-transport-adapter
  - ...
references:
  - references/runtime-infrastructure-guide.md
---
```

### 2.4 Manifest Schema

In the devtools manifest `agent-annotations:` section, agents can now declare:

```yaml
RuntimeInfrastructure:
  model: sonnet
  skills: [...]
  tools: ...
  prompt: ...
  workflow: [...]
  rules: [...]
  references:
    - path: references/runtime-infrastructure-guide.md
      label: "Runtime infrastructure reference"
      tier: reference
      content: |
        # Runtime Infrastructure Reference Guide
        ...
```

Same format as skill references — `path`, `label`, `tier`, `content`.

---

## 3. Runtime Infrastructure Skill + References

### 3.1 Skill Definition

Add to the `skills:` section of `devtools.interface.yaml`:

```yaml
runtime-infrastructure:
  concept: RuntimeInfrastructure
  steps:
    - action: analyze
      title: "Analyze Runtime Impact"
      prose: "Determine which runtime layer is affected: storage adapter, interpreter, StorageProgram DSL, transport, effect system, or infrastructure primitives."
    - action: modify
      title: "Modify Runtime Infrastructure"
      prose: "Implement the change following the appropriate pattern for the affected layer."
    - action: test
      title: "Test Infrastructure Change"
      prose: "Write tests covering the change — storage adapter tests, interpreter tests, or integration tests."
  checklists:
    modify:
      - "ConceptStorage interface backward-compatible (new methods are optional)?"
      - "In-memory adapter updated?"
      - "SQL adapters updated if applicable?"
      - "Interpreter handles new instruction types?"
      - "EffectSet tracking updated if new effects?"
      - "Analysis providers updated if purity/commutativity affected?"
      - "Existing tests still pass?"
  design-principles:
    - title: "Adapter Transparency"
      rule: "Concept handlers use storage/transport through interfaces without knowing which backend is active."
    - title: "Backward Compatibility"
      rule: "New interface methods MUST be optional (?). Existing adapters must not break."
    - title: "Index as Configuration"
      rule: "Secondary indexes are declared via ensureIndex, not baked into handler logic."
  references:
    - path: references/runtime-infrastructure-guide.md
      label: "Complete runtime infrastructure reference"
      tier: reference
      content: |
        (the full guide content — see §3.2)
```

### 3.2 Reference Content

The reference guide covers:
- Architecture overview (three-layer diagram)
- Key files table (runtime/types.ts, storage-program.ts, interpreter.ts, adapters/*)
- ConceptStorage interface (full signature)
- Secondary index system (ensureIndex, internal structure)
- StorageProgram DSL (all instructions)
- Monadic concepts table (spec paths)
- Analysis providers table
- Infrastructure concepts table
- Derived concepts table
- Common patterns: adding adapter methods, adding instructions, adding adapters, adding indexes

---

## 4. Agent Definition + Regen

### 4.1 Agent Definition

Add to `agent-annotations:` in `devtools.interface.yaml`:

```yaml
RuntimeInfrastructure:
  model: sonnet
  skills:
    - runtime-infrastructure
    - create-storage-adapter
    - create-transport-adapter
    - create-implementation
    - effect-handler
    - storage-program
    - program-interpreter
    - program-analysis
    - score-api
  tools: Read, Grep, Glob, Edit, Write, Bash, mcp__vibe_kanban
  prompt: |
    You are a Clef runtime infrastructure specialist. You work on the
    execution layer between concept handlers and physical backends.

    Your domain covers:
    - **Storage adapters** — ConceptStorage implementations (in-memory,
      file, PostgreSQL, SQLite, DynamoDB, Redis, Firestore, Upstash)
    - **Transport adapters** — ConceptTransport implementations (HTTP,
      WebSocket, pub/sub, SQS, serverless)
    - **StorageProgram DSL** — instruction types, builder functions,
      effect tracking, purity classification
    - **Interpreter** — program execution, transaction boundaries,
      completion production, trace recording
    - **Effect system** — perform instructions, effect handler
      registration, protocol-operation dispatch
    - **Secondary indexes** — ensureIndex, index maintenance, indexed find
    - **Infrastructure primitives** — Cache, PluginRegistry, EventBus
      wiring for runtime features
    - **Sync engine** — per-request evaluation, serverless evaluation
    - **Serverless** — Lambda/GCF handlers, cold start, connection pooling

    Key derived concepts you work with:
    - RuntimeInfrastructure (root) — your primary domain
    - MonadicExecution — StorageProgram + Interpreter + Effects
    - AdapterInfrastructure — Storage + Transport adapters
    - InfrastructureCore — Cache, PluginRegistry, EventBus, Validator
  workflow:
    - "**Identify the layer** — is this a storage adapter, interpreter, DSL, transport, or infrastructure change?"
    - "**Read current code** — understand the existing implementation before modifying"
    - "**Check interface compatibility** — new ConceptStorage/ConceptTransport methods must be optional"
    - "**Implement the change** — follow the pattern for the affected layer"
    - "**Update all adapters** — if the interface changed, update in-memory adapter at minimum"
    - "**Update analysis providers** — if new instructions or effects, update purity/commutativity/etc."
    - "**Write tests** — storage adapter tests, interpreter tests, or integration tests"
    - "**Verify backward compat** — run existing tests to ensure no regressions"
  rules:
    - "**Interface methods are optional** — add `?` to new ConceptStorage/ConceptTransport methods. Existing adapters must not break"
    - "**In-memory adapter is primary** — always implement in the in-memory adapter first. It's used by all tests, the dev server, and the kernel"
    - "**Never modify concept specs for adapter concerns** — indexes, caching, connection pooling are adapter-level, not concept-level"
    - "**StorageProgram instructions are data** — they describe intent, not execution. The interpreter executes them"
    - "**Effect handlers bridge perform() to protocols** — handlers declare transport effects via perform(); EffectHandler resolves them to concrete implementations"
    - "**Secondary indexes are declarative** — call ensureIndex() during init, not inside handler actions"
    - "**Test the adapter, not the concept** — adapter tests verify storage behavior. Concept conformance tests verify handler logic. Don't conflate them"
    - "**Backward compat for find()** — find() without indexed criteria must still work (linear scan fallback)"
  references:
    - path: references/runtime-infrastructure-guide.md
      label: "Runtime infrastructure reference"
      tier: reference
      content: |
        (inline content from the reference guide)
```

### 4.2 Regenerate

```bash
npx tsx --tsconfig tsconfig.json scripts/regen-interface.ts
```

This generates:
- `.claude/agents/runtime-infrastructure.md` — agent file with frontmatter + prompt
- `.claude/agents/runtime-infrastructure/references/runtime-infrastructure-guide.md` — reference doc (NEW capability)
- `.claude/skills/runtime-infrastructure/SKILL.md` — skill file
- `.claude/skills/runtime-infrastructure/references/runtime-infrastructure-guide.md` — skill reference

---

## 5. Open Questions

1. **Reference file output path for agents** — Currently agents generate a single `.md` file. With references, each agent may need a directory: `.claude/agents/{name}.md` + `.claude/agents/{name}/references/*.md`. Or references could be inlined into the agent .md file. The directory approach matches how skills work.

2. **Sub-derived concept skills** — Should MonadicExecution and AdapterInfrastructure each get their own skill, or is the single `runtime-infrastructure` skill sufficient? The skill could have sub-sections, or we could create `monadic-execution` and `adapter-infrastructure` skills mapped to their derived concepts.

3. **Codex/Gemini parity** — The generator also emits to `.codex/agents/` and `.gemini/agents/`. References need to be generated for all three targets.
