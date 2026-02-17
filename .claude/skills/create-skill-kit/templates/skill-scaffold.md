# Template: Skill Kit Scaffold

Copy this template to create a new skill. Replace all `TODO` markers with actual content.

## Prerequisites

- Know the skill's purpose (one sentence)
- Know what arguments it takes
- Know the step-by-step process

## SKILL.md Template

```yaml
---
name: TODO-skill-name
description: TODO-what-it-does-third-person. Use when TODO-trigger-condition.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "TODO-argument-format"
---

# TODO Skill Title

TODO-brief-description of what this skill does with **$ARGUMENTS**.

## Overview

TODO: 2-5 paragraphs of context that every invocation needs. Include:
- What this skill operates on
- The high-level architecture or pipeline
- Key terminology

## Step-by-Step Process

### Step 1: TODO-first-step-name

TODO: Inline instructions for the first step.

Read [references/TODO-topic.md](references/TODO-topic.md) for TODO-what-this-reference-covers.

### Step 2: TODO-second-step-name

TODO: Instructions for the second step.

### Step 3: TODO-third-step-name

TODO: Instructions for the third step.

See [examples/TODO-example.md](examples/TODO-example.md) for a complete worked example.

### Step N: Validate

TODO: Verification commands.

```bash
# TODO: Validation command
```

## Quick Reference

| TODO-Column | TODO-Column |
|-------------|-------------|
| TODO | TODO |

## Checklist

Before finishing:

- [ ] TODO-validation-item-1
- [ ] TODO-validation-item-2
- [ ] TODO-validation-item-3
```

## Reference File Template

```markdown
# TODO Reference Title

TODO: One paragraph explaining what this file covers.

## TODO Section 1

TODO: Core content with code examples and tables.

## TODO Section 2

TODO: Patterns and their variations.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| TODO | TODO |
```

## Example File Template

```markdown
# Worked Example: TODO-Name

TODO: What this example demonstrates.

## Starting Point

TODO: Input / requirements / feature description.

## Step 1: TODO

TODO: What was decided and why.

## Final Result

TODO: Complete output.

## Design Decisions Explained

TODO: Why these choices were made.
```

## Customization Guide

| TODO Marker | Replace With | Example |
|-------------|-------------|---------|
| `TODO-skill-name` | kebab-case skill name | `add-language-target` |
| `TODO-what-it-does-third-person` | Third-person verb phrase describing what the skill does | `Generates TypeScript types from JSON schemas` |
| `TODO-trigger-condition` | When a user would need this | `converting API responses to typed interfaces` |
| `TODO-argument-format` | Argument hint in angle/square brackets | `<schema-file> [--output-dir path]` |
| `TODO Skill Title` | Human-readable title | `Generate TypeScript from JSON Schema` |
| `TODO-topic` | Reference file topic in kebab-case | `type-mapping` |
| `TODO-example` | Example file name in kebab-case | `simple-schema` |

## After Customization

1. Create the directory: `mkdir -p .claude/skills/<skill-name>/references .claude/skills/<skill-name>/examples`
2. Write SKILL.md with the filled template
3. Write each reference file linked from SKILL.md
4. Write each example file linked from SKILL.md
5. Validate: `wc -l .claude/skills/<skill-name>/SKILL.md` (should be under 500)
6. Validate: `pnpx claude-skills-cli validate .claude/skills/<skill-name> --loose`
7. Test: invoke with `/<skill-name> <test-args>` in Claude Code
