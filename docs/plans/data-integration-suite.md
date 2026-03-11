# COPF Data Integration Kit

**Version 0.2.0 — 2026-02-23**

Extends the COPF Concept Library (v0.4.0, 54 concepts) with 10 new concepts for data capture, integration, enrichment, and bidirectional sync. Adds 59 provider plugins across 8 plugin types, plus a `federated` storage backend provider for the existing ContentStorage concept.

**Changes from v0.1.0:**
- **Pipeline eliminated.** Its responsibilities dissolve into sync chains (ordering), Queue (async/progress/pause), Provenance (map table/rollback), and Schema.associations (named config). See §Architecture: Why There Is No Pipeline Concept.
- **FederatedEntity eliminated.** Dissolves into a `federated` ContentStorage provider that routes remote fields through Connector and local fields through the default backend. See §Architecture: Federation as a Storage Backend.
- Net result: fewer concepts, same capabilities, no concept needs to know about another concept.

**Source analyses:**
- Drupal Feeds, Migrate API, External Entities
- Airbyte Protocol, Singer/Meltano, Apache NiFi
- Evernote/Readwise/MarkDownload capture patterns
- PostgreSQL FDW, Apollo Federation, Denodo
- OpenRefine, dbt, Splink entity resolution
- CRDTs (Automerge, Yjs), CouchDB/PouchDB sync
- Enterprise Integration Patterns (Hohpe & Woolf)
- Shipman & Marshall progressive formalization
- W3C PROV provenance model

**Design principles:**
- **No concept knows about another concept.** All coordination happens through syncs and EventBus dispatch. This is the non-negotiable rule from COPF's core architecture.
- Every concept declares which of its actions are **plugin-dispatched** vs. **built-in**. Plugin-dispatched actions delegate to registered providers via PluginRegistry.
- Providers are registered per-Schema via `Schema.associations.providers`, enabling different entity types to use different providers for the same concept.
- The universal pipeline — detect → extract → transform → enrich → validate → store → track — **emerges from sync chains**, not from an orchestrator concept.

**Total: 10 concepts, 8 plugin types, 59 provider implementations, 1 new ContentStorage provider.**

---

## Kit Declaration

```yaml
name: "@copf/data-integration"
version: 0.2.0
uses:
  "@copf/foundation":
    concepts: [ContentNode, ContentStorage, Property, TypeSystem, ContentParser, Intent]
  "@copf/classification":
    concepts: [Tag, Taxonomy, Schema]
  "@copf/infrastructure":
    concepts: [PluginRegistry, EventBus, Validator, Queue, Cache]
  "@copf/linking":
    concepts: [Reference, Relation]
  "@copf/query":
    concepts: [Query, SearchIndex]
  "@copf/automation":
    concepts: [Workflow, AutomationRule]
  "@copf/media":
    concepts: [FileManagement, MediaAsset]

concepts:
  - DataSource
  - Connector
  - Capture
  - FieldMapping
  - Transform
  - Enricher
  - SyncPair
  - DataQuality
  - Provenance
  - ProgressiveSchema

# New provider for existing concept (not a new concept):
extends:
  ContentStorage:
    new_provider: "federated"  # storage_backend plugin

pluginTypes:
  - connector_protocol     # Connector read/write implementations
  - capture_mode           # Capture method implementations
  - field_mapper           # FieldMapping strategy implementations
  - transform_plugin       # Transform operation implementations
  - enricher_plugin        # Enricher implementations
  - quality_rule           # DataQuality rule implementations
  - structure_detector     # ProgressiveSchema detector implementations
  - conflict_resolver      # SyncPair conflict resolution implementations

syncs:
  required:
    - capture-to-mapping.sync
    - mapping-to-transform.sync
    - transform-to-enrichment.sync
    - enrichment-to-validation.sync
    - validation-gates-storage.sync
    - all-actions-tracked.sync
  recommended:
    - progressive-schema-from-enrichment.sync
    - sync-pair-bidirectional.sync
    - capture-to-progressive-schema.sync
```

---

## Architecture

### The Concept-Provider Pattern

A concept's actions fall into two categories:

**Built-in actions** have fixed behavior defined by the concept itself. `Capture.subscribe()` always creates a recurring capture config — there's no reason to make this pluggable.

**Plugin-dispatched actions** delegate to a registered provider. `Connector.read()` must behave completely differently for REST vs. SQL vs. RSS — the concept defines the interface contract, PluginRegistry holds the implementations, and Schema.associations binds specific providers to specific entity types.

The wiring:

```
# 1. Concept declares a plugin type
Connector declares pluginType: "connector_protocol"
  interface: { read(query) → data, write(data), test() → bool, discover() → Schema }

# 2. Providers register with PluginRegistry
PluginRegistry.register("connector_protocol", "rest", RestConnectorPlugin)
PluginRegistry.register("connector_protocol", "graphql", GraphqlConnectorPlugin)
PluginRegistry.register("connector_protocol", "sql", SqlConnectorPlugin)

# 3. Schema.associations binds providers to entity types
Schema("ExternalProduct").associations.providers = {
  connector_protocol: "rest",
  enricher_plugin: ["auto_tag", "summary"],
  quality_rule: ["required_fields", "url_validator"],
  structure_detector: ["json_schema"]
}

# 4. At runtime, concept resolves provider from context
Connector.read(query, context={schema: "ExternalProduct"})
  → PluginRegistry.createInstance("connector_protocol", "rest", schema.config)
  → restInstance.read(query)
```

This mirrors Drupal's plugin manager pattern exactly: the Migrate API doesn't know about SQL or CSV — it calls `MigrateSourcePluginManager::createInstance($plugin_id)`. The Feeds module doesn't know about RSS or JSON — it calls `FetcherPluginManager::createInstance($fetcher_id)`.

---

### Why There Is No Pipeline Concept

