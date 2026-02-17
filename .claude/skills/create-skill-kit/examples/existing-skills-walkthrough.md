# Worked Example: Skills in This Project

A walkthrough of how the three existing COPF skills were designed, showing progressive disclosure patterns in practice.

## The Three Skills

| Skill | Purpose | Files | SKILL.md Lines |
|-------|---------|-------|---------------|
| `add-language-target` | Add a new code generator (e.g., Swift, Go) | 8 files | ~188 |
| `create-concept` | Design a new concept following Jackson's methodology | 9 files | ~275 |
| `decompose-feature` | Break an app into concepts + syncs | 6 files | ~233 |

## Skill 1: add-language-target

### Design Decisions

**Problem**: Adding a new language target requires knowledge of the ConceptManifest IR, the ResolvedType tree, the generator interface pattern, and CLI wiring. That's a lot of context — too much for a single file.

**Solution**: Progressive disclosure in 9 steps. Steps 1-3 load references on-demand. Steps 4-9 are actionable.

### Directory Structure

```
add-language-target/
├── SKILL.md                          # 9-step process, type mapping table template
├── references/
│   ├── type-system.md               # ResolvedType tree, primitive mappings for 6 languages
│   ├── generator-pattern.md         # ConceptHandler interface, 4-file output structure
│   ├── concept-manifest.md          # Full IR docs with Password example JSON
│   └── cli-integration.md           # Three changes needed to wire into generate.ts
├── examples/
│   ├── typescript-target.md         # Complete TS generator walkthrough
│   └── rust-target.md               # Complete Rust generator walkthrough
└── templates/
    └── generator-scaffold.md        # Copy-paste template with TODOs
```

### Progressive Disclosure in Action

| Step | What's inline | What's referenced |
|------|--------------|-------------------|
| Step 1: Type System | Type mapping table template (empty) | `references/type-system.md` — full ResolvedType tree |
| Step 2: ConceptManifest | Just "read this file" | `references/concept-manifest.md` — full IR shape |
| Step 3: Generator Pattern | Just "read this file" | `references/generator-pattern.md` + both examples |
| Step 4: Concept Spec | Full `.concept` file template (inline) | — |
| Step 5: Implementation | High-level description (7 substeps) | `templates/generator-scaffold.md` |
| Step 6: CLI Wiring | Just "read this file" | `references/cli-integration.md` |
| Step 7-9: Verify/Test/Generate | `npx tsx` commands (inline) | — |

**Key insight**: Steps 7-9 contain executable commands directly in SKILL.md because they're short and needed on every invocation. The deep reference material is externalized because it's only needed when Claude is at that specific step.

### Frontmatter

```yaml
---
name: add-language-target
description: Add a new language target (code generator) to the Concept-Oriented Programming Framework. Use when adding support for generating code in a new programming language (e.g., Swift, Go, Python, Kotlin, C#) from concept specifications.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<language-name>"
---
```

