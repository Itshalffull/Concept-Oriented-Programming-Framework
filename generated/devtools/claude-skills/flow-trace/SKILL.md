---
name: flow-trace
description: Build and render interactive debug traces from action log records 
 Each flow becomes a navigable tree showing the causal chain of 
 actions , syncs , and completions with timing and failure status
argument-hint: [command] [flowId]
allowed-tools: Read, Bash
---

# FlowTrace

Build and render interactive debug traces from action log records 
 Each flow becomes a navigable tree showing the causal chain of 
 actions , syncs , and completions with timing and failure status

## Step 1: Build Execution Trace

Build a trace from a flow ID showing which concepts were invoked, what syncs fired, and data flow between them.

**Arguments:** `$0` **flowId** (string)

**Examples:**
*Build trace from flow ID*
```bash
copf trace <flow-id>
```

## References

- [Debugging with FlowTrace](references/debugging.md)
