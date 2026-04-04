# PRD: Bidirectional Bind — External API Integration

## Cliff Notes

1. **New manifest format** (`app.external.yaml`) — describes external APIs
   and maps their endpoints to concept actions. Same structure as
   `app.interface.yaml` but arrows reversed.

2. **OpenAPI/GraphQL auto-import** — parse an external spec, infer which
   endpoints map to which concept actions, generate a draft manifest that
   you refine by hand.

3. **Projection becomes bidirectional** — the existing Projection concept
   gains `resolveForward` (concept→API) and `resolveReverse` (API→concept)
   actions. Same mapping data, two directions.

4. **Three runtime modes** per concept:
   - **Local only** — handler uses local storage (existing)
   - **External only** — handler calls external API via Projection
   - **Hybrid** — local primary + Replica sync to external (offline-capable)

5. **Field transforms** — request/response mappings that convert between
   concept field names and API field names. `title → name`, `assignee →
   owner_id`, `response.data.items → items`.

6. **Reuses everything** — Projection, ExternalCall, EffectHandler,
   HttpProvider, Replica, CausalClock, ConflictResolution, SyncPair,
   Transform. New code is mostly the manifest parser + Projection extensions.

---

## Problem

Bind generates APIs *from* concepts (outbound). There's no way to consume
external APIs *as* concepts (inbound). Users want to:

- Use Monday.com as the backend for a Task concept
- Use Linear as the backend for an Issue concept
- Use Stripe as the backend for a Payment concept
- Work offline with local storage and sync when connected
- Swap between local and external backends via deployment config

---

## The Ingest Manifest

### Format: `app.external.yaml`

```yaml
# External API sources mapped to Clef concepts
version: 1

sources:
  monday:
    displayName: Monday.com
    specUrl: https://api.monday.com/v2/openapi.json  # optional
    specType: openapi                                  # openapi | graphql | asyncapi | manual
    baseUrl: https://api.monday.com/v2
    auth:
      type: bearer
      tokenRef: ${MONDAY_API_KEY}
    
    # Concept-level mappings
    concepts:
      Task:
        actions:
          create:
            method: POST
            path: /items
            request:
              # concept field: API field (dot-notation for nested)
              title: name
              description: column_values.text
              assignee: column_values.person.personsAndTeams[0].id
              dueDate: column_values.date.date
            response:
              id: data.create_item.id
              title: data.create_item.name
              createdAt: data.create_item.created_at
            
          list:
            method: POST
            path: /
            requestBody: |
              { "query": "{ boards(ids: {{boardId}}) { items_page { items { id name column_values { id value } } } } }" }
            response:
              items: data.boards[0].items_page.items
              _itemTransform:
                id: id
                title: name
                status: column_values[?id=='status'].value
            
          get:
            method: POST
            path: /
            requestBody: |
              { "query": "{ items(ids: [{{id}}]) { id name column_values { id value } } }" }
            response:
              id: data.items[0].id
              title: data.items[0].name
            
          update:
            method: POST
            path: /
            requestBody: |
              { "query": "mutation { change_simple_column_value(item_id: {{id}}, board_id: {{boardId}}, column_id: \"name\", value: \"{{title}}\") { id } }" }
            response:
              id: data.change_simple_column_value.id
            
          complete:
            method: POST
            path: /
            requestBody: |
              { "query": "mutation { change_simple_column_value(item_id: {{id}}, board_id: {{boardId}}, column_id: \"status\", value: \"{\\\"label\\\": \\\"Done\\\"}\") { id } }" }
            response:
              id: data.change_simple_column_value.id

    # Webhook configuration for inbound events (external → concept)
    webhooks:
      - event: item.created
        mapsTo: Task/create
        fieldMapping:
          id: event.pulseId
          title: event.pulseName
      - event: item.updated
        mapsTo: Task/update
        fieldMapping:
          id: event.pulseId

    # Sync configuration
    sync:
      direction: bidirectional        # push | pull | bidirectional
      interval: 60                    # seconds between sync polls
      conflictStrategy: last-writer-wins
      idMapping:
        local: node                   # local concept ID field
        remote: id                    # remote API ID field

  todoist:
    displayName: Todoist
    specType: openapi
    specUrl: https://developer.todoist.com/rest/v2/openapi.yaml
    baseUrl: https://api.todoist.com/rest/v2
    auth:
      type: bearer
      tokenRef: ${TODOIST_API_KEY}
    concepts:
      Task:
        actions:
          create:
            method: POST
            path: /tasks
            request:
              title: content
              description: description
              dueDate: due_date
            response:
              id: id
              title: content
          list:
            method: GET
            path: /tasks
            response:
              _arrayRoot: true       # response is a direct array
              _itemTransform:
                id: id
                title: content
                status: is_completed
          complete:
            method: POST
            path: /tasks/{{id}}/close
            response: {}
```