An earlier version (v0.1.0) included a Pipeline concept that orchestrated stages. It was eliminated because it violated COPF's core rule: **no concept knows about another concept.** Pipeline wanted to reference Capture, Transform, Enricher, DataQuality, and ContentStorage — it was a God Concept in disguise.

Every responsibility Pipeline claimed already lives elsewhere:

| Pipeline responsibility | Where it actually lives |
|---|---|
| Stage ordering | **Sync chains** — declarative `sync A.complete → B.start` rules |
| Async execution | **Queue** — items are queued between stages |
| Progress tracking | **Queue** — tracks processed/total/errors per batch |
| Pause/resume | **Queue** — pause/resume the worker |
| Map table (source→dest IDs) | **Provenance** — already tracks entity lineage |
| Rollback | **Provenance** — reverse all writes from a batch timestamp |
| Named configuration | **Schema.associations** — binds providers to entity types |
| "Run now" trigger | **Capture.detect_changes** — starts the chain |
| Dry run | **Validator** — preview mode on the validation gate |

**How sync chains replace Pipeline:**

Instead of a Pipeline concept that calls other concepts, the integration flow is expressed entirely as syncs. Each sync fires through EventBus. Each step between syncs can be async via Queue.

```yaml
# The data integration flow as sync chain declarations:

# Stage 1: Capture detects changes, items enter the system
sync: capture-to-mapping
  when: Capture.itemCaptured(item)
  then: Queue.enqueue("integration", {item, next: "field_mapping"})

# Stage 2: Field mapping translates source→destination shape
sync: mapping-to-transform
  when: FieldMapping.applied(item)
  then: Queue.enqueue("integration", {item, next: "transform"})

# Stage 3: Transforms clean/convert individual values
sync: transform-to-enrichment
  when: Transform.complete(item)
  then: Queue.enqueue("integration", {item, next: "enrichment"})

# Stage 4: Enrichers augment with AI/API metadata
sync: enrichment-to-validation
  when: Enricher.enriched(item)
  then: Queue.enqueue("integration", {item, next: "validation"})

# Stage 5: Validation gates entry — pass or quarantine
sync: validation-gates-storage
  when: DataQuality.validated(item, result)
  then:
    if result.valid: ContentStorage.save(item)
    if !result.valid: DataQuality.quarantine(item, result.violations)

# Cross-cutting: every action generates provenance
sync: all-actions-tracked
  when: [Capture.*, FieldMapping.*, Transform.*, Enricher.*, DataQuality.*, ContentStorage.save]
  then: Provenance.record(event)
```

**What "named configuration" looks like without Pipeline:**

The combination of a Schema + its associated providers + the universal sync chain *is* the pipeline. There is no separate pipeline object to configure. You configure the Schema:

```yaml
Schema: "WordPressPost"
  fields: [title, body, author, published_date, tags, category]
  associations:
    providers:
      connector_protocol: "rss"
      capture_mode: "api_poll"
      field_mapper: "jsonpath"
      transform_plugin: ["html_to_markdown", "slugify", "date_format"]
      enricher_plugin: ["auto_tag", "auto_summarize", "ner_extract"]
      quality_rule: ["required", "no_duplicates", "freshness"]
      structure_detector: ["date_detector", "tag_detector", "ner_detector"]
      conflict_resolver: "field_merge"
    capture_config:
      source: "wordpress_blog"
      schedule: "*/30 * * * *"    # Every 30 minutes
      mode: "api_poll"
```

The sync chains are universal — they work for *any* Schema. What varies per-Schema is which providers run at each stage. An Article gets different enrichers than a MediaAsset, but the flow (capture → map → transform → enrich → validate → store → track) is the same sync chain for both.

**Batch operations** work through Queue. `Capture.detect_changes` puts N items into the queue. Queue workers process items through the sync chain. Queue tracks progress (47/200 processed, 3 errors). Queue supports pause/resume. This is exactly how Drupal's Batch API and Queue API work — there's no separate "pipeline runner."

---

### Federation as a Storage Backend

An earlier version (v0.1.0) included a FederatedEntity concept. It was eliminated because its job is really a *storage strategy*, not a separate entity concept. Drupal's External Entities module proves this: remote data uses the same entity API as local data — only the storage backend differs.

**The `federated` storage backend** is a new provider for the existing ContentStorage concept's `storage_backend` plugin type. It uses the decorator pattern: internally it routes fields to either a remote backend (via Connector) or a local backend (via the default sql provider) based on field configuration.

```
ContentStorage.load(id, schema="WikipediaArticle")
  → PluginRegistry.createInstance("storage_backend", "federated", config)
  → FederatedStorageBackend:
      remote_fields [title, body, categories]
        → Connector.read(id)           # via sync
        → FieldMapping.apply(result)   # via sync
        → Cache.set(result, ttl=3600)  # via sync
      local_fields [internal_notes, quality_score, our_tags]
        → SqlStorageBackend.load(id)   # standard local storage
      → merge remote + local → return ContentNode
```

**Configuration via Schema.associations:**

```yaml
Schema: "WikipediaArticle"
  fields:
    # Remote fields (read from API, cached)
    - title: { type: string, storage: remote }
    - body: { type: richtext, storage: remote }
    - categories: { type: list<string>, storage: remote }
    # Local fields (stored locally, never sent to remote)
    - internal_notes: { type: richtext, storage: local }
    - quality_score: { type: float, storage: local }
    - our_tags: { type: list<Tag>, storage: local }
  associations:
    storage_backend: "federated"
    providers:
      connector_protocol: "rest"
    federation_config:
      source: "wikipedia_api"
      field_mapping: "wikipedia_jsonpath"
      cache_ttl: 3600
      read_only_remote: true        # Remote fields are read-only
      local_fields: ["internal_notes", "quality_score", "our_tags"]
```

**What this gives you:**

