# project_scaffold — MCP Tool Guide

Scaffold a new CLEF project named **{input}** with the standard directory layout, example concept, and configuration files.


> **When to use:** Use when starting a new CLEF project from scratch. Creates the standard directory structure, example concept spec, and configuration files.


## Design Principles

- **Minimal Viable Structure:** Scaffold the minimum needed to run `clef check` and `clef generate` — don't overload with unused templates.
- **Convention Over Configuration:** Project follows standard directory layout (specs/, syncs/, implementations/) so tools work without configuration.
**scaffold:**
- [ ] Project name is valid (kebab-case, no conflicts)?
- [ ] Directory structure created correctly?
- [ ] Example concept spec is parseable?
- [ ] Configuration files have sensible defaults?
## References

- [Standard project directory layout](references/project-structure.md)
## Supporting Materials

- [Concept spec starter template](templates/concept-template.md)
## Quick Reference

| Directory | Purpose | Contains |
|-----------|---------|----------|
| specs/ | Concept specifications | .concept files |
| syncs/ | Synchronization rules | .sync files |
| implementations/ | Handler code | .handler.ts files |
| suites/ | Suite manifests | suite.yaml + concepts + syncs |


## Validation

*Validate scaffolded project:*
```bash
npx tsx cli/src/index.ts check
```
**Related tools:** [object Object], [object Object], [object Object]

