# copf dev-server — Help

Start a development server that watches concept specs and syncs for changes and auto-recompiles on save.


> **When to use:** Use when developing concepts and syncs iteratively. The dev server watches for file changes and recompiles automatically, providing a fast feedback loop.


## Design Principles

- **Watch and Recompile:** The dev server watches .concept and .sync files for changes and recompiles automatically — no manual rebuild step.
- **Fast Feedback Loop:** Recompilation should complete in under a second for typical projects — parse errors show immediately.
**start:**
- [ ] Port is available?
- [ ] Specs and syncs directories exist?
- [ ] Initial compilation succeeds?

**status:**
- [ ] Server is responsive?
- [ ] Last recompile was successful?
## References

- [Development workflow guide](references/dev-workflow.md)
## Supporting Materials

- [Development iteration cycle walkthrough](examples/dev-iteration-cycle.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| start | `copf dev --port <port>` | Start dev server |
| status | `copf dev status` | Check if running |
| stop | `copf dev stop` | Stop the server |


## Validation

*Start dev server:*
```bash
npx tsx tools/copf-cli/src/index.ts dev --port 3000
```
*Check dev server status:*
```bash
npx tsx tools/copf-cli/src/index.ts dev status
```
## Related Skills

- /concept-validator — Validate specs that the dev server watches
- /trace-debugger — Debug flows generated during dev server sessions
- /cache-build — Pre-compile for production after dev iteration