- A `WikipediaArticle` entity **is a ContentNode** — it works with Views, References, Search, Workflows, everything
- CRUD operations transparently hit the right backend per field
- Local annotations extend remote entities without modifying the source
- The `copf_remote` connector enables federation between COPF instances — schemas are shared, field mappings are identity, and full bidirectional sync is possible via SyncPair
- No concept knows about any other concept — the sync chain and Schema.associations wire everything

**The sync wiring for federation:**

```yaml
sync: federated-load-remote
  when: ContentStorage.loadRequested(id, schema) AND schema.storage_backend == "federated"
  then: Connector.read({id, source: schema.federation_config.source})

sync: federated-apply-mapping
  when: Connector.readComplete(data, context={federated: true})
  then: FieldMapping.apply(data, schema.federation_config.field_mapping)

sync: federated-cache
  when: FieldMapping.applied(data, context={federated: true})
  then: Cache.set(data, ttl=schema.federation_config.cache_ttl)

sync: federated-save-remote
  when: ContentStorage.saveRequested(node, schema) AND schema.storage_backend == "federated"
  then:
    remote_fields: FieldMapping.reverse(node) → Connector.write(data)
    local_fields: SqlStorageBackend.save(node.local_fields)
```

---

## Concept Specifications

### 1. DataSource

*Represents an external system available for data operations.*

**Purpose:** Register, authenticate, and monitor external data systems so that other concepts (Connector, Capture) can reference them by name rather than embedding connection details.

- **State:** `sources: Map<SourceID, {name: String, uri: URI, credentials: CredentialRef, discoveredSchema: Schema?, status: {active|inactive|error|discovering}, lastHealthCheck: Timestamp, metadata: Map<String, Value>}>`
- **Actions (all built-in):**
  - `register(name, uri, credentials)` — add a new source
  - `connect(sourceId) → ConnectionResult` — verify the source is reachable
  - `discover(sourceId) → RawSchema` — introspect the source's data model (emits event; does NOT call Connector directly)
  - `healthCheck(sourceId) → HealthStatus` — periodic availability check
  - `deactivate(sourceId)` — mark source unavailable without deleting config
- **Op principle:** "After registering a source and connecting to verify availability, discover its schema; the source is then addressable by name from any configuration that needs an external endpoint."

**No plugin type.** DataSource is a registry. It emits events; syncs wire them to Connector and Schema.

**Syncs:**
```yaml
sync: source-discovery-wiring
  when: DataSource.discover(sourceId)
  then: Connector.discover(sourceId)  # Connector does the protocol-specific work

sync: discovery-to-schema
  when: Connector.discoveryComplete(sourceId, rawSchema)
  then: Schema.defineSchema(rawSchema)  # Discovered schema becomes a COPF Schema

sync: health-check-scheduling
  when: Queue.processItem("health_check", {sourceId})
  then: DataSource.healthCheck(sourceId)
```

---

### 2. Connector

*Provides a uniform read/write interface to diverse external systems.*

**Purpose:** Abstract away protocol differences so that Captures, federation storage backends, and sync operations all interact with external data through the same interface regardless of whether the backend is REST, SQL, GraphQL, file system, or message queue.

- **State:** `connectors: Map<ConnectorID, {sourceId: SourceRef, protocolId: PluginID, config: Map<String, Value>, status: {idle|reading|writing|error}}>`
- **Actions:**
  - `read(query, options?) → DataStream` — **plugin-dispatched** to `connector_protocol`
  - `write(data, options?) → WriteResult` — **plugin-dispatched** to `connector_protocol`
  - `test() → bool` — **plugin-dispatched** to `connector_protocol`
  - `discover() → RawSchema` — **plugin-dispatched** to `connector_protocol`
  - `configure(sourceId, protocolId, config)` — built-in, creates a connector instance
- **Op principle:** "After configuring a connector with a source and protocol, read and write operations delegate to the protocol provider; callers never need to know whether data comes from a REST API, database, or file."

#### Plugin type: `connector_protocol`

**Interface contract:**
```
read(query: QuerySpec, config: ConnectorConfig) → AsyncIterator<Record>
write(records: Iterator<Record>, config: ConnectorConfig) → WriteResult{created, updated, skipped, errors}
test(config: ConnectorConfig) → {connected: bool, message: String}
discover(config: ConnectorConfig) → {streams: List<StreamDef{name, schema, supportedSyncModes}>}
```

**Providers (14 + 4 CDC sub-providers):**

| Provider ID | Description | Sync modes | Reference impl |
|---|---|---|---|
| `rest` | Generic REST API with pagination, auth, rate limiting | full_refresh, incremental (cursor/offset) | Airbyte HTTP source |
| `graphql` | GraphQL queries with variable binding and pagination | full_refresh, incremental | Apollo client |
| `sql` | SQL databases via connection string (Postgres, MySQL, SQLite) | full_refresh, incremental, cdc | Airbyte DB sources |
| `rss` | RSS/Atom feed parsing | full_refresh, incremental (guid) | Drupal Feeds fetcher |
| `csv` | CSV/TSV file reading and writing | full_refresh | Drupal Migrate CSV source |
| `json_file` | JSON/JSONL file or URL reading | full_refresh | Drupal Migrate JSON source |
| `xml` | XML with XPath extraction | full_refresh | Drupal Migrate XML source |
| `ftp` | FTP/SFTP file listing and download | full_refresh | NiFi GetSFTP |
| `s3` | AWS S3 / compatible object storage | full_refresh, incremental (modified) | Airbyte S3 source |
| `webhook_receiver` | Inbound webhook endpoint that queues payloads | push (event-driven) | n8n webhook trigger |
| `email_imap` | IMAP mailbox reading | incremental (UID) | NiFi ConsumeIMAP |
| `websocket` | WebSocket streaming connection | streaming | NiFi ListenWebSocket |
| `copf_remote` | Another COPF instance's API (concept-native) | full_refresh, incremental, cdc, bidirectional | Custom |
| `odata` | OData v4 protocol for standardized CRUD | full_refresh, incremental, crud | OData spec |

