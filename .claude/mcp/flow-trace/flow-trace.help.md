# flow_trace — MCP Tool Guide

Build a debug trace for flow **{input}** showing the causal chain of concept actions, sync firings, and data propagation.


> **When to use:** Use when debugging action flows, tracing causal chains through concept actions and sync firings, or diagnosing why an expected sync did not trigger.


## Design Principles

- **Causal Completeness:** The trace shows the complete causal chain — every action that fired because of the initial trigger, not just the immediate effects.
- **Non-Intrusive:** Tracing reads the action log — it never modifies runtime behavior or adds overhead to normal execution.
**build:**
- [ ] Flow ID exists in action log?
- [ ] All causal links followed (action → sync → action)?
- [ ] Timing data captured for each node?

**render:**
- [ ] Tree indentation correct?
- [ ] Failed nodes highlighted?
- [ ] Data flow arrows show variable propagation?
## References

- [Debugging with FlowTrace](references/debugging.md)
## Supporting Materials

- [Flow debugging walkthrough](examples/debug-a-flow.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| build | `clef trace <flow-id>` | Build trace from a flow ID |
| render | (automatic) | Render trace as tree output |


## Validation

*Build a trace:*
```bash
npx tsx cli/src/index.ts trace <flow-id>
```
**Related tools:** [object Object], [object Object], [object Object]