### Key design decisions:

- **`request` block** — maps concept field names (left) to API field names
  (right). Dot-notation for nested fields. `{{var}}` for URL template params.
- **`response` block** — maps API field names (left) to concept field names
  (right). `_arrayRoot` and `_itemTransform` for list responses.
- **`webhooks` block** — maps inbound events to concept actions (for
  push-based sync instead of polling).
- **`sync` block** — configures Replica behavior: direction, interval,
  conflict strategy, ID field mapping.
- **Same YAML structure as `interface.yaml`** — just the field mapping
  arrows are reversed.

---

## Architecture Changes

### A1. Ingest manifest parser

**File:** `specs/framework/ingest-manifest-parser.concept`

Parse `app.external.yaml` into structured IngestManifest records. Validates
source config, auth, action mappings, transforms, webhook definitions.

Actions:
- `parse(yaml)` → ok(manifest) | invalid
- `validate(manifest)` → ok | invalid(errors)
- `merge(base, override)` → ok(merged) — for env-specific overrides

### A2. OpenAPI/GraphQL spec importer

**File:** `specs/framework/api-spec-importer.concept`

Parse an external API spec (OpenAPI 3.x, GraphQL introspection, AsyncAPI)
and produce a draft ingest manifest with auto-inferred action mappings.

Actions:
- `import(specUrl, specType)` → ok(draftManifest, confidence)
- `importInline(specContent, specType)` → ok(draftManifest, confidence)
- `suggestMappings(spec, conceptName)` → ok(suggestions) — AI-assisted
  mapping suggestions based on endpoint names, schemas, and concept actions

### A3. Projection extensions (bidirectional)

**File:** `bind/interface/concepts/projection.concept` (extend)

Add to existing Projection:

State:
- `externalSource: P -> option String`
- `direction: P -> "forward" | "reverse" | "bidirectional"`
- `actionMappings: P -> list ActionMapping`
- `authConfig: P -> option String`

New actions:
- `ingest(manifest, source, concept)` → ok(projection)
  Create a Projection from an ingest manifest (reverse of `project`)
- `resolveForward(projection, action, input)` → ok(method, path, body, headers)
  Given a concept action, produce the external API call
- `resolveReverse(projection, method, path, body)` → ok(concept, action, input)
  Given an external API call, produce the concept action invocation

### A4. External handler generator

**File:** `specs/framework/external-handler-gen.concept`

Generate a handler implementation from an ingest manifest. The generated
handler uses `perform('http', ...)` for each action, with field transforms
applied from the manifest's request/response mappings.

Actions:
- `generate(manifest, source, concept)` → ok(handlerCode)
- `generateAll(manifest)` → ok(handlers: list)

### A5. Field transform engine

**File:** `repertoire/concepts/data-integration/field-transform.concept`

Execute field-level mappings between concept records and API payloads.
Supports dot-notation paths, array access, template substitution, and
type coercion.

Actions:
- `transformRequest(mapping, conceptInput)` → ok(apiPayload)
- `transformResponse(mapping, apiResponse)` → ok(conceptOutput)
- `validate(mapping)` → ok | invalid(errors)

### A6. Webhook integration (reuse WebhookInbox)

**Existing:** `repertoire/concepts/process-automation/webhook-inbox.concept`

WebhookInbox already handles inbound event reception with correlation-key
matching and lifecycle (waiting → received → acknowledged → expired).
It has a handler, generated code for all targets, and syncs wiring it
to StepRun for process automation.

**Extension needed:** WebhookInbox currently scopes to process steps
(run_ref, step_ref). For bidirectional Bind, add:
- New action `registerForConcept(source, eventType, concept, action, fieldMapping)`
  that registers a webhook listener mapped to a concept action instead of a step
