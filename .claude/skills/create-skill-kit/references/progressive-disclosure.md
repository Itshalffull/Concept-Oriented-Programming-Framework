# Progressive Disclosure

How to structure a skill so Claude loads only what it needs, when it needs it. This keeps the context window lean while providing deep knowledge on demand.

## The Three-Level Loading Model

Claude Code loads skill content in three levels:

| Level | What | When Loaded | Context Cost |
|-------|------|-------------|-------------|
| **Level 1: Metadata** | `name` + `description` from frontmatter | Always (at startup) | ~30 tokens per skill |
| **Level 2: SKILL.md body** | The markdown content of SKILL.md | When skill is invoked | Full body token count |
| **Level 3: Reference files** | Files in `references/`, `examples/`, `templates/` | When Claude reads them during a step | Full file token count |

**Key insight**: Level 1 is always in context (it's how Claude decides to invoke the skill). Level 2 loads only on invocation. Level 3 loads only when a step explicitly tells Claude to read a file.

## Why Progressive Disclosure Matters

A skill that puts everything in SKILL.md has two problems:

1. **Context bloat**: The entire skill body loads on invocation, consuming tokens that could be used for conversation, code, and tool outputs
2. **Attention dilution**: When Claude sees too much information at once, it may miss critical details or conflate unrelated sections

Progressive disclosure solves both: SKILL.md stays small (the "table of contents"), and reference files provide depth exactly when needed.

## Structuring for Progressive Disclosure

### Rule 1: SKILL.md is the Roadmap

SKILL.md should tell Claude:
- **What** to do (the overall process)
- **When** to go deeper (which step needs which reference)
- **How** to verify (validation commands)

It should NOT contain:
- Complete API references (→ references/)
- Full worked examples (→ examples/)
- Copy-paste templates (→ templates/)
- Long code blocks (→ reference files or scripts/)

### Rule 2: One Topic Per Reference File

Each reference file should cover exactly one area. If a reference file covers two unrelated topics, split it.

**Good**:
```
references/
├── type-system.md         # Just COPF's type system
├── generator-pattern.md   # Just the generator interface
├── cli-integration.md     # Just CLI wiring
└── concept-manifest.md    # Just the IR format
```

**Bad**:
```
references/
├── everything.md          # Types + generators + CLI + IR
└── misc.md                # Random details
```

### Rule 3: Link From Steps, Not From Each Other

Reference files should be **leaf nodes** — linked from SKILL.md but not linking to other reference files. This avoids multi-hop loading chains.

```
SKILL.md ──→ references/a.md     ✓ Good: one hop
SKILL.md ──→ references/b.md     ✓ Good: one hop

references/a.md ──→ references/c.md   ✗ Bad: two hops from SKILL.md
```

If reference A needs information from reference B, either:
- Inline the shared information in both (acceptable duplication)
- Restructure so SKILL.md tells Claude to read both at the same step

### Rule 4: Examples Are Self-Contained

An example file should be understandable on its own — someone reading just the example should be able to follow the entire walkthrough without needing to read reference files first.

Include in examples:
- The starting state / input
- Every decision point and the reasoning
- The final output
- What makes this example interesting or instructive

### Rule 5: Templates Are Ready to Use

A template file should be immediately usable with minimal modification. Mark customization points with `TODO` or placeholder tokens:

```
concept TODO_NAME [TODO_PARAM] {
  purpose {
    TODO: Describe what this concept is FOR.
  }
  ...
}
```

## The Disclosure Decision Tree

For each piece of information in your skill, ask:

```
Is this needed on EVERY invocation?
├── YES → Put in SKILL.md (inline)
└── NO
    ├── Is it reference material for a specific step?
    │   └── YES → Put in references/<topic>.md
    ├── Is it a worked walkthrough?
    │   └── YES → Put in examples/<case>.md
    ├── Is it scaffolding output?
    │   └── YES → Put in templates/<name>.md
    └── Is it an executable script?
        └── YES → Put in scripts/<name>.sh|ts|py
```

## Sizing Guidelines

| Component | Lines | Words | Tokens (approx) |
|-----------|-------|-------|-----------------|
| SKILL.md body | < 500 | < 1,000 | < 1,500 |
| Description (frontmatter) | 1-3 | < 150 | < 200 |
| Reference file | < 500 | Unlimited | Loaded on demand |
| Example file | < 300 | Unlimited | Loaded on demand |
| Template file | < 200 | Unlimited | Loaded on demand |

**Total reference file count**: No hard limit, but 3-8 files is typical. More than 10 suggests the skill might be doing too much — consider splitting into multiple skills.

## How Claude Uses Progressive Disclosure

When a skill is invoked, here's what happens:

1. Claude loads the full SKILL.md body
2. Claude reads the steps and starts executing
3. When a step says "Read [references/topic.md](references/topic.md)", Claude uses the Read tool to load that file
4. Claude processes the reference content in the context of the current step
5. Claude continues to the next step

The reference file content stays in context for the remainder of the conversation, so ordering matters — load foundational references in early steps, specialized ones in later steps.

## Pattern: Conditional Disclosure

Some steps only need references under certain conditions:

```markdown
### Step 5: Handle Special Cases

If the concept requires cryptographic operations:
- Read [references/crypto-capabilities.md](references/crypto-capabilities.md)

If the concept manages user sessions:
- Read [references/session-patterns.md](references/session-patterns.md)

Otherwise, skip to Step 6.
```

This way Claude only loads what's relevant to the specific invocation.

## Pattern: Progressive Example Loading

Start simple, go complex:

```markdown
### Step 3: Study Examples

Start with the simple case:
- Read [examples/simple-case.md](examples/simple-case.md)

For more complex patterns:
- Read [examples/complex-case.md](examples/complex-case.md)
```

Claude may skip the complex case if the simple one is sufficient for the current task.

## Validation Checklist

After structuring your skill:

- [ ] SKILL.md is under 500 lines
- [ ] Every reference file is linked from at least one step
- [ ] No reference file links to another reference file
- [ ] Every example is self-contained
- [ ] Every template has TODO markers
- [ ] Steps are ordered so foundational references load before specialized ones
- [ ] No information is duplicated between SKILL.md and reference files
- [ ] Scripts are executable, not loaded into context
