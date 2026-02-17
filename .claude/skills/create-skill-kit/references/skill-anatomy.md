# Skill Anatomy

Complete reference for the structure and frontmatter of a Claude Code skill.

## File Structure

A skill is a directory containing a required `SKILL.md` and optional supporting files:

```
.claude/skills/<skill-name>/
├── SKILL.md              # REQUIRED — entry point with YAML frontmatter + markdown body
├── references/           # Optional — deep documentation loaded on-demand
│   └── *.md
├── examples/             # Optional — worked examples
│   └── *.md
├── templates/            # Optional — scaffolds and copy-paste starters
│   └── *.md
└── scripts/              # Optional — executable scripts (not loaded into context)
    └── *.sh / *.ts / *.py
```

## SKILL.md Format

The file has two parts: YAML frontmatter (between `---` markers) and a markdown body.

```yaml
---
name: my-skill
description: Processes X and generates Y. Use when building Z or converting W.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<required-arg> [--optional-flag]"
---

# Skill Title

Markdown body with instructions...
```

## Frontmatter Fields — Complete Reference

### `name` (optional, inferred from directory name)

The slash command name users type to invoke the skill.

| Constraint | Value |
|-----------|-------|
| Max length | 64 characters |
| Allowed characters | Lowercase letters, numbers, hyphens |
| Forbidden | XML tags, reserved words ("anthropic", "claude") |
| Default | Directory name |
| Examples | `add-language-target`, `create-concept`, `deploy-staging` |

```yaml
name: create-concept
```

### `description` (strongly recommended)

What the skill does AND when to use it. This is the **most critical field** — Claude uses it to decide whether to auto-invoke the skill.

| Constraint | Value |
|-----------|-------|
| Max length | 1024 characters |
| Optimal length | Under 200 characters (~30 tokens) |
| Perspective | Third-person only |
| Forbidden | XML tags, first/second person ("I can...", "You can...") |
| Default | First paragraph of markdown body |

**Writing good descriptions:**

```yaml
# GOOD — third-person, specific, includes trigger keywords
description: Design and create a new concept for the Concept-Oriented Programming Framework following Daniel Jackson's concept design methodology. Ensures proper scoping, independence, state sufficiency, and operational principles.

# GOOD — action-oriented with when-to-use clause
description: Add a new language target (code generator) to the COPF. Use when adding support for generating code in a new programming language (e.g., Swift, Go, Python, Kotlin, C#) from concept specifications.

# BAD — first person
description: I help you create concepts for COPF.

# BAD — too vague
description: Helps with code generation.

# BAD — no trigger keywords
description: A useful development tool.
```

**Trigger keyword strategy**: Include the nouns and verbs a user would naturally say when they need this skill:
- "create a concept" → include "create" and "concept"
- "add Swift support" → include "add", "language", "Swift"
- "break down this feature" → include "decompose", "break down", "feature"

### `allowed-tools` (optional)

Comma-separated list of tools Claude can use without permission prompts during skill execution.

```yaml
# Full editing access
allowed-tools: Read, Grep, Glob, Edit, Write, Bash

# Read-only research
allowed-tools: Read, Grep, Glob

# With web access
allowed-tools: Read, Grep, Glob, WebFetch, WebSearch
```

Available tools: `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`, `WebFetch`, `WebSearch`, `Task`, `NotebookEdit`

### `argument-hint` (optional)

Shows in the autocomplete menu to hint what arguments the skill expects.

```yaml
argument-hint: "<language-name>"
argument-hint: "<concept-name> [--domain app|framework]"
argument-hint: "<feature or app description>"
argument-hint: "[filename] [--format json|yaml]"
```

Convention: `<required>` for required args, `[optional]` for optional, `a|b` for choices.

### `disable-model-invocation` (optional, default: `false`)

When `true`, only users can invoke this skill (via `/skill-name`). Claude will never auto-invoke it.

```yaml
# Use for skills with side effects
disable-model-invocation: true
```

