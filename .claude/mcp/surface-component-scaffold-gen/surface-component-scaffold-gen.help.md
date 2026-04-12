# surface_component_scaffold_gen — MCP Tool Guide

Scaffold a Clef Surface headless component **{input}** with .widget spec (anatomy, FSM states, accessibility, affordance, props, connect, compose), anatomy parts, machine implementation, and suite manifest.


> **When to use:** Use when creating a new Clef Surface headless component. Generates a .widget spec (anatomy, states with transitions, accessibility, affordance, props, connect, compose, invariant), anatomy definition, machine implementation, and suite manifest.


## Design Principles

- **Behavior-Rendering Separation:** Widget specs define behavior (states, transitions, guards). Rendering is handled by framework adapters. They agree only on part names (anatomy).
- **Finite State Machine Discipline:** Every component is a finite state machine with explicit states, events, transitions, and guards. No implicit state.
- **Anatomy Contract:** The anatomy defines named parts (root, trigger, content, etc.) that both the machine and renderer reference. This is the only coupling point.
- **Props API via connect():** The machine's connect() action transforms internal state into framework-neutral props objects — one per anatomy part.
- **Pagination Control Pattern:** For paginated views, use the pagination-control.widget pattern: parts (root, prevButton, nextButton, pageIndicator, pageSizeSelector, totalCount), states (idle, loading, firstPage, lastPage, disabled), connect to PaginationSpec/advance and PaginationSpec/retreat. See surface/pagination-control.widget for the reference implementation.
**generate:**
- [ ] Component name is PascalCase?
- [ ] Parts list defines all structural elements?
- [ ] States define all machine states?
- [ ] Events define all transitions?
- [ ] Anatomy lists all parts and slots?
- [ ] Machine implementation has spawn, send, connect, destroy actions?
- [ ] Suite manifest declares dependencies on surface-core and surface-component?
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?
- [ ] Has purpose block?
- [ ] State machine has an [initial] state?
- [ ] All states are reachable?
- [ ] ARIA role is specified?
- [ ] Keyboard bindings cover Enter, Escape, Arrow keys?
- [ ] Focus management (trap, roving, initial) is defined?
- [ ] Props have types and defaults?
- [ ] Every structured invariant round-trips through parseWidgetFile? (See MUST-VERIFY below.)
- [ ] Invariant block has ≥ 5 structured entries (example/always/never/forall/action), not just prose strings?
- [ ] Anatomy, states, props, connect, compose blocks each have balanced braces? (A single imbalance silently eats the invariant block.)
## References

- [Clef Surface headless component architecture](references/surface-component-guide.md)
- [Widget specification grammar](references/widget-grammar.md)
## Supporting Materials

- [Clef Surface component scaffolding walkthrough](examples/scaffold-surface-component.md)
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
| `suite.yaml` | Suite manifest with dependencies |
| `{name}-machine.handler.ts` | Machine handler implementation |


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

*Generate a Clef Surface component scaffold:*
```bash
npx tsx cli/src/index.ts scaffold component --name Dialog --parts root,trigger,content --states closed,open
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```
**Related tools:** [object Object], [object Object], [object Object]