**Description strategy**: Lists concrete language examples (Swift, Go, Python, Kotlin, C#) as trigger keywords. A user saying "add Swift support" will match on "Swift" and "new programming language."

## Skill 2: create-concept

### Design Decisions

**Problem**: Creating a concept requires understanding Daniel Jackson's methodology (singularity, independence, sufficiency), the `.concept` grammar, state design patterns, action design patterns, invariant patterns, and anti-patterns. Each of these is a deep topic.

**Solution**: 11-step process with 7 reference files covering each topic independently.

### Directory Structure

```
create-concept/
├── SKILL.md                          # 11-step process with inline checklists
├── references/
│   ├── jackson-methodology.md       # Jackson's 5 components, 3 criteria, design moves
│   ├── concept-grammar.md           # Complete .concept file grammar
│   ├── state-design.md              # 3 state patterns, sizing guidelines
│   ├── action-design.md             # Naming, variants, coverage rules
│   ├── invariant-design.md          # 7 invariant patterns
│   └── anti-patterns.md            # 9 anti-patterns with fixes
└── examples/
    ├── domain-concepts.md           # Password, Follow, User, Article, Favorite
    └── framework-concepts.md        # SchemaGen, Registry, SyncEngine
```

### What's Inline vs. Referenced

The SKILL.md contains:
- The 3 core principles (always needed — 5 lines each)
- Purpose wording patterns table (quick reference)
- Type parameter letter conventions (quick reference)
- State/action checklists (always needed)
- The `.concept` file template (always needed)
- `npx tsx` validation commands (always needed)

Everything else (grammar details, design patterns, worked examples) is in reference files.

**Key insight**: This skill has the highest reference file count (7) because concept design has many independent subtopics. Each reference is loaded only when its step is reached, so a simple concept creation might only load 2-3 of the 7 files.

### Argument Handling

```yaml
argument-hint: "<concept-name> [--domain app|framework]"
```

`$ARGUMENTS` is used in the title: "Design and implement a new concept named **$ARGUMENTS**" — which means `/create-concept Password` produces a skill focused on building a Password concept.

## Skill 3: decompose-feature

### Design Decisions

**Problem**: Decomposing a feature into concepts requires understanding Jackson's decomposition methodology, the sync language, reusable concept patterns, and how they all fit together. The sync design reference alone is substantial.

**Solution**: 9-step process with 3 references + 2 examples. The sync design reference is the deepest file because sync rules are the most complex part.

### Directory Structure

```
decompose-feature/
├── SKILL.md                              # 9-step process with concept map template
├── references/
│   ├── decomposition-method.md          # Jackson's decomposition approach
│   ├── sync-design.md                   # Complete .sync syntax, 8 patterns
│   └── concept-catalog.md              # 18 reusable concept patterns
└── examples/
    ├── social-blogging-platform.md      # Full decomposition of 9 concepts + 7 sync files
    └── sync-patterns.md                 # 7 copy-paste sync templates
```

### Unique Pattern: Scaffolding Scripts

This skill includes inline `npx tsx` scripts that scaffold `.concept` and `.sync` files. These are in SKILL.md (not reference files) because they're the primary output of the skill — every invocation needs them:

```javascript
// Scaffold concept files
const concepts = [
  { name: 'ConceptName', param: 'T', ... }
];
for (const c of concepts) {
  writeFileSync('specs/app/' + c.file + '.concept', content);
}
```

**Key insight**: The scaffolding scripts bridge this skill to the `create-concept` skill. Step 9 explicitly says "use the `create-concept` skill to flesh out each one" — creating a skill pipeline.

### Skill Pipeline Pattern

```
decompose-feature → scaffolded .concept + .sync files → create-concept → fleshed-out concepts
```

This is the most important design pattern: skills can reference other skills by name, creating composable workflows without coupling the skills' implementations.

## Common Patterns Across All Three Skills

### 1. Inline Verification Commands

Every skill ends with `npx tsx` commands for validation. These are always inline because they're needed on every invocation:

```bash
# Parse check
npx tsx tools/copf-cli/src/index.ts check

# Full pipeline verification
npx tsx -e "import { ... }; const result = await ..."
```

### 2. Checklists at Decision Points

Every step that requires judgment includes a checklist:

```markdown
**Checklist:**
- [ ] Can you state the purpose in one sentence?
- [ ] Does it describe a *why*, not just a *what*?
```

### 3. Quick Reference Tables

Every skill ends with a summary table for at-a-glance reference:

```markdown
| Category | Examples | State Pattern | Typical Actions |
|----------|---------|---------------|-----------------|
| Identity | User | Entity (set + relations) | register |
```

### 4. Concrete Over Abstract

Every pattern is illustrated with real examples from the codebase, not hypothetical ones. This anchors Claude's pattern-matching to the actual project.

## File Count Guidelines

Based on these three skills:

| Skill Complexity | Reference Files | Example Files | Template Files | Total |
|-----------------|----------------|---------------|----------------|-------|
| Simple (3-5 steps) | 1-2 | 1 | 0-1 | 3-4 |
| Medium (6-8 steps) | 3-4 | 1-2 | 0-1 | 5-8 |
| Complex (9+ steps) | 5-7 | 2-3 | 0-1 | 8-11 |