**CDC sub-providers** (registered under `sql` connector with config flags):

| Sub-provider | Mechanism | Reference |
|---|---|---|
| `cdc_wal` | PostgreSQL WAL via Debezium | Debezium Postgres connector |
| `cdc_binlog` | MySQL binlog via Debezium | Debezium MySQL connector |
| `cdc_timestamp` | Polling with `updated_at` high-water mark | Drupal Migrate high-water |
| `cdc_hash` | Row hash comparison for systems without timestamps | Drupal Feeds hash comparison |

---

### 3. Capture

*Detects and ingests data from any source into the system.*

**Purpose:** Provide a universal "save this" action — whether clipping a web page, importing a file, subscribing to a feed, or detecting changes in an external system — that gets content into the system with source metadata. Capture is the entry point; syncs handle what happens next.

- **State:** `inbox: Queue<CaptureItem{id, content, sourceMetadata: {title, url, capturedAt, contentType, author, tags[], source, publishedDate, note}, status: {new|processing|stored|failed}}>`, `subscriptions: Map<SubID, {sourceId, schedule, captureMode, lastRun, watermark}>`, `hashes: Map<SourceID, Map<ItemID, Hash>>`
- **Actions:**
  - `clip(url, mode, metadata?)` — **plugin-dispatched** to `capture_mode`
  - `import(file, options?)` — **plugin-dispatched** to `capture_mode`
  - `subscribe(sourceId, schedule, mode)` — built-in, creates a recurring capture subscription
  - `detect_changes(subscriptionId) → Changeset` — built-in, uses watermark/hash comparison to find new/changed items, emits `itemCaptured` for each
  - `markReady(itemId)` — built-in, transitions item from `new` to `processing`; sync chain takes over
- **Op principle:** "Clip a web page, import a file, or subscribe to a feed; content arrives with source metadata and status `new`; `detect_changes` compares watermarks/hashes to find only new or changed items; each captured item emits an event that the sync chain picks up for downstream processing."

**What Capture does NOT do:** It does not call Pipeline, Transform, Enricher, or any other concept. It captures and emits. Syncs handle the rest.

#### Plugin type: `capture_mode`

**Interface contract:**
```
capture(input: CaptureInput, config: CaptureConfig) → CaptureItem{content, sourceMetadata, rawData?}
supports(input: CaptureInput) → bool
```

**Providers (9):**

| Provider ID | Description | Input type | Reference impl |
|---|---|---|---|
| `web_article` | Extract article content via Readability algorithm | URL | Evernote "Article" mode |
| `web_full_page` | Full HTML snapshot including styles and images | URL | Evernote "Full Page" mode |
| `web_bookmark` | Metadata-only capture (title, URL, description, favicon) | URL | Evernote "Bookmark" mode |
| `web_screenshot` | Visual screenshot of URL or selection | URL / selection | Evernote "Screenshot" mode |
| `web_markdown` | HTML → Markdown via Turndown with YAML frontmatter | URL | MarkDownload |
| `file_upload` | Direct file ingestion with MIME detection | File | Standard upload |
| `email_forward` | Parse forwarded email into structured content + attachments | Email (RFC 2822) | Help desk pattern |
| `api_poll` | Periodic API query with delta detection | API endpoint | Drupal Feeds |
| `share_intent` | Mobile/OS share sheet receiver | OS share data | iOS/Android share extensions |

---

### 4. FieldMapping

*Defines correspondence between source and destination schemas.*

**Purpose:** Translate field names, paths, and structures between an external source's data model and COPF's Schema so that data flows into the right properties on the right content types.

- **State:** `mappings: Map<MappingID, {name, sourceSchema: SchemaRef, destSchema: SchemaRef, rules: List<MappingRule{sourceField, destField, transform?: TransformRef, default?: Value}>, unmapped: {source: List<Field>, dest: List<Field>}}>`
- **Actions:**
  - `map(sourceField, destField, transform?)` — built-in, adds a mapping rule
  - `apply(record, mappingId) → MappedRecord` — **plugin-dispatched** to `field_mapper` (for path resolution)
  - `reverse(record, mappingId) → SourceRecord` — built-in, inverts the mapping for write-back
  - `auto_discover(sourceSchema, destSchema) → SuggestedMappings` — built-in, name similarity + type compatibility
  - `validate(mappingId) → List<Warning>` — built-in, checks type mismatches, unmapped required fields
- **Op principle:** "Map source fields to destination fields with optional transforms; `apply` resolves source paths using the mapper strategy (direct, JSONPath, XPath, regex), applies transforms, and returns a destination-shaped record; `reverse` inverts for write-back to remote sources."

#### Plugin type: `field_mapper`

**Interface contract:**
```
resolve(record: RawRecord, sourcePath: String, config: MapperConfig) → Value
supports(pathSyntax: String) → bool
```

**Providers (6):**

| Provider ID | Description | Path syntax | Reference impl |
|---|---|---|---|
| `direct` | Direct key→key mapping, dot notation for nesting | `field`, `nested.field` | Drupal Feeds simple mapping |
| `jsonpath` | JSONPath expressions for complex JSON navigation | `$.store.books[*].title` | Drupal External Entities JSONPath mapper |
| `xpath` | XPath expressions for XML sources | `//item/title/text()` | Drupal Migrate XML source |
| `regex` | Regex capture groups extracting values from strings | `/Price: \$(\d+\.\d+)/` | OpenRefine GREL |
| `template` | String interpolation with multiple field references | `{first_name} {last_name}` | Drupal Migrate concat plugin |
| `computed` | Arbitrary expression via ExpressionLanguage | `price * quantity * (1 + tax_rate)` | Drupal Migrate callback plugin |

---

### 5. Transform

*Modifies data values from one form to another.*

**Purpose:** Convert, clean, format, split, merge, or otherwise transform individual field values as they flow through the sync chain, composable into chains where each transform's output feeds the next.

