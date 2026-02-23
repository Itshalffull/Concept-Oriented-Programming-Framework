---
name: project-scaffold
description: Initialize new COPF projects with the standard directory 
 structure , example concept specs , and configuration files
argument-hint: $ARGUMENTS
allowed-tools: Read, Write, Bash
---

# ProjectScaffold

Scaffold a new COPF project named **$ARGUMENTS** with the standard directory layout, example concept, and configuration files.


> **When to use:** Use when starting a new COPF project from scratch. Creates the standard directory structure, example concept spec, and configuration files.


## Design Principles

- **Minimal Viable Structure:** Scaffold the minimum needed to run `copf check` and `copf generate` — don't overload with unused templates.
- **Convention Over Configuration:** Project follows standard directory layout (specs/, syncs/, implementations/) so tools work without configuration.

## Step-by-Step Process

### Step 1: Scaffold New Project

Create a new COPF project directory with specs , syncs , 
 implementations , and configuration files Generates an 
 example concept and sync to get started

**Arguments:** `$0` **name** (string)

**Checklist:**
- [ ] Project name is valid (kebab-case, no conflicts)?
- [ ] Directory structure created correctly?
- [ ] Example concept spec is parseable?
- [ ] Configuration files have sensible defaults?

**Examples:**
*Scaffold a new project*
```bash
copf init my-app
```
*Scaffold with custom template*
```bash
copf init my-app --template minimal
```

## References

- [Standard project directory layout](references/project-structure.md)
## Supporting Materials

- [Concept spec starter template](templates/concept-template.md)
## Quick Reference

| Directory | Purpose | Contains |
|-----------|---------|----------|
| specs/ | Concept specifications | .concept files |
| syncs/ | Synchronization rules | .sync files |
| implementations/ | Handler code | .impl.ts files |
| kits/ | Kit manifests | kit.yaml + concepts + syncs |


## Validation

*Validate scaffolded project:*
```bash
npx tsx tools/copf-cli/src/index.ts check
```
## Related Skills

| Skill | When to Use |
| --- | --- |
| `/concept-designer` | Design concepts for the new project |
| `/kit-lifecycle` | Bundle concepts into reusable kits |
| `/dev-workflow` | Start the dev server for the new project |
