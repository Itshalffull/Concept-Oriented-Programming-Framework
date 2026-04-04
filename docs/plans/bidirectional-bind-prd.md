# PRD: Bidirectional Bind — External API Integration

## Cliff Notes

1. **New manifest format** (`app.external.yaml`) — describes external APIs
   and maps their endpoints to concept actions. Same structure as
   `app.interface.yaml` but arrows reversed.

2. **OpenAPI/GraphQL import — three levels:**
   - Level 1: manual YAML mapping (the manifest)
   - Level 2: codegen generator that infers mappings from spec patterns
   - Level 3: ProcessSpec-driven flow (LLM, agent, or human resolves ambiguity)

3. **Projection becomes bidirectional** — the existing Projection concept
   gains `resolveForward` (concept→API) and `resolveReverse` (API→concept).

4. **Three runtime modes** per concept: local only, external only, hybrid
   (local primary + Replica sync to external with offline support).

5. **Field transforms include full expression language** — dot paths,
   templates, array mapping (`items[*].name`), and conditional transforms
   (`if status == "Done" then "completed" else "open"`).

6. **End-to-end proof** — build against a real third-party API that matches
   an existing Clef concept (e.g., Article concept against DEV.to API).

7. **Three-tier testing:**
   - Structural (dry-run) — verify StorageProgram emits correct perform instructions
   - Behavioral (mock provider) — full round-trip with canned responses
   - Integration (real API) — fixture-to-ProcessSpec generator runs fixtures
     as process steps against the real API

8. **Webhook dispatch provider pattern** — WebhookInbox routes to pluggable
   providers (step-run, concept-action, automation, forward). Existing
   process automation syncs migrated to provider pattern.

9. **Reuses** Projection, ExternalCall, EffectHandler, HttpProvider, Replica,
   CausalClock, ConflictResolution, SyncPair, WebhookInbox, ProcessSpec,
   CheckVerification.

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

## Design Decisions

### D1. Field transform complexity: full expression language

The FieldTransform engine supports:
- **Dot-notation paths**: `response.data.items[0].name`
- **Template substitution**: `{{boardId}}`
- **Array mapping**: `items[*].name` → map over all items
- **Conditional transforms**: `if status == "Done" then "completed" else "open"`
- **Type coercion**: string↔number↔boolean

### D2. OpenAPI importer: three levels using existing infrastructure

- **Level 1 (manual)**: User writes the `app.external.yaml` manifest by hand
- **Level 2 (codegen)**: A generator concept (like TypescriptGen, RustGen)
  that reads an OpenAPI/GraphQL spec and infers action mappings from
  HTTP method + path patterns (`POST /tasks` → `Task/create`). Uses the
  existing codegen pipeline.
- **Level 3 (process)**: A ProcessSpec with steps for each ambiguous mapping.
  Can be driven by LLM (via llm-process tools), agent, or human (via
  process-human approval steps). Uses the existing process automation suite.

### D3. End-to-end proof: real third-party API against existing concept

