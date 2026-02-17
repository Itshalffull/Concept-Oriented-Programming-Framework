# Reference File Authoring Guide

How to write high-quality reference files, examples, and templates for Claude Code skills.

## Writing Principles

### 1. Assume Claude is Smart

Don't explain basic programming concepts. Don't tell Claude what a function is or how imports work. Focus on **domain-specific knowledge** that Claude wouldn't have without this skill.

**Bad**: "A TypeScript interface defines a contract that classes must implement..."
**Good**: "The `ConceptHandler` interface requires one method per action, where each method signature matches the action's schema."

### 2. Be Specific Over General

Every statement should be verifiable against the codebase. Prefer concrete examples over abstract descriptions.

**Bad**: "Generators produce output files."
**Good**: "Each generator produces 4 files per concept: `{name}.types.{ext}`, `{name}.handler.{ext}`, `{name}.adapter.{ext}`, `{name}.conformance.test.{ext}`."

### 3. Tables Over Prose for Mappings

When documenting correspondences (type mappings, naming conventions, option values), always use tables:

```markdown
| COPF Type | TypeScript | Rust | Go |
|-----------|-----------|------|-----|
| String | string | String | string |
| Int | number | i64 | int64 |
| Bool | boolean | bool | bool |
```

### 4. Code Blocks for Patterns, Not Narratives

Show the pattern with code, then explain variations. Don't describe code in prose when you can show it.

**Bad**: "The sync rule starts with a 'sync' keyword followed by the name and an annotation in brackets, then a 'when' block containing concept/action patterns..."

**Good**:
```
sync RuleName [eager]
when {
  Concept/action: [ field: ?var ] => [ field: ?var ]
}
then {
  Concept/action: [ field: ?var ]
}
```

### 5. Checklists for Validation

End sections with actionable checklists when the reader needs to verify their work:

```markdown
**Checklist:**
- [ ] Type parameter is used in at least one state relation
- [ ] Every state field is read by at least one action
- [ ] Every action has at least an `ok` variant
```

## Reference File Structure

Every reference file should follow this structure:

```markdown
# Title

One paragraph explaining what this file covers and when to read it.

## Section 1: Core Concept

Explanation with code examples and tables.

## Section 2: Patterns

Enumerate the common patterns with examples.

## Section 3: Edge Cases / Gotchas

What can go wrong and how to handle it.

## Quick Reference (optional)

Summary table for at-a-glance use.
```

## Example File Structure

Every example file should follow this structure:

```markdown
# Worked Example: <Name>

Brief description of what this example demonstrates.

## Starting Point

What the input looks like (feature description, requirements, etc.)

## Step 1: <First Decision>

What was decided and WHY. Show the input and output of this step.

## Step 2: <Next Decision>

...

## Final Result

The complete output with all decisions applied.

## Design Decisions Explained

Why certain choices were made — this is the most valuable section.
Explain trade-offs, alternatives considered, and rationale.
```

**Key**: The "Design Decisions Explained" section is what separates a useful example from a mere transcript. Claude uses this reasoning to make analogous decisions on new inputs.

## Template File Structure

Every template file should follow this structure:

```markdown
# Template: <Name>

Copy this template and replace all `TODO` markers.

## Prerequisites

What must be true before using this template.

## Template

\`\`\`
<the actual template content with TODO markers>
\`\`\`

## Customization Guide

| TODO Marker | Replace With | Example |
|-------------|-------------|---------|
| `TODO_NAME` | Concept name in PascalCase | `Article` |
| `TODO_PARAM` | Single uppercase letter | `A` |
| ... | ... | ... |

## After Customization

What to do after filling in the template (validation steps, next actions).
```

## Content Quality Guidelines

### Depth vs. Breadth

Reference files should go **deep** on their topic, not broad across topics. A 200-line file about one topic is better than a 200-line file covering five topics shallowly.

### Token Efficiency

Every token in a reference file competes with the user's conversation for context space. Remove:
- Motivational language ("This is really important because...")
- Redundant explanations (if it's in SKILL.md, don't repeat it here)
- Generic programming advice (Claude already knows)
- Excessive commentary in code blocks (a few key comments are fine)

### Naming

| Component | Convention | Example |
|-----------|-----------|---------|
| Reference file | kebab-case, topic-focused | `type-system.md`, `sync-design.md` |
| Example file | kebab-case, descriptive | `social-blogging-platform.md` |
| Template file | kebab-case, output-type | `generator-scaffold.md`, `concept-skeleton.md` |
| Script file | kebab-case, verb-first | `validate-skill.sh`, `scaffold-concept.ts` |

### Cross-Referencing

Within a reference file, you may reference other files in the same skill — but only to tell the user where to find related info, never as a prerequisite:

```markdown
**Related**: See [examples/simple-case.md](../examples/simple-case.md) for a worked example of this pattern.
```

Never write: "Before reading this file, read [references/other.md](other.md) first."

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Wall of text | Claude loses important details in prose | Break into sections, use tables and code blocks |
| Explaining the obvious | Wastes tokens on things Claude knows | Focus on domain-specific knowledge |
| Referencing external URLs | URLs may break or change | Inline the relevant information |
| Inconsistent terminology | Claude gets confused by synonyms | Pick one term and use it everywhere |
| Deep nesting | Reference chains waste tool calls | Keep references one hop from SKILL.md |
| Missing examples | Claude has to guess the pattern | Always include at least one concrete example per section |
| Time-sensitive info | "As of 2024..." becomes stale | State facts without dates; update when they change |
