# Bind Manifest Agent + Derived Concept Projection — Implementation Plan

**Version:** 1.0.0  
**Date:** 2026-04-08  
**Status:** Implementation-ready  
**Problems:**
1. Interface generation pipeline only projects `.concept` files — derived concepts can't generate agents/skills
2. No specialized agent for editing the devtools manifest (skills, agents, targets, references)
3. No skill for inbound binding (consuming external APIs into concepts)

### Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Commit |
|---|---|---|---|---|
| **MAG-553** Derived Concept Projection | §1 | — | MAG-555 | `4e9e28d7` |
| **MAG-554** Bind Manifest Outbound Skill | §2 | — | MAG-555 | `4e9e28d7` |
| **MAG-555** Bind Manifest Agent + Inbound Skill | §3 | ~~MAG-553~~, ~~MAG-554~~ | — | `24ac321e` |

---

## 1. Derived Concept Projection

### 1.1 Problem

The `concepts:` list in `devtools.interface.yaml` only accepts `.concept` files. The interface generation pipeline (spec parser → schema gen → projection → targets) only understands concept specs. Derived concepts (`.derived` files) can't be projected, so they can't generate agents, skills, MCP tools, or CLI commands.

This means derived concepts like RuntimeInfrastructure, ClefBase, MonadicExecution, etc. require hand-authored agent files rather than generated ones.

### 1.2 Design

Add `.derived` file support to the projection pipeline:

**1. Manifest `concepts:` accepts `.derived` paths**

```yaml
concepts:
  - specs/framework/spec-parser.concept
  - clef-base/derived/runtime-infrastructure.derived  # NEW
  - clef-base/derived/clef-base.derived                # NEW
```

**2. Derived parser produces a ConceptManifest-compatible projection**

The derived parser (`handlers/ts/framework/derived-parser.ts`) already produces a parsed AST. Add a `derivedToManifest()` function that converts a parsed derived concept into a `ConceptManifest` shape:

```typescript
function derivedToManifest(derived: DerivedAST): ConceptManifest {
  return {
    name: derived.name,
    purpose: derived.purpose,
    actions: derived.surfaceActions.map(a => ({
      name: a.name,
      params: a.params,
      variants: ['ok'],
    })),
    queries: derived.surfaceQueries,
    // Composed concepts listed as "dependencies"
    composedConcepts: derived.composes,
  };
}
```

**3. Interface command detects file type**

In `cli/src/commands/interface.ts`, when processing concept paths:
- `.concept` files → parse with spec parser → schema gen → project (existing)
- `.derived` files → parse with derived parser → derivedToManifest → project (new)

**4. Agent target uses derived projections**

The `claude-agents-target.handler.ts` already works with ConceptManifest projections. Once derived files produce manifests, agents are generated automatically.

### 1.3 Deliverables

| Deliverable | File |
|---|---|
| `derivedToManifest()` function | `handlers/ts/framework/derived-parser.ts` |
| Interface command: detect `.derived` files | `cli/src/commands/interface.ts` |
| Add derived paths to manifest `concepts:` list | `examples/devtools/devtools.interface.yaml` |
| Add RuntimeInfrastructure + ClefBase to `claude-agents` include | same |

---

## 2. Bind Manifest Outbound Skill

### 2.1 Purpose

Skill for editing interface manifests that **generate** interfaces FROM concepts. Covers adding/removing:
- Targets (REST, GraphQL, gRPC, CLI, MCP, skills, agents)
- Skills with steps, checklists, design-principles, references
- Agent annotations with prompt, workflow, rules, references
- Concept paths to the concepts list
- Include lists for each target

### 2.2 Skill Definition

```yaml
bind-manifest-outbound:
  concept: InterfaceScaffoldGen
  steps:
    - action: analyze
      title: "Analyze Manifest"
      prose: "Read the interface manifest and understand its current targets, skills, agents, and concept projections."
    - action: add-target
      title: "Add/Modify Target"
      prose: "Add or modify a target section (REST, GraphQL, CLI, MCP, skills, agents). Configure output directory, include list, and target-specific options."
    - action: add-skill
      title: "Add/Modify Skill"
      prose: "Add or modify a skill definition with steps, checklists, design-principles, and references. Each skill maps to a concept."
    - action: add-agent
      title: "Add/Modify Agent"
      prose: "Add or modify an agent annotation with model, skills, tools, prompt, workflow, rules, and references."
    - action: regenerate
      title: "Regenerate"
      prose: "Run the interface generation pipeline to produce updated output files."
  references:
    - path: references/interface-manifest-guide.md
      label: "Interface manifest format reference"
      content: (full reference for interface.yaml structure)
```

### 2.3 Deliverables

| Deliverable | File |
|---|---|
| Skill definition in manifest | `examples/devtools/devtools.interface.yaml` |
| Reference guide content | inline in manifest |

---

## 3. Bind Manifest Agent + Inbound Skill

### 3.1 Agent: BindManifest

An agent that has BOTH the outbound and inbound skills. It specializes in all interface manifest work.

```yaml
BindManifest:
  model: sonnet
  skills:
    - bind-manifest-outbound
    - bind-manifest-inbound
    - interface-entity
    - api-surface
    - score-api
  tools: Read, Grep, Glob, Edit, Write, Bash, mcp__vibe_kanban
  prompt: |
    You are a Clef Bind manifest specialist. You configure interface
    manifests that generate and consume APIs...
```

### 3.2 Inbound Skill

Skill for configuring manifests that **consume** external APIs and bind them TO existing concepts. This is the reverse of outbound — instead of generating REST/GraphQL from concepts, it connects external REST/GraphQL endpoints to concept actions.

```yaml
bind-manifest-inbound:
  concept: Connection
  steps:
    - action: analyze-api
      title: "Analyze External API"
      prose: "Read an OpenAPI spec, GraphQL schema, or API documentation. Identify endpoints, types, and operations."
    - action: map-to-concepts
      title: "Map to Concepts"
      prose: "Map external API operations to existing concept actions. Create bindings: external endpoint → concept action, external type → concept state."
    - action: configure-transport
      title: "Configure Transport"
      prose: "Set up the transport adapter (HTTP, WebSocket, gRPC) with authentication, base URL, and headers."
    - action: generate-bindings
      title: "Generate Bindings"
      prose: "Generate EffectHandler registrations and transport adapter configuration that bridges external APIs to concept perform() instructions."
```

### 3.3 Deliverables

| Deliverable | File |
|---|---|
| Inbound skill in manifest | `examples/devtools/devtools.interface.yaml` |
| Agent annotation in manifest | `examples/devtools/devtools.interface.yaml` |
| Add to claude-agents include list | same |
| Regenerate | all targets |