Build the full pipeline against a real external API that matches an existing
Clef concept. For example:
- **Article concept** (specs/app/article.concept) against **DEV.to API**
  (https://developers.forem.com/api/v1) — create/list/get/update/delete articles
- This proves the entire pipeline without inventing a new concept

The external handler for Article will use `perform('http', ...)` to call
DEV.to's REST endpoints, with field transforms mapping between Clef's
Article fields and DEV.to's API fields.

### D4. Webhook refactor: full migration to provider pattern

Replace the hardcoded `WebhookReceived` sync with the provider dispatch
pattern. **Migration includes:**
- Existing process automation syncs (`webhook-received.sync`,
  `webhook-step-dispatch.sync`) refactored to use WebhookDispatchProvider
- Clef Base seeds updated if any reference the old sync names
- Entity-reflection syncs (`webhook-inbox-as-config-entity.sync`) verified
  compatible with provider pattern
- The `step-run` provider preserves exact existing behavior — zero
  behavioral change for process automation users

### D5. Three-tier testing

**Tier 1: Structural (dry-run)** — runs in CI, no network, milliseconds
- ProgramInterpreter in `dry-run` mode records perform instructions
  without executing them
- Verifies: correct HTTP method, path, request body field mapping,
  auth headers, response transform structure
- Catches: field mapping bugs, wrong HTTP methods, missing auth

**Tier 2: Behavioral (mock provider)** — runs in CI, no network, fast
- Register a mock EffectHandler that returns canned response fixtures
  for each external endpoint
- Full round-trip: handler → StorageProgram → interpreter → mock HTTP →
  response transform → concept variant
- Catches: response transform bugs, error variant handling, null/empty
  edge cases, array mapping issues

**Tier 3: Integration (real API via ProcessSpec)** — on-demand/nightly, needs network + keys

Generate ProcessSpec from concept fixtures:
- Each fixture becomes a process step
- `after` chains become step dependencies
- `$fixture.field` references become step output bindings
- `-> notfound` / `-> error` annotations become CheckVerification assertions
- Step type = `external-call` using the ingest manifest

The generator reads the same fixtures used by conformance tests and emits
a ProcessSpec. Running it via `ProcessSpec/start` executes each step against
the real API. Results flow through CheckVerification with pass/fail status
visible in Clef Base admin UI.

```
Fixture: create_article { title: "Hello", body: "World" }
Fixture: get_created { id: $create_article.id } after create_article
Fixture: delete_it { id: $create_article.id } after create_article

Becomes ProcessSpec:
  Step 1: external-call Article/create { title: "Hello", body: "World" }
          → capture output.id
  Step 2: external-call Article/get { id: step1.id }
          → CheckVerification: variant == "ok"
  Step 3: external-call Article/delete { id: step1.id }
          → CheckVerification: variant == "ok"
```

Integration test results can gate deployments via StatusGate.

---

## The Ingest Manifest

### Format: `app.external.yaml`

```yaml
# External API sources mapped to Clef concepts
version: 1

sources:
  devto:
    displayName: DEV.to
    specUrl: https://developers.forem.com/api/v1/openapi.json
    specType: openapi
    baseUrl: https://dev.to/api
    auth:
      type: api-key
      header: api-key
      tokenRef: ${DEVTO_API_KEY}

    concepts:
      Article:
        actions:
          create:
            method: POST
            path: /articles
            request:
              title: article.title
              body: article.body_markdown
              tags: article.tags
            response:
              article: id
              title: title
              body: body_markdown
              slug: slug
          list:
            method: GET
            path: /articles/me/published
            response:
              _arrayRoot: true
              _itemTransform:
                article: id
                title: title
                body: body_markdown
                slug: slug
          get:
            method: GET
            path: /articles/{{id}}
            response:
              article: id
              title: title
              body: body_markdown
              slug: slug
          update:
            method: PUT
            path: /articles/{{id}}
            request:
              title: article.title
              body: article.body_markdown
            response:
              article: id
              title: title
          delete:
            method: DELETE
            path: /articles/{{id}}
            response: {}

    webhooks:
      - event: article.created
        mapsTo: Article/create
        fieldMapping:
          article: data.id
          title: data.title

    sync:
      direction: bidirectional
      interval: 300
      conflictStrategy: last-writer-wins
      idMapping:
        local: article
        remote: id
```

### Key design decisions:

- **`request` block** — concept field (left) → API field (right). Dot-notation
  for nested. `{{var}}` for URL template params.
- **`response` block** — API field (left) → concept field (right).
  `_arrayRoot` for direct array responses. `_itemTransform` for list items.
- **`webhooks` block** — maps inbound events to concept actions via
  WebhookDispatchProvider's concept-action provider.
- **`sync` block** — configures Replica: direction, interval, conflict
  strategy, ID field mapping.
- **Field transforms** — support dot paths, `[*]` array mapping, `[?filter]`
  conditional access, `if/then/else` value transforms.

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

### A2. OpenAPI/GraphQL spec importer (three levels)

**Level 1 — manual**: The `app.external.yaml` manifest itself.

**Level 2 — codegen generator:**

**File:** `specs/framework/api-spec-importer.concept`

A code generator concept (same pattern as TypescriptGen, RustGen) that reads
an OpenAPI/GraphQL/AsyncAPI spec and infers concept-to-endpoint mappings.

Actions:
- `import(specUrl, specType, targetConcept)` → ok(draftManifest, confidence)
- `importInline(specContent, specType, targetConcept)` → ok(draftManifest, confidence)
- `inferMappings(spec, conceptManifest)` → ok(mappings, confidence)
  Infer action mappings from HTTP method + path patterns:
  `POST /articles` → `Article/create`, `GET /articles/{id}` → `Article/get`

**Level 3 — process-driven:**

**File:** `repertoire/concepts/data-integration/api-mapping-process.concept`
(or ProcessSpec seed)

A ProcessSpec that walks through ambiguous mappings with steps for each
decision point. Each step can be resolved by:
- LLM (via llm-process tools — auto-suggest based on endpoint descriptions)
- Agent (via llm-agent tools — autonomous mapping with confidence thresholds)
- Human (via process-human approval steps — review and approve in Clef Base)

Uses the existing process automation suite: ProcessSpec, StepRun,
CheckVerification for validation.

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
Full expression language:

- **Dot-notation paths**: `data.items[0].name`
- **Array mapping**: `items[*].name` → map over all items, extract name field
- **Array filtering**: `items[?status=='active']` → filter array by predicate
- **Template substitution**: `{{id}}` → replaced from context
- **Conditional transforms**: `if value == "Done" then "completed" else "open"`
- **Type coercion**: `toString(id)`, `parseInt(count)`, `toBool(active)`
- **Null handling**: `value ?? "default"` — fallback for missing fields

Actions:
- `transformRequest(mapping, conceptInput)` → ok(apiPayload)
- `transformResponse(mapping, apiResponse)` → ok(conceptOutput)
- `validate(mapping)` → ok | invalid(errors)
- `parseExpression(expr)` → ok(ast) | invalid — parse a transform expression

### A6. Webhook dispatch provider pattern

**Existing:** `repertoire/concepts/process-automation/webhook-inbox.concept`
(unchanged — stays focused on receive/correlate/lifecycle)

**New concept:** `WebhookDispatchProvider`

**File:** `repertoire/concepts/process-automation/webhook-dispatch-provider.concept`

Purpose: Pluggable provider that handles dispatched webhook events.
Multiple providers register for different event types or sources.

Actions:
- `register(name, kind, eventTypes, config)` → ok | duplicate
- `dispatch(provider, event, payload)` → ok(result) | notfound | error

**Built-in provider kinds:**

| Kind | Provider | What it does | Status |
|------|----------|-------------|--------|
| `step-run` | StepRunProvider | Routes to StepRun/complete | Migrate from existing sync |
| `concept-action` | ConceptActionProvider | FieldTransform → concept action | New (for Bind) |
| `automation` | AutomationProvider | Routes to AutomationRule/evaluate | New |
| `forward` | ForwardProvider | Routes to ExternalCall/dispatch | New |

**Migration plan:**
1. Create WebhookDispatchProvider concept + handler
2. Create provider concepts for each kind (step-run, concept-action, etc.)
3. Create generic `WebhookDispatch` sync replacing `WebhookReceived`
4. Create provider registration syncs
5. Update `webhook-received.sync` to route through dispatch provider
6. Update `webhook-step-dispatch.sync` to use step-run provider
7. Verify `webhook-inbox-as-config-entity.sync` (entity-reflection) compatible
8. Update any Clef Base seeds referencing old sync names
9. Run existing process automation conformance tests to verify zero behavioral change

### A7. Fixture-to-ProcessSpec integration test generator

**File:** `specs/framework/integration-test-gen.concept`

Generate a ProcessSpec from concept spec fixtures for integration testing
against real external APIs.

Actions:
- `generate(conceptSpec, ingestManifest, source)` → ok(processSpec)
  Walk fixture `after` chains, emit a ProcessSpec where:
  - Each fixture = a process step
  - Step type = `external-call`
  - `$fixture.field` references = step output bindings
  - `-> error` / `-> notfound` annotations = CheckVerification assertions
  - Step dependencies = `after` chain order

- `run(processSpec)` → ok(results)
  Execute via ProcessSpec/start against the real API.
  Results flow through CheckVerification.
  Can gate deployments via StatusGate.

---

## Syncs

### SY1. Ingest manifest → Projection

**File:** `syncs/framework/ingest-to-projection.sync`

When IngestManifestParser/parse completes, create a reverse Projection
for each source+concept pair.

### SY2. External handler dispatch

**File:** `syncs/framework/external-handler-dispatch.sync`

When a concept action fires and the concept has a reverse/bidirectional
Projection, route through Projection/resolveForward → ExternalCall/dispatch.

### SY3. Webhook dispatch (replaces hardcoded WebhookReceived)

**File:** `syncs/framework/webhook-dispatch.sync`

WebhookInbox/receive → WebhookDispatchProvider/dispatch. Generic dispatch
that routes to the registered provider for that event type.

### SY4. Replica sync with external

**File:** `syncs/framework/replica-external-sync.sync`

Periodic sync: Replica/sync → Projection/resolveForward for pending
outbound ops, poll external API → Projection/resolveReverse for inbound.
Uses CausalClock + ConflictResolution.

### SY5. Provider registration syncs

**File:** `syncs/framework/register-webhook-providers.sync`

On kernel boot, register all built-in webhook dispatch providers:
step-run, concept-action, automation, forward.

### SY6. Integration test → ProcessSpec

**File:** `syncs/framework/integration-test-process.sync`

When IntegrationTestGen/generate completes, the ProcessSpec can be
started via ProcessSpec/start. CheckVerification results feed back
to the test report.

---

## End-to-End Proof: Article × DEV.to

### What we build:

1. **Ingest manifest** (`examples/conduit/app.external.yaml`) mapping the
   existing Article concept to DEV.to's REST API
2. **External handler** for Article using `perform('http', ...)` with
   DEV.to field transforms
3. **Three-tier tests:**
   - Tier 1: dry-run verifies correct HTTP calls emitted
   - Tier 2: mock provider tests full round-trip with canned DEV.to responses
   - Tier 3: ProcessSpec generated from Article fixtures, runs against
     real DEV.to API (needs `DEVTO_API_KEY`)

### Field mapping (Article concept → DEV.to API):

| Concept field | DEV.to API field | Direction |
|---------------|-----------------|-----------|
| article (ID) | id | both |
| title | title | both |
| body | body_markdown | both |
| slug | slug | response only |
| tags | tag_list | request: comma-join / response: split |

---

## Deployment Configuration

### Mode selection in `deploy.yaml`

```yaml
concepts:
  Article:
    # Mode 1: Local only (default)
    handler: article
    storage: local-sqlite

    # Mode 2: External only (DEV.to is the backend)
    handler: article-devto
    external:
      source: devto
      manifest: app.external.yaml

    # Mode 3: Hybrid (local + sync to DEV.to)
    handler: article
    storage: local-sqlite
    replica:
      enabled: true
      syncPair:
        source: devto
        manifest: app.external.yaml
        direction: bidirectional
        interval: 300
        conflictStrategy: last-writer-wins
```

---

## Implementation Order

1. **A5. Field transform engine** — needed by everything else
2. **A1. Ingest manifest parser** — parse the YAML format
3. **A3. Projection extensions** — resolveForward/resolveReverse
4. **A4. External handler generator** — produce handlers from manifests
5. **E2E. Article × DEV.to proof** — manifest + handler + tier 1-2 tests
6. **A2. API spec importer** — levels 1-3 (manual, codegen, process)
7. **A6. Webhook dispatch provider** — provider pattern + migration
8. **A7. Integration test generator** — fixture-to-ProcessSpec + tier 3
9. **SY1-SY6. Syncs** — wire everything together
10. **SY4. Replica sync** — offline-capable hybrid mode

---

## Traceability Matrix

| PRD Section | File | Status |
|-------------|------|--------|
| A1. Ingest manifest parser | `specs/framework/ingest-manifest-parser.concept` | pending |
| A1h. Parser handler | `handlers/ts/framework/ingest-manifest-parser.handler.ts` | pending |
| A2. API spec importer (L2 codegen) | `specs/framework/api-spec-importer.concept` | pending |
| A2h. Importer handler | `handlers/ts/framework/api-spec-importer.handler.ts` | pending |
| A2p. API mapping process (L3) | ProcessSpec seed or concept | pending |
| A3. Projection extensions | `bind/interface/concepts/projection.concept` | pending (extend) |
| A3h. Projection handler | `handlers/ts/framework/projection.handler.ts` | pending (extend) |
| A4. External handler gen | `specs/framework/external-handler-gen.concept` | pending |
| A4h. Gen handler | `handlers/ts/framework/external-handler-gen.handler.ts` | pending |
| A5. Field transform | `repertoire/concepts/data-integration/field-transform.concept` | pending |
| A5h. Transform handler | `handlers/ts/app/field-transform.handler.ts` | pending |
| A6. WebhookDispatchProvider | `repertoire/concepts/process-automation/webhook-dispatch-provider.concept` | pending |
| A6h. Dispatch provider handler | `handlers/ts/process-automation/webhook-dispatch-provider.handler.ts` | pending |
| A6p. ConceptActionProvider | `repertoire/concepts/process-automation/providers/concept-action-provider.concept` | pending |
| A6s. Dispatch sync | `repertoire/concepts/process-automation/syncs/webhook-dispatch.sync` | pending |
| A6m. Migrate WebhookReceived | `repertoire/concepts/process-automation/syncs/webhook-received.sync` | exists (migrate) |
| A6m2. Migrate WebhookStepDispatch | `repertoire/concepts/process-automation/syncs/webhook-step-dispatch.sync` | exists (migrate) |
| A6m3. Verify entity-reflection | `repertoire/concepts/entity-reflection/syncs/process/webhook-inbox-as-config-entity.sync` | exists (verify) |
| A7. Integration test gen | `specs/framework/integration-test-gen.concept` | pending |
| A7h. Gen handler | `handlers/ts/framework/integration-test-gen.handler.ts` | pending |
| E2E. DEV.to manifest | `examples/conduit/app.external.yaml` | pending |
| E2E. Article external handler | `handlers/ts/app/article-devto.handler.ts` | pending |
| E2E. Tier 1 tests (dry-run) | `tests/article-devto-structural.test.ts` | pending |
| E2E. Tier 2 tests (mock) | `tests/article-devto-behavioral.test.ts` | pending |
| E2E. Tier 3 ProcessSpec | `seeds/integration-tests/article-devto.process.yaml` | pending |
| SY1. Ingest → Projection | `syncs/framework/ingest-to-projection.sync` | pending |
| SY2. External dispatch | `syncs/framework/external-handler-dispatch.sync` | pending |
| SY3. Webhook dispatch | `syncs/framework/webhook-dispatch.sync` | pending |
| SY4. Replica external sync | `syncs/framework/replica-external-sync.sync` | pending |
| SY5. Register providers | `syncs/framework/register-webhook-providers.sync` | pending |
| SY6. Integration test process | `syncs/framework/integration-test-process.sync` | pending |
