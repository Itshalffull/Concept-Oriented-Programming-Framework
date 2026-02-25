---
name: coif-component-scaffold-gen
description: Use when creating a new COIF headless component. Generates a complete component scaffold including widget specification (FSM), anatomy definition (parts contract), machine implementation, and kit manifest.
argument-hint: --name <ComponentName>
allowed-tools: Read, Write, Bash
---

# CoifComponentScaffoldGen

Scaffold a COIF headless component **$ARGUMENTS** with widget FSM, anatomy parts, machine implementation, and kit manifest.

> **When to use:** Use when creating a new COIF headless component. Generates a complete component scaffold including widget specification (FSM), anatomy definition (parts contract), machine implementation, and kit manifest.

## Design Principles

- **Behavior-Rendering Separation:** Widget specs define behavior (states, transitions, guards). Rendering is handled by framework adapters. They agree only on part names (anatomy).
- **Finite State Machine Discipline:** Every component is a finite state machine with explicit states, events, transitions, and guards. No implicit state.
- **Anatomy Contract:** The anatomy defines named parts (root, trigger, content, etc.) that both the machine and renderer reference. This is the only coupling point.
- **Props API via connect():** The machine's connect() action transforms internal state into framework-neutral props objects — one per anatomy part.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track ComponentConfig → CoifComponent transformations.

**Examples:**
*Register the component scaffold generator*
```typescript
const result = await coifComponentScaffoldGenHandler.register({}, storage);

```

### Step 2: Generate COIF Component

Generate a complete headless component scaffold including widget specification (FSM), anatomy definition (parts contract), machine implementation, and kit manifest.

**Examples:**
*Generate a dialog component*
```bash
copf scaffold component --name Dialog --parts root,trigger,content --states closed,open
```
*Generate a tabs component*
```bash
copf scaffold component --name Tabs --parts root,list,trigger,content,indicator --states idle,focused,selected --events focus,select,blur
```

**Checklist:**
- [ ] Component name is PascalCase?
- [ ] Parts list defines all structural elements?
- [ ] States define all machine states?
- [ ] Events define all transitions?
- [ ] Anatomy lists all parts and slots?
- [ ] Machine implementation has spawn, send, connect, destroy actions?
- [ ] Kit manifest declares dependencies on coif-core and coif-component?

## References

- [COIF headless component architecture](references/coif-component-guide.md)

## Supporting Materials

- [COIF component scaffolding walkthrough](examples/scaffold-coif-component.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | PascalCase component name |
| parts | list String | Anatomy part names (root, trigger, content, etc.) |
| slots | list String | Named slot insertion points |
| states | list String | FSM state names |
| events | list String | FSM event names |
| a11y | { role, ariaProps } | Accessibility configuration |

**Output Files:**
| File | Purpose |
|------|---------|
| `{name}-widget.concept` | Widget FSM specification |
| `{name}-anatomy.concept` | Parts contract definition |
| `kit.yaml` | Kit manifest with dependencies |
| `{name}-machine.impl.ts` | Machine handler implementation |


## Anti-Patterns

### Rendering logic in widget spec
Widget spec includes CSS, HTML, or framework-specific code — violates behavior-rendering separation.

**Bad:**
```
widget Dialog {
  render {
    <div class="dialog-overlay">  # HTML in spec!
      <div class="dialog-content">...</div>
    </div>
  }
}
```

**Good:**
```
widget Dialog {
  anatomy {
    part root        # Just names — rendering
    part backdrop    # is the adapter's job
    part content
  }
}
```

### Implicit state transitions
Component changes state without explicit events — makes behavior unpredictable.

**Bad:**
```
machine {
  state open {
    # Implicitly closes after 5 seconds — not declarative!
    after 5000ms -> closed
  }
}
```

**Good:**
```
machine {
  state open {
    on close -> closed
    on timeout -> closed  # Explicit event
  }
}
```

## Validation

*Generate a COIF component scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold component --name Dialog --parts root,trigger,content --states closed,open
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| coif-theme-scaffold | Generate themes to style the component |
| concept-scaffold | Generate concept specs for custom component concepts |
| kit-scaffold | Generate kit manifests for component libraries |

