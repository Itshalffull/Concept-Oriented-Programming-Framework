---
name: create-skill-kit
description: Create a new Claude Code skill kit with progressive disclosure structure, proper frontmatter, reference files, examples, and templates. Use when building a new skill from scratch or converting existing knowledge into a reusable skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<skill-name> [--scope personal|project] [--description \"...\"]"
---

# Create a New Claude Code Skill Kit

Build a complete skill kit for **$ARGUMENTS** using progressive disclosure and the patterns established in this project.

## What is a Skill Kit?

A skill kit is a directory containing a `SKILL.md` entry point plus supporting reference files, examples, and templates. Claude loads only the `SKILL.md` initially — deeper files are loaded on-demand as the skill's steps reference them, keeping context lean.

```
.claude/skills/<skill-name>/
├── SKILL.md                    # Entry point — always loaded when skill invoked
├── references/                 # Deep docs — loaded per-step
│   ├── topic-a.md
│   └── topic-b.md
├── examples/                   # Worked examples — loaded when needed
│   ├── simple-case.md
│   └── complex-case.md
└── templates/                  # Scaffolds — loaded when generating output
    └── starter.md
```

## Step-by-Step Process

### Step 1: Define the Skill's Purpose and Trigger

Before writing anything, answer these questions:

1. **What does this skill do?** (one sentence, third-person, verb-first)
2. **When should it trigger?** (what keywords or phrases should activate it)
3. **What arguments does it take?** (what does `$ARGUMENTS` represent)
4. **Who invokes it?** (user via `/skill-name`, Claude automatically, or both)

Read [references/skill-anatomy.md](references/skill-anatomy.md) for the complete frontmatter specification and all supported fields.

### Step 2: Plan the Progressive Disclosure Structure

Map out what information the skill needs at each stage. The goal: SKILL.md stays under 500 lines, and reference files are only loaded when a specific step needs them.

Read [references/progressive-disclosure.md](references/progressive-disclosure.md) for the three-level loading model and structuring patterns.

**Planning template:**

| Step | What Claude needs to know | Source |
|------|--------------------------|--------|
| 1 | Overview of the task | SKILL.md (inline) |
| 2 | Deep technical details for X | references/x.md |
| 3 | Pattern examples for Y | examples/y.md |
| ... | ... | ... |

**Rules of thumb:**
- If information is needed on every invocation → inline in SKILL.md
- If information is needed only during a specific step → reference file
- If information is a reusable template → templates/ directory
- If information is a worked walkthrough → examples/ directory

### Step 3: Write the Frontmatter

Read [references/skill-anatomy.md](references/skill-anatomy.md) for the full field reference, then write the YAML frontmatter:

```yaml
---
name: <skill-name>
description: <what it does AND when to use it, third-person, max 1024 chars>
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<what-user-provides>"
---
```

**Critical**: The `description` field is what Claude uses to decide whether to invoke the skill. Include:
- What the skill does (verb phrase)
- When to use it (trigger context)
- Key domain terms users would naturally say

**Additional frontmatter fields** (use only when needed):

| Field | When to use |
|-------|------------|
| `disable-model-invocation: true` | Skill has side effects (deploy, send message) — only manual `/invoke` |
| `user-invocable: false` | Background knowledge Claude should auto-use but users shouldn't invoke directly |
| `context: fork` | Skill should run in an isolated subagent (heavy research, no edit needed) |
| `agent: Explore` | Which subagent type when using `context: fork` |
| `model: claude-opus-4-6` | Force a specific model for this skill |

### Step 4: Write the SKILL.md Body

Read [references/reference-authoring.md](references/reference-authoring.md) for writing guidelines.

The body follows this structure:

```markdown
# Skill Title

Brief description of what this skill does with **$ARGUMENTS**.

## Overview (2-5 paragraphs)

Context the reader always needs. Architecture diagrams, key concepts,
the "big picture" that orients every invocation.

## Step-by-Step Process

### Step 1: First thing to do

Inline instructions for this step.

Read [references/detail.md](references/detail.md) for deeper information.

### Step 2: Next thing

...

### Step N: Final verification

How to validate the result. Include `npx tsx` or shell commands
for verification when applicable.

## Quick Reference (optional)

Tables, checklists, or summaries for at-a-glance use.
```

**SKILL.md constraints:**
- Under 500 lines (Anthropic's official limit for optimal performance)
- Under 1000 words is ideal
- 3-5 sections recommended
- 1-2 code blocks maximum in the body — put detailed code in reference files
- Every reference file must be linked from at least one step

### Step 5: Write Reference Files

For each reference file planned in Step 2:

1. Create it under `references/<topic>.md`
2. Start with a `# Title` that matches how SKILL.md refers to it
3. Include all the deep detail that would bloat SKILL.md
4. Keep each reference focused on one topic
5. Include tables, code examples, and checklists liberally — these files are loaded on-demand so size matters less

Read [references/reference-authoring.md](references/reference-authoring.md) for content guidelines and quality patterns.

### Step 6: Write Examples

For each example planned:

1. Create it under `examples/<case-name>.md`
2. Show a complete worked scenario from start to finish
3. Include the reasoning behind decisions, not just the steps
4. Show both input and output so Claude can pattern-match

### Step 7: Write Templates (If Applicable)

If the skill produces scaffolded output (code files, config, etc.):

1. Create templates under `templates/<name>.md`
2. Use `TODO` markers where the user must fill in values
3. Include inline comments explaining each section

### Step 8: Validate the Skill

#### Check structure manually:

```bash
# Verify the skill directory exists and has the right structure
ls -la .claude/skills/<skill-name>/
ls -la .claude/skills/<skill-name>/references/
ls -la .claude/skills/<skill-name>/examples/

# Verify SKILL.md line count (should be under 500)
wc -l .claude/skills/<skill-name>/SKILL.md
```

#### Validate with claude-skills-cli (optional but recommended):

```bash
# Install and validate
pnpx claude-skills-cli validate .claude/skills/<skill-name>

# Lenient mode (allows up to 150 lines)
pnpx claude-skills-cli validate .claude/skills/<skill-name> --lenient

# Loose mode (allows up to 500 lines — Anthropic's official limit)
pnpx claude-skills-cli validate .claude/skills/<skill-name> --loose

# Strict mode (fails on warnings)
pnpx claude-skills-cli validate .claude/skills/<skill-name> --strict

# JSON output for programmatic use
pnpx claude-skills-cli validate .claude/skills/<skill-name> --format json
```

#### Auto-fix common issues:

```bash
# Doctor command fixes multi-line descriptions, adds prettier-ignore markers
pnpx claude-skills-cli doctor .claude/skills/<skill-name>
```

### Step 9: Test the Skill

1. **Direct invocation**: Run `/<skill-name> <test-args>` in Claude Code and verify it loads correctly
2. **Check context**: Run `/context` to verify the skill appears and isn't excluded by character budget
3. **Auto-trigger test**: Describe a task that should match the skill's description and verify Claude invokes it
4. **Verify reference loading**: Walk through each step and confirm Claude reads the referenced files when it reaches that step

### Step 10: Review with CLI Tools

```bash
# List all skills with validation status and quality ratings
pnpx claude-skills-cli stats

# Package for sharing (validates first)
pnpx claude-skills-cli package .claude/skills/<skill-name>

# Add activation hooks for higher reliability (84% with forced-eval)
pnpx claude-skills-cli add-hook --type forced-eval --project
```

## Skill Placement

| Scope | Path | Use When |
|-------|------|----------|
| Project | `.claude/skills/<name>/SKILL.md` | Skill is specific to this repo |
| Personal | `~/.claude/skills/<name>/SKILL.md` | Skill works across all your projects |

Project skills take precedence when names conflict with personal skills.

## Quality Checklist

Before committing:

- [ ] Frontmatter has `name`, `description`, `allowed-tools`, `argument-hint`
- [ ] Description is third-person, includes trigger keywords, under 1024 chars
- [ ] SKILL.md is under 500 lines
- [ ] Every reference file is linked from at least one step in SKILL.md
- [ ] No orphaned files (every file in the directory is referenced)
- [ ] No broken links (every linked file exists)
- [ ] Steps are ordered — each step builds on the previous
- [ ] Verification step exists (Step 8-10 or equivalent)
- [ ] `$ARGUMENTS` is used where user input should be interpolated
- [ ] No deep reference chains (SKILL.md → file.md → another-file.md)

## Examples

See [examples/existing-skills-walkthrough.md](examples/existing-skills-walkthrough.md) for a detailed walkthrough of how the existing skills in this project were designed, showing the progressive disclosure pattern in practice.

See [templates/skill-scaffold.md](templates/skill-scaffold.md) for a copy-paste starting template.