- **State:** `transforms: Map<TransformID, {name, pluginId: PluginID, config: Map<String, Value>, inputType: TypeSpec, outputType: TypeSpec}>`
- **Actions:**
  - `apply(value, transformId) → TransformedValue` — **plugin-dispatched** to `transform_plugin`
  - `chain(transformIds[]) → ChainedResult` — built-in, composes transforms sequentially
  - `preview(value, transformId) → Preview{before, after}` — built-in, wraps apply for UI
- **Op principle:** "Apply a transform to convert a value; chain transforms where each output becomes the next input; the chain stops and reports an error if any transform fails type checking."

#### Plugin type: `transform_plugin`

**Interface contract:**
```
transform(value: Any, config: TransformConfig) → Any
inputType() → TypeSpec
outputType() → TypeSpec
```

**Providers (16):**

| Provider ID | Description | Example |
|---|---|---|
| `type_cast` | Cast between types (string→int, date→timestamp) | `"42" → 42` |
| `default_value` | Provide fallback when source is null/empty | `null → "Untitled"` |
| `lookup` | Map values via lookup table | `"US" → "United States"` |
| `migration_lookup` | Resolve IDs from a previous import's Provenance map table | `old_author_id → new_uuid` |
| `concat` | Merge multiple values into one string | `["John", "Doe"] → "John Doe"` |
| `split` | Split string into array | `"red,blue" → ["red", "blue"]` |
| `format` | String formatting/interpolation | `"{first} {last}" → "John Doe"` |
| `slugify` | Generate URL-safe slug from text | `"Hello World!" → "hello-world"` |
| `html_to_markdown` | Convert HTML to Markdown | `<b>bold</b> → **bold**` |
| `markdown_to_html` | Convert Markdown to HTML | `**bold** → <b>bold</b>` |
| `strip_tags` | Remove HTML tags, optionally keep allowlist | `<p>text</p> → "text"` |
| `truncate` | Limit string length with ellipsis | `"long text..." → "long t..."` |
| `regex_replace` | Pattern-based string replacement | `s/\d{4}/XXXX/` |
| `date_format` | Parse and reformat dates between formats | `"2026-02-23" → "Feb 23, 2026"` |
| `json_extract` | Extract value from JSON string at path | `'{"a":1}' @ "$.a" → 1` |
| `expression` | Arbitrary expression via ExpressionLanguage | `price * 1.1` |

---

### 6. Enricher

*Augments data with additional information from AI models, APIs, or reference data.*

**Purpose:** Attach machine-generated metadata — OCR text, captions, transcriptions, entity extractions, classifications, summaries — to content items, with confidence scores and human review status.

- **State:** `enrichments: Map<ItemID, List<Enrichment{enricherId, pluginId, result: Value, confidence: Float, status: {suggested|accepted|rejected|stale}, generatedAt: Timestamp}>>`, `triggers: Map<EnricherID, {pluginId, triggerMode: {on_create|on_update|on_schedule|on_demand|lazy}, appliesTo: List<SchemaRef>, config: Map<String, Value>}>`
- **Actions:**
  - `enrich(item, enricherId?) → EnrichedItem` — **plugin-dispatched** to `enricher_plugin`
  - `suggest(item) → List<Enrichment>` — built-in, runs all applicable enrichers and returns results as suggestions
  - `accept(itemId, enrichmentId)` — built-in, promotes suggestion to accepted
  - `reject(itemId, enrichmentId)` — built-in, marks suggestion rejected
  - `refreshStale(olderThan: Duration)` — built-in, re-runs enrichers where models have improved
- **Op principle:** "When triggered, the enricher processes the item through its plugin and attaches results as suggestions with confidence scores; suggestions become part of the item's data only when accepted (auto-accept above configurable threshold); stale enrichments can be refreshed when models improve."

#### Plugin type: `enricher_plugin`

**Interface contract:**
```
enrich(item: ContentItem, config: EnricherConfig) → EnrichmentResult{fields: Map<String, Value>, confidence: Float, metadata: Map<String, Value>}
appliesTo(schema: Schema) → bool
costEstimate(item: ContentItem) → {tokens?: Int, apiCalls?: Int, duration?: Duration}
```

**Providers (12):**

| Provider ID | Description | Input → Output |
|---|---|---|
| `ocr_tesseract` | Local OCR via Tesseract | image → extracted_text |
| `ocr_cloud` | Cloud OCR (AWS Textract, Google Vision) | image/PDF → structured_text + tables + forms |
| `vlm_caption` | Vision-Language Model image captioning | image → caption + description + detected_objects[] |
| `whisper_transcribe` | Audio/video transcription with timestamps | audio/video → transcript{segments[]{text, start, end}} |
| `video_summary` | Video summarization from transcript + keyframes | video → summary + chapters[] + keyframes[] |
| `ner_extract` | Named Entity Recognition | text → entities[]{text, type, start, end, confidence} |
| `auto_tag` | Classify content into existing taxonomy terms | text → tags[]{term, taxonomy, confidence} |
| `auto_summarize` | Generate text summary at configurable length | text → summary{short, medium, long} |
| `sentiment` | Sentiment analysis | text → {sentiment: pos/neg/neutral, score} |
| `language_detect` | Detect content language | text → {language: ISO639, confidence} |
| `exif_extract` | Extract image EXIF metadata | image → {camera, lens, gps, datetime, dimensions} |
| `llm_structured_extract` | Extract structured data via LLM + target schema | text + schema → structured_record |

**The `llm_structured_extract` provider** is how "take a blog post and extract tags into our taxonomy" works:

```yaml
enricher: llm_structured_extract
config:
  target_schema: "BlogPost"
  instructions: "Extract structured fields from this blog post"
  model: "claude-sonnet"
  auto_accept_threshold: 0.9
```

---

### 7. SyncPair

*Maintains bidirectional correspondence between records in two systems.*

**Purpose:** Keep data synchronized across two endpoints — local↔remote, COPF↔API, COPF↔COPF — with configurable direction, conflict detection via version vectors, and pluggable conflict resolution.

