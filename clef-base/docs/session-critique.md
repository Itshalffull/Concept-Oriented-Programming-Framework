# Clef Base — Session Critique & Review

## What Works Really Well

### 1. Content-Native Architecture
The single content pool with Schema overlays is genuinely powerful. Creating a
new content type (constitution, process spec, proposal, circle, policy, role)
requires only a `.schema.yaml` + init sync — the general infrastructure
handles page promotion, child schema overlay, default block tree, display mode,
FormBuilder field generation, and staleness tracking automatically. Zero custom
widgets needed for the basic experience.

### 2. Recursive Outline Rendering
The "Outline all the way down" pattern with three-tier block resolution
(schema-block-editor → plain-content-block → FieldItemList) is elegant.
Schema-overlaid blocks and plain text intermix on the same page through
the same ViewShell, resolved through the display pipeline.

### 3. Derived Concept Hierarchy
27 derived concepts forming a clean hierarchy from primitives to ClefBase root.
The hierarchy makes the architecture legible — you can understand the platform
by reading the derived concept tree. And derived concepts generate agents,
skills, MCP tools, and CLI commands through the Bind pipeline.

### 4. GovernedProcess Integration
The proposal-as-process pattern (proposal lifecycle IS a ProcessRun) and
vote-as-step pattern (StepRun dispatches to Vote concept) are architecturally
clean. Reputation-weighted voting and proposal-driven governance changes
create a self-modifying governance system.

### 5. Org Designer Canvas
Using the diagramming suite for visual org chart editing (drag circles/roles,
connect hierarchies) with the governance-org notation validating structure
is a natural fit. Canvas nodes are ContentNodes — click through to edit.

---

## Bugs Found

### B1: 8 Derived Concepts Failed to Parse (FIXED)
**Severity**: Blocker for Bind pipeline
**Status**: Fixed in commit 2fc68b2d
**Root cause**: Agents generated derived concepts with:
- Prose-style principles (`"Name": description`) instead of `after/then/and`
- Multi-line queries (newline before `->`)
- Parenthesized args in `matches:` that the parser rejects
**Fix**: Updated all 8 files. Also updated DerivedScaffoldGen skill with
parser constraints to prevent recurrence.

### B2: PersonaCompiler/ContentCompiler Conformance Failures (3 tests)
**Severity**: Low (expected, not a real bug)
**Status**: Known limitation
**Details**: `compile_missing → notfound` and `compile_empty → invalid`
fixtures expect cross-concept behavior (checking if a page exists or has
blocks) that only happens via syncs. The isolated handler can't check
Outline children because that's a different concept's storage.
**Recommendation**: Mark these as `@sync-dependent` fixtures that skip
in isolated conformance tests but run in integration tests.

### B3: PersonaCompiler Still Referenced in Some Syncs
**Severity**: Medium
**Status**: Not fixed
**Details**: The original persona-specific staleness syncs were updated to
reference ContentCompiler, but PersonaCompiler still exists as a concept
and handler. It should either be removed entirely (since ContentCompiler
replaces it) or kept as a thin wrapper that delegates to ContentCompiler.
**Recommendation**: Delete persona-compiler.concept and handler, update
any remaining references.

---

## UX Issues & Missing Pieces

### U1: No Schema Bootstrap Mechanism
**Severity**: High
**Description**: The seed files define schemas and properties, but there's
no sync or boot script that actually calls `Schema/defineSchema` at startup.
The init syncs (e.g., `constitution-schema-init.sync`) fire AFTER
`Schema/defineSchema` — but nothing triggers the initial `defineSchema`.
**Impact**: None of the content-native types would actually work until
someone manually calls `Schema/defineSchema` for each type.
**Recommendation**: Create a `kernel-boot` sync or startup script that
reads `Schema.governance.seeds.yaml` and calls `Schema/defineSchema` for
each entry. Or wire the seed loader to fire schema definitions on boot.

### U2: No "New Page" Flow for Content Types
**Severity**: High
**Description**: Destinations exist for listing pages (e.g., `/admin/governance/constitutions`)
but there's no "Create New Constitution" button or form. The ViewShell
InteractionSpec needs `createForm: true` with the correct schema.
**Impact**: Users can navigate to the list but can't create new pages.
**Recommendation**: Ensure all content-native ViewShells have
InteractionSpec with `createForm: true` and `createFormSchema` set.