**When to use**: Deploy scripts, message senders, destructive operations, anything where accidental invocation would be harmful.

### `user-invocable` (optional, default: `true`)

When `false`, the skill doesn't appear in the `/` menu. Claude can still auto-invoke it based on the description.

```yaml
# Use for background knowledge
user-invocable: false
```

**When to use**: Coding standards, project conventions, implicit knowledge that Claude should use but users shouldn't need to manually trigger.

### `context` (optional)

Set to `fork` to run the skill in an isolated subagent context.

```yaml
context: fork
```

When forked:
- Skill content becomes the subagent's prompt
- Separate context window (doesn't consume main conversation context)
- Results are summarized and returned
- **Cannot** access conversation history
- Best for: heavy research, large codebase exploration, tasks that generate lots of output

### `agent` (optional)

Which subagent type to use when `context: fork`.

```yaml
agent: Explore    # Fast codebase exploration
agent: Plan       # Architecture planning
agent: general-purpose  # Default, full capabilities
```

### `model` (optional)

Override the model used when this skill is active.

```yaml
model: claude-opus-4-6
model: claude-sonnet-4-5-20250929
model: claude-haiku-4-5-20251001
```

### `hooks` (optional)

Hooks scoped to this skill's lifecycle:

```yaml
hooks:
  Start:
    - type: command
      command: ./scripts/setup.sh
```

## String Substitution Variables

Use these in the markdown body to interpolate dynamic values:

| Variable | Description | Example |
|----------|-------------|---------|
| `$ARGUMENTS` | All arguments passed to the skill | `/my-skill foo bar` → `$ARGUMENTS` = `foo bar` |
| `$ARGUMENTS[0]` | First argument | `/my-skill foo bar` → `$ARGUMENTS[0]` = `foo` |
| `$ARGUMENTS[1]` | Second argument | `/my-skill foo bar` → `$ARGUMENTS[1]` = `bar` |
| `$0`, `$1`, `$2` | Shorthand for `$ARGUMENTS[N]` | Same as above |
| `${CLAUDE_SESSION_ID}` | Current session ID | For logging/correlation |

If `$ARGUMENTS` is not referenced in the body, Claude Code appends `ARGUMENTS: <value>` to the skill content automatically.

## Dynamic Context Injection

Use `` !`command` `` syntax to run shell commands **before** the skill content is sent to Claude:

```markdown
## Current state
- Git branch: !`git branch --show-current`
- Uncommitted changes: !`git status --short`
- Recent commits: !`git log --oneline -5`
```

The commands execute during skill loading (preprocessing), not during Claude's execution. Output replaces the `` !`command` `` in the skill content.

## Skill Discovery and Priority

Skills are discovered from multiple locations with a priority order:

| Priority | Location | Path |
|----------|----------|------|
| 1 (highest) | Enterprise | Managed settings |
| 2 | Personal | `~/.claude/skills/<name>/SKILL.md` |
| 3 | Project | `.claude/skills/<name>/SKILL.md` |
| 4 | Plugin | `<plugin>/skills/<name>/SKILL.md` |

When names conflict, higher-priority locations win. Plugin skills use namespaced names (`plugin-name:skill-name`).

**Context budget**: Skill descriptions (metadata) consume up to 2% of the context window (16,000 character fallback). If you have many skills, some descriptions may be truncated. Override with:

```bash
export SLASH_COMMAND_TOOL_CHAR_BUDGET=32000
```

Check for exclusion warnings with `/context` in Claude Code.

## Permission Control

Control skill access through permission settings:

```
# Deny all skills
Skill

# Allow specific skill
Skill(commit)

# Allow with wildcard arguments
Skill(deploy *)

# Deny specific skill
Skill(dangerous-operation *)
```

## Backward Compatibility

Files in `.claude/commands/<name>.md` still work as skills. If both a command and a skill share the same name, the skill takes precedence. Migrating: move the file to `.claude/skills/<name>/SKILL.md` and add frontmatter.