- **State:** `pairs: Map<PairID, {name, endpointA: ConnectorRef, endpointB: ConnectorRef, direction: {a_to_b|b_to_a|bidirectional}, conflictPolicy: PluginID, mapping: FieldMappingRef, pairMap: Map<ID_A, ID_B>, versionVectors: Map<ID, VersionVector>, changeLog: List<ChangeEvent{pairId, entityId, endpoint, operation, timestamp, originId}>, status: {idle|syncing|conflict|error}}>`
- **Actions:**
  - `link(idA, idB)` — built-in, establish correspondence
  - `sync(pairId?)` — built-in, detect changes on both sides, propagate per direction
  - `detect_conflicts(pairId) → List<Conflict>` — built-in, compare version vectors
  - `resolve(conflictId, resolution?)` — **plugin-dispatched** to `conflict_resolver`
  - `unlink(idA)` — built-in, remove correspondence without deleting data
  - `getChangeLog(pairId, since?) → List<ChangeEvent>` — built-in
- **Op principle:** "After linking records between endpoints, sync detects changes on each side via version vectors; non-conflicting changes propagate per direction; conflicts dispatch to the configured resolver; the originId on each change event prevents sync loops (skip changes that originated locally)."

#### Plugin type: `conflict_resolver`

**Interface contract:**
```
resolve(conflict: Conflict{entityId, versionA, versionB, ancestor?}, config) → Resolution{winner, strategy, details}
canAutoResolve(conflict: Conflict) → bool
```

**Providers (5):**

| Provider ID | Description | Auto-resolve? |
|---|---|---|
| `lww_timestamp` | Last-Write-Wins by timestamp. Risk: silent data loss | Always |
| `field_merge` | Per-field comparison: auto-merge non-conflicting, flag true conflicts | Partial |
| `three_way_merge` | Diff both against common ancestor. Most accurate | Partial |
| `crdt_merge` | CRDT-based mathematically guaranteed conflict-free merge | Always |
| `manual_queue` | Store both versions, present to user for resolution | Never |

---

### 8. DataQuality

*Validates data and enforces quality standards.*

**Purpose:** Gate data flow with configurable validation rules, quarantine invalid items for review, profile datasets for statistical understanding, and reconcile values against external knowledge bases.

- **State:** `rulesets: Map<RulesetID, {name, rules: List<RuleRef>, appliesTo: SchemaRef}>`, `violations: List<Violation{itemId, ruleId, field, message, severity: {error|warning|info}}>`, `quarantine: Map<ItemID, {item, violations, quarantinedAt}>`, `qualityScores: Map<ItemID, {overall: Float, dimensions: Map<DimensionID, Float>}>`
- **Actions:**
  - `validate(item, rulesetId?) → ValidationResult` — **plugin-dispatched** to `quality_rule` (runs all applicable rules)
  - `quarantine(itemId, violations)` — built-in, holds item for review
  - `release(itemId)` — built-in, re-emits item into sync chain
  - `profile(datasetQuery) → DatasetProfile` — built-in, statistical overview
  - `reconcile(field, knowledgeBase) → List<Match>` — built-in, matches against external KBs
  - `deduplicate(query, strategy?) → List<DuplicateCluster>` — built-in, configurable similarity
- **Op principle:** "Apply validation rules to each item; valid items proceed via sync chain; invalid items are quarantined with violation details; quarantined items can be corrected and released back into the chain; reconcile matches values against Wikidata or other authorities."

#### Plugin type: `quality_rule`

**Interface contract:**
```
validate(value: Any, field: FieldDef, record: Record, config: RuleConfig) → RuleResult{valid, message?, severity}
appliesTo(field: FieldDef) → bool
dimension() → QualityDimension
```

**Providers (11):**

| Provider ID | Dimension | Description |
|---|---|---|
| `required` | completeness | Field must not be null/empty |
| `unique` | uniqueness | Value must be unique across all records of this type |
| `type_check` | validity | Value must match declared type |
| `range` | validity | Numeric value within min/max bounds |
| `pattern` | validity | String matches regex pattern |
| `enum` | validity | Value must be in allowed set |
| `foreign_key` | consistency | Referenced entity must exist |
| `cross_field` | consistency | Multi-field rules (end_date > start_date) |
| `freshness` | timeliness | Data must be newer than threshold |
| `no_duplicates` | uniqueness | Record-level dedup via configurable field comparison |
| `reconciliation` | accuracy | Value matches external knowledge base above threshold |

---

### 9. Provenance

*Tracks origin and transformation history of every data item.*

**Purpose:** Record the complete lineage of every piece of data — where it came from, what happened to it, who initiated each operation — so that any item can be traced back to its origin, audited, rolled back, and reproduced.

- **State:** `records: List<ProvenanceRecord{id, entity: EntityRef, activity: {type: String, concept: String, action: String, config: Map}, agent: {type: {user|system|enricher}, id: String}, inputs: List<EntityRef>, timestamp: Timestamp, batchId: BatchID?}>`, `mapTables: Map<BatchID, Map<SourceID, {destId, sourceHash, importedAt}>>`
- **Actions (all built-in):**
  - `record(entity, activity, agent, inputs?)` — log a provenance event
  - `trace(entityId) → ProvenanceChain` — follow derivations back to origin
  - `audit(batchId) → LineageGraph` — full batch lineage DAG
  - `rollback(batchId)` — reverse all writes from a batch using the map table
  - `diff(entityId, version1, version2) → FieldDiff` — what changed between versions
  - `reproduce(entityId) → ReproductionPlan` — steps to recreate from source
- **Op principle:** "After every data operation — capture, transform, enrich, validate, store — a provenance record is created via sync; trace follows derivation links back to the original source; the map table connects source IDs to destination IDs, enabling rollback of an entire batch."

**No plugin type.** Provenance records everything. It's wired via the cross-cutting `all-actions-tracked` sync:

```yaml
sync: all-actions-tracked
  when: Capture.itemCaptured OR FieldMapping.applied OR Transform.complete
        OR Enricher.enriched OR DataQuality.validated OR ContentStorage.saved
        OR SyncPair.synced
  then: Provenance.record({entity, activity: event.source, agent: event.initiator})
```

**Rollback** uses the map table: `Provenance.rollback("batch_2026-02-23_001")` iterates all `destId` entries for that batch and calls `ContentStorage.delete(destId)` for each. This is exactly how Drupal Migrate's rollback works.

---

### 10. ProgressiveSchema

*Allows data structure to emerge incrementally from freeform to fully typed.*

**Purpose:** Accept content at any formality level — raw text, lightly tagged, partially structured, fully typed — and help users incrementally formalize it by detecting implicit structure and suggesting schema promotions, without ever requiring upfront commitment.

- **State:** `items: Map<ItemID, {content: Any, formality: {freeform|inline_metadata|typed_properties|schema_conformant}, detectedStructure: List<StructureSuggestion{detectorId, field, value, confidence, status: {pending|accepted|rejected}}>, schema: SchemaRef?, promotionHistory: List<{from, to, timestamp}>}>`
- **Actions:**
  - `capture_freeform(content)` — built-in, stores content at formality=freeform
  - `detect_structure(itemId) → List<StructureSuggestion>` — **plugin-dispatched** to `structure_detector` (runs all applicable detectors)
  - `accept_suggestion(itemId, suggestionId)` — built-in, promotes detected value to typed property
  - `reject_suggestion(itemId, suggestionId)` — built-in
  - `promote(itemId, targetSchema) → PromotionResult` — built-in, attempt full schema conformance, report gaps
  - `infer_schema(items[]) → ProposedSchema` — built-in, analyze items to propose common schema
- **Op principle:** "Capture freeform content; structure detectors identify dates, tags, entities, patterns, and key-value pairs, presenting suggestions with confidence; accepting suggestions adds typed properties; promote attempts full schema conformance; infer_schema analyzes multiple items to propose a shared type."

#### Plugin type: `structure_detector`

**Interface contract:**
```
detect(content: Any, existingStructure: Map<String, Value>, config: DetectorConfig) → List<Detection{field, value, type, confidence, evidence}>
appliesTo(contentType: String) → bool
```

**Providers (10):**

| Provider ID | Description | Detects |
|---|---|---|
| `date_detector` | Find date/time patterns in text | dates, times, durations, relative dates |
| `tag_detector` | Find #hashtags and @mentions inline | tags, person references |
| `url_detector` | Find URLs, emails, phone numbers | urls, emails, phones |
| `kv_detector` | Find `key: value` patterns in text | typed properties from freeform notes |
| `ner_detector` | Named entity recognition | person, location, organization, event entities |
| `table_detector` | Detect tabular structure in text or HTML | rows, columns, headers |
| `json_schema_detector` | Infer typed schema from JSON/CSV data | field names, types, cardinality, nullability |
| `list_detector` | Detect enumerated/bulleted lists | list items, nesting structure |
| `code_detector` | Detect code blocks and language | language, code content |
| `llm_detector` | Use LLM to detect arbitrary structure given a hint | any structure described in natural language |

---

## The `federated` ContentStorage Provider

This is NOT a new concept. It is a new provider for the existing `storage_backend` plugin type on ContentStorage.

**Provider ID:** `federated`

**What it does:** Routes field reads/writes to either a remote backend (via Connector + FieldMapping + Cache) or the local sql backend, based on per-field configuration in Schema.

**Interface (same as any storage_backend):**
```
save(node: ContentNode, schema: Schema) → SaveResult
load(id: NodeID, schema: Schema) → ContentNode
loadMultiple(ids: List<NodeID>, schema: Schema) → List<ContentNode>
delete(id: NodeID, schema: Schema) → DeleteResult
query(conditions, sorts, range, schema: Schema) → List<ContentNode>
```

**Internal behavior:**

```
load(id, schema):
  remote_fields = schema.fields.where(storage == "remote")
  local_fields = schema.fields.where(storage == "local")

  # Check cache first
  cached = Cache.get(schema.name, id)
  if cached AND !expired:
    remote_data = cached
  else:
    # Emit event → sync wiring calls Connector.read → FieldMapping.apply
    remote_data = EventBus.dispatch("federated.load_remote", {id, schema})
    Cache.set(schema.name, id, remote_data, ttl=schema.federation_config.cache_ttl)

  local_data = SqlBackend.load(id)  # Standard local storage for local fields
  return merge(remote_data, local_data)

save(node, schema):
  local_fields = extract(node, schema.local_fields)
  SqlBackend.save(id, local_fields)

  if NOT schema.federation_config.read_only_remote:
    remote_fields = extract(node, schema.remote_fields)
    # Emit event → sync wiring calls FieldMapping.reverse → Connector.write
    EventBus.dispatch("federated.save_remote", {id, remote_fields, schema})
```

**Configuration example — read-only federation:**

```yaml
Schema: "WikipediaArticle"
  associations:
    storage_backend: "federated"
    providers:
      connector_protocol: "rest"
      field_mapper: "jsonpath"
    federation_config:
      source: "wikipedia_api"
      cache_ttl: 3600
      read_only_remote: true
      local_fields: ["internal_notes", "quality_score", "our_tags"]
```

**Configuration example — bidirectional COPF-to-COPF:**

```yaml
Schema: "SharedTask"
  associations:
    storage_backend: "federated"
    providers:
      connector_protocol: "copf_remote"
      field_mapper: "direct"          # Identity mapping — same concept library
      conflict_resolver: "crdt_merge"
    federation_config:
      source: "partner_copf_instance"
      cache_ttl: 60
      read_only_remote: false
      local_fields: ["private_notes"]
```

---

## Complete Sync Wiring

### The integration flow (replaces Pipeline)

