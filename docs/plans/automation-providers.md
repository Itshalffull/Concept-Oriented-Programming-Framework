# Automation Providers Suite — Implementation Plan

## Overview

The Clef framework has hundreds of concepts with well-defined actions, but no way for users to wire those actions into automations at runtime. The existing `AutomationRule` concept has an opaque `actions: String` field with no structured dispatch.

This suite adds pluggable automation backends that let users discover and invoke concept actions through validated, scoped channels.

## Architecture

### Concepts

| Concept | Role | Description |
|---------|------|-------------|
| **AutomationDispatch** | Coordination | Routes execution requests to registered providers via PluginRegistry |
| **AutomationScope** | Gate | Allowlist/denylist control for SyncAutomationProvider actions |
| **ManifestAutomationProvider** | Provider (optional) | Build-time generated action registry with schema validation |
| **SyncAutomationProvider** | Provider (optional) | Runtime user-defined syncs with lifecycle management |
| **AutomationTarget** | Bind provider | Generates automation-manifest.json from Projections |

### Sync Wiring

| Sync | Trigger | Effect |
|------|---------|--------|
| `automation-dispatch-routing` | AutomationRule/execute | AutomationDispatch/dispatch |
| `manifest-provider-registration` | ManifestAutomationProvider/register | PluginRegistry/register |
| `sync-provider-registration` | SyncAutomationProvider/register | PluginRegistry/register |
| `dispatch-to-manifest` | Dispatch(provider: "manifest") | ManifestAutomationProvider/execute |
| `dispatch-to-sync` | Dispatch(provider: "sync") | SyncAutomationProvider/execute |
| `sync-validates-against-scope` | SyncAutomationProvider/validate | AutomationScope/check |
| `sync-activation-registers-engine` | SyncAutomationProvider/activate | SyncEngine/registerSync |
| `manifest-load-on-build` | AutomationTarget/generate | ManifestAutomationProvider/load |
| `route-to-automation` | Target/generate(type: "automation") | AutomationTarget/generate |

### Entity Reflection

| Concept | Entity Type | Bundle/Tag |
|---------|-------------|------------|
| AutomationDispatch | Config | `config_bundle: "automation_dispatch"` |
| AutomationScope | Config | `config_bundle: "automation_scope"` |
| ManifestAutomationProvider | Config | `config_bundle: "automation_provider"` |
| SyncAutomationProvider | Content | Tag `system:user_sync` + Relation `authored_by` |

## Design Decisions

1. **Provider pattern** follows SolverProvider (formal-verification) — PluginRegistry coordination with typed dispatch.
2. **Scope gate** is separate from providers to allow shared policy across all sync-based automations.
3. **Manifest provider** is optional — projects without build-time generation can use only the sync provider.
4. **Sync provider** lifecycle (Draft → Validated → Active → Suspended) ensures user syncs are safe before execution.
5. **AutomationTarget** lives in bind/interface following the same pattern as RestTarget, GraphqlTarget, etc.

## Files

### New (18 files)
- `repertoire/concepts/automation-providers/suite.yaml`
- `repertoire/concepts/automation-providers/AutomationDispatch.concept`
- `repertoire/concepts/automation-providers/AutomationScope.concept`
- `repertoire/concepts/automation-providers/providers/ManifestAutomationProvider.concept`
- `repertoire/concepts/automation-providers/providers/SyncAutomationProvider.concept`
- `repertoire/concepts/automation-providers/syncs/automation-dispatch-routing.sync`
- `repertoire/concepts/automation-providers/syncs/manifest-provider-registration.sync`
- `repertoire/concepts/automation-providers/syncs/sync-provider-registration.sync`
- `repertoire/concepts/automation-providers/syncs/dispatch-to-manifest.sync`
- `repertoire/concepts/automation-providers/syncs/dispatch-to-sync.sync`
- `repertoire/concepts/automation-providers/syncs/sync-validates-against-scope.sync`
- `repertoire/concepts/automation-providers/syncs/sync-activation-registers-engine.sync`
- `repertoire/concepts/automation-providers/syncs/manifest-load-on-build.sync`
- `bind/interface/concepts/providers/automation-target.concept`
- `bind/interface/syncs/routing/route-to-automation.sync`
- `repertoire/concepts/entity-reflection/syncs/automation-providers/*.sync` (4 files)
- `repertoire/concepts/entity-reflection/tests/automation-providers.conformance.test.ts`

### Modified (2 files)
- `bind/interface/suite.yaml` — AutomationTarget concept + route-to-automation sync
- `repertoire/concepts/entity-reflection/suite.yaml` — Wave 24 entries + dependency