### U3: Template Instantiation Doesn't Create Outline Children
**Severity**: High
**Description**: The `Template/instantiate` action produces content text
(a JSON array of block definitions), but there's no sync that takes that
output and creates actual ContentNode children in the Outline hierarchy
with the child schema applied.
**Impact**: New pages would be created but have no default blocks.
**Recommendation**: Create a sync that handles `Template/instantiate → ok`
by parsing the block definitions and creating ContentNode + Outline/create
+ Schema/applyTo for each block.

### U4: Structured Content Display Mode Requires Manual Switch
**Severity**: Medium
**Description**: The `structured-content` display mode replaces the main
zone, but the sync that activates it fires on `DisplayMode/resolve` which
may race with the default entity-page resolution. Need to ensure the
structured-content mode takes priority.
**Impact**: Pages might render with the default canvas zone instead of
the block editor on first load.
**Recommendation**: Set higher specificity on the structured-content
display mode, or add a priority field to DisplayMode resolution.

### U5: No Compiled Output Preview for Agent Personas
**Severity**: Medium
**Description**: The persona-editor widget has a "Compile & Preview"
button, but ContentCompiler's compilation requires a PromptAssembly
provider routing sync to actually produce output. The general
ContentCompiler dispatch works, but the persona compilation route
produces a PromptAssembly with no visible preview widget.
**Impact**: Compile button works but preview may be empty.
**Recommendation**: Create a prompt-preview widget that renders the
assembled PromptAssembly as formatted text.

### U6: Governance Views Don't Filter by Circle Context
**Severity**: Medium
**Description**: The circle-processes and circle-dashboard views show
processes/proposals for a circle, but the DataSourceSpec uses a hardcoded
`${circleId}` placeholder that doesn't get resolved at runtime.
**Impact**: Views may show all processes instead of circle-scoped ones.
**Recommendation**: Use ViewShell parameters or context injection to
pass the current circle ID into the DataSourceSpec filter.

### U7: Permission Resolution Chain Has No Short-Circuit
**Severity**: Low
**Description**: The permission resolution syncs fire on `denied` variant,
expanding through roles → circles → process context. But if the role check
grants access, the circle and process checks still fire unnecessarily.
**Impact**: Performance — extra sync evaluations on every permission check.
**Recommendation**: Add a guard condition that only fires expansion syncs
if previous expansion also returned denied.

### U8: No Audit Trail for Permission Changes
**Severity**: Low
**Description**: Permission grants/revocations don't automatically create
AuditTrail entries. The governance-transparency suite has AuditTrail but
it's not wired to Permission actions.
**Impact**: No governance audit trail for permission changes.
**Recommendation**: Add syncs: Permission/grant → AuditTrail/record,
Permission/revoke → AuditTrail/record.

---

## What's Missing for a Complete Experience

### M1: Schema Bootstrap on Kernel Boot
See U1. Need a boot-time mechanism to register all schemas.

### M2: Template → Outline Block Creation Sync
See U3. Templates produce text but don't create actual blocks.

### M3: Policy Compliance Panel Widget (from GovernedProcess PRD)
Phase 4.6 is still pending — a widget showing which policies apply to
the current action and their pass/fail status.

### M4: Governance Suite Manifest
The governed-process suite has syncs but no `suite.yaml` manifest.
Should be created to declare concepts, syncs, and dependencies.

### M5: Integration Tests
No integration tests exist for the governance-process wiring. Should
test the full flow: create circle → create process → start run → vote →
execute → verify permissions changed.

### M6: Documentation Pages
The CLAUDE.md section on Clef Base describes the architecture but
doesn't cover the governance system. Should add a section on
GovernedProcess, org designer, and permission model.

---

## Test Results Summary

| Test Suite | Pass | Fail | Notes |
|-----------|------|------|-------|
| ContentCompiler conformance | 51/53 | 2 | compile_missing, compile_empty need sync context |
| AgentSession conformance | 63/64 | 1 | spawn_missing needs sync context |
| AgentTrigger conformance | 56/56 | 0 | All pass |
| PersonaCompiler conformance | 44/46 | 2 | Same sync-dependent fixtures |
| ContentTypeScaffoldGen conformance | 29/29 | 0 | All pass |
| Derived concept parsing | 17/17 | 0 | All pass after fixes |
