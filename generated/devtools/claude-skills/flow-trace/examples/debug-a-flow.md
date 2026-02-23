# Walkthrough: Debugging a Flow

This walkthrough shows how to use FlowTrace to debug
a sync that didn't fire as expected.

## The Problem

A welcome email should be sent when a user registers,
but no email is being sent.

## Step 1: Find the Flow ID

```bash
copf trace --recent
```

Output shows recent flows. Find the User/create flow.

## Step 2: Build the Trace

```bash
copf trace abc-123
```

```
Flow abc-123
├─ User/create => ok [user: u1]        2ms
│  └─ [sync: CreateProfile] eager
│     └─ Profile/create => ok [p: p1]   1ms
└─ total: 3ms
```

## Step 3: Diagnose

The WelcomeEmail sync is missing from the trace. Check:

1. **Is it registered?** — Check `syncs/welcome-email.sync` exists.
2. **Does the pattern match?** — The sync watches
   `Profile/create => ok`, which DID fire. Check variable bindings.
3. **Is it eventual?** — Eventual syncs execute asynchronously.
   Check the async queue for pending jobs.

## Step 4: Fix

The sync had a typo in the variant name (`sucess` → `ok`).
After fixing, the trace shows the complete chain.
