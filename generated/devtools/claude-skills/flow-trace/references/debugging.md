# Debugging with FlowTrace

FlowTrace builds causal execution trees from the action log,
showing every concept action and sync firing triggered by
an initial action.

## Reading a Trace

```
Flow abc-123
├─ User/create => ok [user: u1]        2ms
│  ├─ [sync: CreateProfile] eager
│  │  └─ Profile/create => ok [profile: p1]  1ms
│  └─ [sync: WelcomeEmail] eventual
│     └─ Email/send => ok               45ms
└─ total: 48ms
```

**Reading the tree:**
- Root node is the initial action.
- Indented children are syncs that fired from the parent.
- `[sync: Name]` shows which sync rule triggered the action.
- Timing shows per-node and total duration.

## Common Debugging Scenarios

### Sync didn't fire
1. Check the when-clause variant matches the actual completion.
2. Verify variable bindings — a misspelled binding silently fails.
3. Check sync mode — eventual syncs execute asynchronously.

### Unexpected cascade
1. Look for broad pattern matches (missing variant name).
2. Check if multiple syncs react to the same completion.
3. Look for circular chains: A→B→C→A.

### Slow execution
1. Look for deep nesting (long sync chains).
2. Check eventual syncs for slow external calls.
3. Look for N+1 patterns in where-clause queries.

## Trace Commands

| Command | Purpose |
|---------|---------|
| `copf trace <flow-id>` | Build and display a trace |
| `copf trace <flow-id> --json` | Output trace as JSON |
| `copf trace --recent` | Show last 10 flow traces |
