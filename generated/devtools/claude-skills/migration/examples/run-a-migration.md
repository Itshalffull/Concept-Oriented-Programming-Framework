# Walkthrough: Running a Migration

This walkthrough shows how to migrate a concept after
adding a new required field.

## The Change

Adding a `displayName` field to the User concept:

```
state {
  users: set U
  name: U -> String
  email: U -> String
  displayName: U -> String   # NEW
}
```

## Step 1: Check Status

```bash
copf migrate --status
```
```
User: v1 (stored) → v2 (spec) — MIGRATION NEEDED
Article: v1 (stored) → v1 (spec) — up to date
```

## Step 2: Plan

```bash
copf migrate --plan
```
```
Migration plan for User v1 → v2:
  1. ADD FIELD displayName (String)
     Default: compute from name field
```

## Step 3: Dry Run

```bash
copf migrate --dry-run
```

## Step 4: Apply

```bash
copf migrate --apply
```