```yaml
# ─── CAPTURE STAGE ───
# Capture emits itemCaptured. Queue picks it up for async processing.
sync: capture-enters-queue
  when: Capture.itemCaptured(item)
  then: Queue.enqueue("integration", {item, stage: "field_mapping"})

# ─── FIELD MAPPING STAGE ───
# Queue worker dispatches to FieldMapping based on Schema.associations
sync: queue-dispatches-mapping
  when: Queue.itemReady("integration", {stage: "field_mapping"})
  then: FieldMapping.apply(item, schema.associations.field_mapper)

sync: mapping-to-transform
  when: FieldMapping.applied(item)
  then: Queue.enqueue("integration", {item, stage: "transform"})

# ─── TRANSFORM STAGE ───
# Runs the transform chain configured in Schema.associations
sync: queue-dispatches-transform
  when: Queue.itemReady("integration", {stage: "transform"})
  then: Transform.chain(item, schema.associations.transform_plugin)

sync: transform-to-enrichment
  when: Transform.complete(item)
  then: Queue.enqueue("integration", {item, stage: "enrichment"})

# ─── ENRICHMENT STAGE ───
# Runs all enrichers configured in Schema.associations
sync: queue-dispatches-enrichment
  when: Queue.itemReady("integration", {stage: "enrichment"})
  then: Enricher.suggest(item)  # Runs all applicable enrichers

sync: enrichment-to-validation
  when: Enricher.enriched(item)
  then: Queue.enqueue("integration", {item, stage: "validation"})

# ─── VALIDATION STAGE ───
# Runs all quality rules. Gates passage to storage.
sync: queue-dispatches-validation
  when: Queue.itemReady("integration", {stage: "validation"})
  then: DataQuality.validate(item)

sync: valid-to-storage
  when: DataQuality.validated(item, {valid: true})
  then: ContentStorage.save(item)

sync: invalid-to-quarantine
  when: DataQuality.validated(item, {valid: false})
  then: DataQuality.quarantine(item, violations)

# ─── PROVENANCE (cross-cutting) ───
sync: all-actions-tracked
  when: Capture.itemCaptured OR FieldMapping.applied OR Transform.complete
        OR Enricher.enriched OR DataQuality.validated OR ContentStorage.saved
  then: Provenance.record({entity: item, activity: event})
```

### Federation syncs

```yaml
sync: federated-load-remote
  when: ContentStorage.loadRequested(id, schema)
        AND schema.associations.storage_backend == "federated"
  then: Connector.read({id, source: schema.federation_config.source})

sync: federated-map-response
  when: Connector.readComplete(data, context={federated: true})
  then: FieldMapping.apply(data, schema.federation_config.field_mapping)

sync: federated-cache-result
  when: FieldMapping.applied(data, context={federated: true})
  then: Cache.set(key, data, ttl=schema.federation_config.cache_ttl)

sync: federated-write-remote
  when: ContentStorage.saveRequested(node, schema)
        AND schema.associations.storage_backend == "federated"
        AND NOT schema.federation_config.read_only_remote
  then: FieldMapping.reverse(node) → Connector.write(reversed)
```

### Bidirectional sync

```yaml
sync: sync-pair-detect
  when: SyncPair.syncTriggered(pairId)
  then: Capture.detect_changes(endpointA) AND Capture.detect_changes(endpointB)

sync: sync-pair-propagate
  when: Capture.itemCaptured(item, context={syncPair: pairId})
  then: SyncPair.detect_conflicts(pairId, item)

sync: sync-pair-resolve
  when: SyncPair.conflictDetected(conflict)
  then: SyncPair.resolve(conflict)  # Dispatches to conflict_resolver provider

sync: sync-pair-write
  when: SyncPair.resolved(item, targetEndpoint)
  then: Connector.write(item, targetEndpoint)

sync: sync-pair-track
  when: SyncPair.synced(pairId, changes)
  then: Provenance.record({activity: "sync", metadata: {pairId, direction, changes}})
```

### Progressive formalization

```yaml
sync: capture-triggers-detection
  when: Capture.itemCaptured(item)
  then: ProgressiveSchema.detect_structure(item.id)

sync: enrichment-feeds-structure
  when: Enricher.enriched(item, results)
  then: ProgressiveSchema.detect_structure(item.id)
  # Enricher results (NER entities, auto-tags) feed into structure detection

sync: promotion-creates-schema
  when: ProgressiveSchema.promoted(item, targetSchema)
  then: Schema.defineSchema(targetSchema)  # If schema doesn't exist yet
```

---

## Summary

| Concept | Plugin type | # Providers | Role |
|---|---|---|---|
| DataSource | — | — | Registry of external systems |
| Connector | `connector_protocol` | 14 (+4 CDC) | Protocol abstraction for read/write |
| Capture | `capture_mode` | 9 | Entry point — get data into the system |
| FieldMapping | `field_mapper` | 6 | Source→destination field translation |
| Transform | `transform_plugin` | 16 | Individual value conversion |
| Enricher | `enricher_plugin` | 12 | AI/API metadata augmentation |
| SyncPair | `conflict_resolver` | 5 | Bidirectional sync with conflict handling |
| DataQuality | `quality_rule` | 11 | Validation gating and quarantine |
| Provenance | — | — | Lineage tracking and rollback |
| ProgressiveSchema | `structure_detector` | 10 | Freeform→structured emergence |
| **Totals** | **8 plugin types** | **59 providers** | |

**Plus:** `federated` provider for existing ContentStorage concept (not a new concept).

**Eliminated concepts:**
- ~~Pipeline~~ → sync chains + Queue + Provenance + Schema.associations
- ~~FederatedEntity~~ → `federated` ContentStorage provider + sync wiring

**Core invariant:** No concept references any other concept. All coordination flows through declarative syncs compiled to EventBus subscriptions at runtime. The integration "pipeline" is an emergent property of the sync chain, not a concrete object.