- New sync `WebhookReceivedInvokesConcept` that routes received events through
  FieldTransform then invokes the mapped concept action
- Signature verification via `WebhookEndpoint` headers config

**No new concept needed** — extend WebhookInbox + add a sync.

---

## Syncs

### SY1. Ingest manifest → Projection

**File:** `syncs/framework/ingest-to-projection.sync`

When IngestManifestParser/parse completes, create a reverse Projection
for each source+concept pair.

### SY2. External handler dispatch

**File:** `syncs/framework/external-handler-dispatch.sync`

When a concept action fires and the concept has a reverse/bidirectional
Projection, route through Projection/resolveForward → ExternalCall/dispatch
instead of local storage.

### SY3. Webhook → concept action

**File:** `syncs/framework/webhook-to-concept.sync`

When WebhookReceiver/receive fires, invoke the mapped concept action
with the transformed input.

### SY4. Replica sync with external

**File:** `syncs/framework/replica-external-sync.sync`

Periodic sync: Replica/sync → Projection/resolveForward for pending
outbound ops, and poll external API → Projection/resolveReverse for
inbound changes. Uses CausalClock for ordering, ConflictResolution
for conflicts.

---

## Deployment Configuration

### Mode selection in `deploy.yaml`

```yaml
concepts:
  Task:
    # Mode 1: Local only (default)
    handler: task
    storage: local-sqlite
    
    # Mode 2: External only
    handler: task-external     # generated from ingest manifest
    external:
      source: monday
      manifest: app.external.yaml
    
    # Mode 3: Hybrid (local primary + external sync)
    handler: task              # local handler
    storage: local-sqlite
    replica:
      enabled: true
      syncPair:
        source: monday
        manifest: app.external.yaml
        direction: bidirectional
        interval: 60
        conflictStrategy: last-writer-wins
```

---

## Implementation Order

1. **Field transform engine** (A5) — needed by everything else
2. **Ingest manifest parser** (A1) — parse the YAML format
3. **Projection extensions** (A3) — resolveForward/resolveReverse
4. **External handler generator** (A4) — produce handlers from manifests
5. **Syncs** (SY1-SY2) — wire ingest → projection → dispatch
6. **OpenAPI importer** (A2) — auto-generate draft manifests from specs
7. **Webhook receiver** (A6) — push-based sync
8. **Replica sync** (SY4) — offline-capable hybrid mode

---

## Traceability Matrix

| PRD Section | File | Status |
|-------------|------|--------|
| A1. Ingest manifest parser | `specs/framework/ingest-manifest-parser.concept` | pending |
| A1h. Parser handler | `handlers/ts/framework/ingest-manifest-parser.handler.ts` | pending |
| A2. API spec importer | `specs/framework/api-spec-importer.concept` | pending |
| A2h. Importer handler | `handlers/ts/framework/api-spec-importer.handler.ts` | pending |
| A3. Projection extensions | `bind/interface/concepts/projection.concept` | pending (extend) |
| A3h. Projection handler | `handlers/ts/framework/projection.handler.ts` | pending (extend) |
| A4. External handler gen | `specs/framework/external-handler-gen.concept` | pending |
| A4h. Gen handler | `handlers/ts/framework/external-handler-gen.handler.ts` | pending |
| A5. Field transform | `repertoire/concepts/data-integration/field-transform.concept` | pending |
| A5h. Transform handler | `handlers/ts/app/field-transform.handler.ts` | pending |
| A6. Webhook integration | `repertoire/concepts/process-automation/webhook-inbox.concept` | exists (extend) |
| A6h. Webhook handler | `handlers/ts/process-automation/webhook-inbox.handler.ts` | exists (extend) |
| SY1. Ingest → Projection | `syncs/framework/ingest-to-projection.sync` | pending |
| SY2. External dispatch | `syncs/framework/external-handler-dispatch.sync` | pending |
| SY3. Webhook → concept | `syncs/framework/webhook-to-concept.sync` | pending |
| SY4. Replica external sync | `syncs/framework/replica-external-sync.sync` | pending |
| Manifest format | `app.external.yaml` (spec) | pending |
