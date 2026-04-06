# Governance Permissions — PRD

## Vision

Permissions support polymorphic subjects (person, role, circle, process,
proposal type) with resolution chains and optional compound boolean
conditions. The permissions page lets you grant permissions to any subject
type, and the resolution engine checks through the full chain when
evaluating access.

## Architecture

```
Permission Grant:
  who: "role:editor"           ← simple single subject
  what: "publish"
  where: "marketing-content"
  condition: none              ← no compound condition

Permission Grant (compound):
  who: "*"                     ← wildcard — condition determines access
  what: "modify-budget"
  where: "treasury"
  condition: "circle:finance AND role:treasurer"
```

Resolution chain for "Can Alice publish?":
```
1. Direct person check: Permission(who: "alice", what: "publish")
2. Role expansion: Alice holds "Editor" → check Permission(who: "role:editor")
3. Circle expansion: Alice in "Marketing" → check Permission(who: "circle:marketing")
4. Process context: action in "Content Review" run → check Permission(who: "process:content-review")
5. Compound evaluation: evaluate condition expr against Alice's context
```

## Deliverables

### Phase 1: Permission Resolution Syncs
Chain of syncs that expand permission checks through subject types.

| # | Sync | Status | Commit |
|---|------|--------|--------|
| 1.1 | PersonPermissionCheck — direct person ID check | pending | |
| 1.2 | RolePermissionExpansion — expand to check holder's roles | pending | |
| 1.3 | CirclePermissionExpansion — expand to check member's circles | pending | |
| 1.4 | ProcessContextPermission — check active process context | pending | |
| 1.5 | ProposalTypeGuard — check proposal type permission for governance actions | pending | |

### Phase 2: Compound Conditions
Boolean expression evaluation over subject type predicates.

| # | Deliverable | Status | Commit |
|---|-------------|--------|--------|
| 2.1 | Permission condition grammar (AND/OR/NOT over subject predicates) | pending | |
| 2.2 | Condition evaluation sync (parse + evaluate condition against context) | pending | |
| 2.3 | Integration with ExpressionLanguage concept for parsing | pending | |

### Phase 3: Permissions Editor Widget
UI for granting permissions with subject type selector and compound conditions.

| # | Widget | Purpose | Status | Commit |
|---|--------|---------|--------|--------|
| 3.1 | permission-grant-editor | Full permission grant form with subject type selector (person/role/circle/process/proposal-type), entity picker, permission selector, condition builder | pending | |
| 3.2 | condition-builder | Visual AND/OR/NOT builder for compound conditions | pending | |
| 3.3 | permission-resolution-panel | Shows how a permission resolves for a given user (which grants matched, through which chain) | pending | |

### Phase 4: Views & Destinations
Navigation entries and views for the permissions system.

| # | Deliverable | Status | Commit |
|---|-------------|--------|--------|
| 4.1 | permissions-by-subject view — ViewShell showing all permissions grouped by subject | pending | |
| 4.2 | permissions-by-resource view — ViewShell showing all permissions grouped by resource | pending | |
| 4.3 | effective-permissions view — for a given user, show resolved effective permissions | pending | |
| 4.4 | DestinationCatalog entries for permissions pages | pending | |
| 4.5 | Schema + Property seeds for permissions in clef-base bootstrap | pending | |

### Phase 5: Permission Content-Native Schema
Make permission grants content-native pages (optional — for audit/documentation).

| # | Deliverable | Status | Commit |
|---|-------------|--------|--------|
| 5.1 | permission-grant schema (who_type, who_id, what, where, condition, granted_by, status) | pending | |
| 5.2 | Schema init sync + Property seeds | pending | |
