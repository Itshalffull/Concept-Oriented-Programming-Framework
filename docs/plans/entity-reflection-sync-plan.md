# Entity Reflection & Cross-Suite Sync Plan

**Version 1.0 — 2026-03-03**

Connects all concepts from the Drupal research, Tools-for-Thought research, and Data Integration Kit
to existing repertoire, framework, score, bind, and surface suites via a comprehensive entity model
and sync layer. Every concept, sync, plugin, and user-facing artifact becomes a first-class entity —
either **content** (user-created, it seems like mutable runtime data) or **configuration** (structural metadata,
exportable, versioned).

---

## Table of Contents

1. [Entity Type Classification](#1-entity-type-classification)
2. [Score as the Reflection Backbone](#2-score-as-the-reflection-backbone)
3. [PluginRegistry ↔ Score Connection](#3-pluginregistry--score-connection)
4. [Relations & Links Everywhere](#4-relations--links-everywhere)
5. [Content Entity Syncs (User-Facing)](#5-content-entity-syncs-user-facing)
6. [Configuration Entity Syncs (System/Structural)](#6-configuration-entity-syncs-systemstructural)
7. [Cross-Suite Integration Syncs](#7-cross-suite-integration-syncs)
8. [Unstructured Data Handling](#8-unstructured-data-handling)
9. [New Sync Inventory (Complete List)](#9-new-sync-inventory-complete-list)
10. [Implementation Order](#10-implementation-order)

---

## 1. Entity Type Classification

Every concept in Clef falls into one of two Drupal-inspired entity families.

### Content Entities (User-Facing, Mutable Runtime Data)

These are things users create, edit, view, and interact with through the UI. They are stored
via `ContentStorage`, support versioning, and should be surfaced through Views, Forms, and
the Surface pipeline.

| Suite | Concept | Rationale |
|-------|---------|-----------|
| **foundation** | ContentNode | Core content atom |
| **foundation** | PageAsRecord | User-created page |
| **content** | DailyNote | User journal entry |
| **content** | Comment | User discussion |
| **content** | SyncedContent | Collaboratively edited content |
| **content** | Template | User-created content pattern |
| **content** | Canvas | User spatial layout |
| **content** | Version | Content revision snapshot |
| **classification** | Tag | User-applied label |
| **classification** | Taxonomy | User-defined vocabulary + terms |
| **linking** | Reference | User-created link between entities |
| **linking** | Backlink | Auto-discovered reverse reference |
| **linking** | Alias | User-defined alternative name |
| **collaboration** | Flag | User bookmark/like/follow |
| **collaboration** | Group | User-created content space |
| **collaboration** | InlineAnnotation | User review comment |
| **collaboration** | Attribution | Authorship record |
| **collaboration** | Signature | User signature on content |
| **media** | FileManagement | User-uploaded file |
| **media** | MediaAsset | User media item |
| **notification** | Notification | User notification |
| **identity** | Session | Active user session |
| **data-organization** | Collection | User-curated set |
| **data-organization** | Graph | User knowledge graph (nodes/edges) |
| **data-integration** | DataSource | User-configured external source |
| **data-integration** | Capture | Captured external data item |
| **data-integration** | Provenance | Lineage record |
| **data-integration** | DataQuality | Quality check result |
| **llm-conversation** | Conversation | User chat thread |
| **llm-prompt** | FewShotExample | User example for prompting |
| **llm-rag** | DocumentChunk | Indexed content chunk |
| **llm-training** | EvaluationDataset | User eval dataset |
| **llm-agent** | AgentMemory | Agent knowledge entry |
| **llm-agent** | Blackboard | Shared agent workspace |
| **web3** | Wallet | User wallet |
| **web3** | Content (web3) | IPFS-stored content |
| **automation** | Queue (items) | Queued work items |
| **versioning** | ChangeStream | Change event record |
| **versioning** | Patch | Content edit record |

### Configuration Entities (Structural, Exportable, Versioned)

These define the system's structure. They are code-as-data — concept specs, sync rules,
plugin registrations, workflow definitions, view configurations. Managed by admins/devs,
exported as YAML, tracked by Score.

| Suite | Concept | Rationale |
|-------|---------|-----------|
| **foundation** | TypeSystem | Schema type definitions |
| **foundation** | ContentParser | Parser configuration |
| **foundation** | ContentStorage | Storage backend config |
| **foundation** | Property | Field/property definitions |
| **foundation** | Outline | Outline structure config |
| **foundation** | Intent | Concept purpose metadata |
| **classification** | Schema | Entity type definition (bundles) |
| **classification** | Namespace | Namespace hierarchy |
| **infrastructure** | PluginRegistry | Plugin registrations |
| **infrastructure** | EventBus | Event routing config |
| **infrastructure** | Cache | Cache bin configs |
| **infrastructure** | ConfigSync | Config export/import |
| **infrastructure** | Pathauto | URL pattern config |
| **infrastructure** | Validator | Validation rule config |
| **identity** | Authentication | Auth provider config |
| **identity** | Authorization | Role/permission config |
| **identity** | AccessControl | Access policy config |
| **automation** | Workflow | State machine definition |
| **automation** | AutomationRule | ECA rule definition |
| **automation** | Control | Flow control config |
| **automation** | Queue (config) | Queue/worker config |
| **computation** | Formula | Computation definition |
| **computation** | Token | String template definition |
| **computation** | ExpressionLanguage | Expression grammar config |
| **presentation** | View | View/query definition |
| **presentation** | DisplayMode | Presentation profile |
| **presentation** | FormBuilder | Form definition |
| **presentation** | Renderer | Render pipeline config |
| **query-retrieval** | Query | Saved query definition |
| **query-retrieval** | SearchIndex | Index config |
| **query-retrieval** | ExposedFilter | Filter config |
| **linking** | Relation | Relationship type definition |
| **data-integration** | Connector | Connection config |
| **data-integration** | FieldMapping | Field map definition |
| **data-integration** | Transform | Transform rule |
| **data-integration** | Enricher | Enrichment config |
| **data-integration** | SyncPair | Bidirectional sync config |
| **data-integration** | ProgressiveSchema | Schema evolution config |
| **collaboration** | CausalClock | Clock config |
| **collaboration** | Replica | Replica config |
| **collaboration** | ConflictResolution | Resolution strategy config |
| **collaboration** | PessimisticLock | Lock policy config |
| **versioning** | ContentHash | Hashing config |
| **versioning** | Ref | Mutable pointer definitions |
| **versioning** | DAGHistory | History config |
| **versioning** | Diff | Diff algorithm config |
| **versioning** | Merge | Merge strategy config |
| **versioning** | Branch | Branch definitions |
| **versioning** | TemporalVersion | Bitemporal config |
| **versioning** | SchemaEvolution | Schema version rules |
| **versioning** | RetentionPolicy | Retention rules |
| **llm-core** | LLMProvider | LLM provider config |
| **llm-core** | ModelRouter | Routing rules |
| **llm-agent** | AgentLoop | Agent config |
| **llm-agent** | AgentRole | Role definition |
| **llm-agent** | AgentTeam | Team composition |
| **llm-agent** | ToolBinding | Tool registration |
| **llm-agent** | StateGraph | Execution graph |
| **llm-agent** | Consensus | Voting rules |
| **llm-agent** | Constitution | Alignment rules |
| **llm-agent** | AgentHandoff | Handoff config |
| **llm-prompt** | Signature | I/O signature definition |
| **llm-prompt** | PromptAssembly | Prompt template config |
| **llm-prompt** | PromptOptimizer | Optimization config |
| **llm-prompt** | Assertion | Assertion rules |
| **llm-rag** | VectorIndex | Index config |
| **llm-rag** | Retriever | Retrieval config |
| **llm-safety** | Guardrail | Safety rules |
| **llm-safety** | LLMTrace | Tracing config |
| **llm-safety** | SemanticRouter | Intent routing config |
| **llm-training** | TrainingRun | Training config |
| **llm-training** | Adapter | LoRA adapter config |
| **web3** | ChainMonitor | Chain monitoring config |
| **extension** | ExtensionManifest | Extension definition |
| **extension** | ExtensionHost | Host config |
| **extension** | ContributionPoint | Extension point definition |
| **extension** | ExtensionPermission | Permission definitions |
| **extension** | ExtensionConfig | Extension settings |
| **extension** | ExtensionMessaging | Messaging config |
| **extension** | ExtensionStorage | Storage config |
| **All framework** | SchemaGen, generators, etc. | Generation config |
| **All deploy** | DeployPlan, Runtime, etc. | Deployment config |
| **All bind** | Target, Projection, etc. | Interface config |
| **All score** | All Score concepts | Code analysis config |
| **All surface** | Theme, Widget, Machine, etc. | UI system config |

---

## 2. Score as the Reflection Backbone

Score's semantic layer already provides first-class entities for concepts, actions, syncs, etc.
The key missing piece is that Score entities need to be **connected to the content/config entity
model** so that:
- Every concept spec is both a `ConceptEntity` in Score AND a configuration entity in `ContentStorage`
- Every sync rule is both a `SyncEntity` in Score AND a configuration entity
- Every plugin registration is tracked in Score with references to its provider concept

### 2a. Score Semantic Entities → Configuration Entity Bridge

These syncs ensure every Score semantic entity is also stored as a configuration entity
in ContentStorage, making them queryable via Query, viewable via View, and manageable
via the Surface pipeline.

```
sync: ConceptEntityToConfigEntity
  when: ConceptEntity.register(entity)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "concept_definition",
    data: entity,
    entityType: "structured"
  })

sync: ActionEntityToConfigEntity
  when: ActionEntity.register(action)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "action_definition",
    data: action,
    entityType: "structured"
  })

sync: SyncEntityToConfigEntity
  when: SyncEntity.register(syncDef)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "sync_definition",
    data: syncDef,
    entityType: "structured"
  })

sync: StateFieldToConfigEntity
  when: StateField.register(field)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "state_field_definition",
    data: field,
    entityType: "structured"
  })

sync: VariantEntityToConfigEntity
  when: VariantEntity.register(variant)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "variant_definition",
    data: variant,
    entityType: "structured"
  })
```

### 2b. Surface Semantic Entities → Configuration Entity Bridge

```
sync: WidgetEntityToConfigEntity
  when: WidgetEntity.register(widget)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "widget_definition",
    data: widget,
    entityType: "structured"
  })

sync: ThemeEntityToConfigEntity
  when: ThemeEntity.register(theme)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "theme_definition",
    data: theme,
    entityType: "structured"
  })

sync: InteractorEntityToConfigEntity
  when: InteractorEntity.register(interactor)
  then: ContentStorage.save({
    type: "config_entity",
    bundle: "interactor_definition",
    data: interactor,
    entityType: "structured"
  })
```

---

## 3. PluginRegistry ↔ Score Connection

Every plugin registration needs a corresponding Score entity and a Relation linking it to
the concept it provides for.

### 3a. Plugin Registration → Score Entity

```
sync: PluginRegistrationToScore
  when: PluginRegistry.register(pluginType, pluginId, implementation)
  then:
    - Symbol.register({
        symbolString: "plugin:" + pluginType + ":" + pluginId,
        kind: "plugin_provider",
        displayName: pluginId,
        namespace: pluginType
      })
    - ContentStorage.save({
        type: "config_entity",
        bundle: "plugin_registration",
        data: { pluginType, pluginId, registeredAt: now() },
        entityType: "structured"
      })
```

### 3b. Plugin → Concept Relation

```
sync: PluginProvidesForConcept
  when: PluginRegistry.register(pluginType, pluginId, impl)
  where: ConceptEntity.get({ name: impl.conceptName }) -> found(concept)
  then: Relation.create({
    source: "plugin:" + pluginType + ":" + pluginId,
    target: concept.symbol,
    relationType: "provides_for",
    metadata: { pluginType, direction: "provider_to_concept" }
  })
```

### 3c. Plugin → Generated Artifact Relation

```
sync: PluginTracksArtifact
  when: Emitter.write(file)
  where: file.sourceMap contains pluginRef
  then: Relation.create({
    source: pluginRef.symbol,
    target: file.path,
    relationType: "generates",
    metadata: { generatedAt: now() }
  })
```

---

## 4. Relations & Links Everywhere

The linking suite (Reference, Backlink, Relation, Alias) must serve as the universal
connection fabric. Score already uses SymbolRelationship for typed code-level relationships;
these need to be **bridged** to the linking suite's Relation concept for runtime queryability.

### 4a. SymbolRelationship → Relation Bridge

```
sync: SymbolRelationshipToRelation
  when: SymbolRelationship.add(rel)
  then: Relation.create({
    source: rel.source,
    target: rel.target,
    relationType: rel.kind,
    metadata: rel.metadata
  })
```

### 4b. Score Concept → Suite Relation

```
sync: ConceptBelongsToSuite
  when: ConceptEntity.register(entity)
  where: entity.kit is not empty
  then: Relation.create({
    source: entity.symbol,
    target: "suite:" + entity.kit,
    relationType: "belongs_to_suite",
    metadata: { kit: entity.kit }
  })
```

### 4c. Sync → Concept Relations (trigger + invoke)

```
sync: SyncTriggeredByConcept
  when: SyncEntity.register(syncDef)
  then:
    # For each trigger pattern in the sync
    for trigger in syncDef.triggerPatterns:
      Relation.create({
        source: syncDef.symbol,
        target: trigger.conceptSymbol,
        relationType: "triggered_by",
        metadata: { action: trigger.actionName }
      })
    # For each invocation in the sync
    for invocation in syncDef.invocations:
      Relation.create({
        source: syncDef.symbol,
        target: invocation.conceptSymbol,
        relationType: "invokes",
        metadata: { action: invocation.actionName }
      })
```

### 4d. Content Entity Cross-References via Reference + Backlink

```
sync: ContentSaveTracksReferences
  when: ContentStorage.save(entity)
  where: entity.type == "content_entity"
  then:
    # Parse entity fields for references to other entities
    for ref in ContentParser.extractReferences(entity):
      Reference.create({
        source: entity.id,
        target: ref.targetId,
        fieldName: ref.fieldName,
        referenceType: ref.type
      })
    # Backlink auto-recomputes via existing bidirectional-links sync
```

### 4e. Derived Concept → Source Concept Relations

```
sync: DerivedConceptComposesSource
  when: ConceptEntity.register(derived)
  where: derived.isDerived == true
  then:
    for source in derived.composedConcepts:
      Relation.create({
        source: derived.symbol,
        target: source.symbol,
        relationType: "composes",
        metadata: { role: source.role }
      })
```

---

## 5. Content Entity Syncs (User-Facing)

These syncs ensure user-facing concepts are properly stored as content entities with
full View/Form/Surface support.

### 5a. Workflow as Content Entity

```
sync: WorkflowDefinitionAsEntity
  when: Workflow.define(workflowDef)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "workflow",
        data: workflowDef,
        entityType: "structured"
      })
    - Tag.addTag(workflowDef.id, "system:workflow")

sync: WorkflowStateAsContentAttribute
  when: Workflow.transition(entityId, newState)
  then:
    - Property.set(entityId, "workflow_state", newState)
    - ChangeStream.append({
        entity: entityId,
        field: "workflow_state",
        oldValue: previousState,
        newValue: newState
      })
```

### 5b. AutomationRule as Content Entity

```
sync: AutomationRuleAsEntity
  when: AutomationRule.create(rule)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "automation_rule",
        data: rule,
        entityType: "structured"
      })
    - Tag.addTag(rule.id, "system:automation")
    # Link rule to its trigger concept
    - Relation.create({
        source: rule.id,
        target: rule.triggerConcept,
        relationType: "triggered_by_concept"
      })
```

### 5c. View as Content Entity

```
sync: ViewAsEntity
  when: View.define(viewDef)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "view",
        data: viewDef,
        entityType: "structured"
      })
    - Tag.addTag(viewDef.id, "system:view")
    # Track which concepts/entities this view queries
    - for source in viewDef.sources:
        Relation.create({
          source: viewDef.id,
          target: source.conceptOrBundle,
          relationType: "queries"
        })
```

### 5d. Query as Content Entity

```
sync: SavedQueryAsEntity
  when: Query.save(queryDef)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "saved_query",
        data: queryDef,
        entityType: "structured"
      })
    - Tag.addTag(queryDef.id, "system:query")
```

### 5e. Template as Content Entity

```
sync: TemplateAsContentEntity
  when: Template.define(templateDef)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "template",
        data: templateDef,
        entityType: "structured"
      })
    # Link template to the bundles it can be used with
    - for bundle in templateDef.applicableBundles:
        Relation.create({
          source: templateDef.id,
          target: "bundle:" + bundle,
          relationType: "applicable_to"
        })
```

### 5f. DailyNote Auto-Creation → Content Entity

```
sync: DailyNoteAsContentEntity
  when: DailyNote.getOrCreateToday(page)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "daily_note",
        data: page,
        entityType: "structured"
      })
    - Tag.addTag(page.id, "system:daily_note")
    - Property.set(page.id, "date", today())
```

---

## 6. Configuration Entity Syncs (System/Structural)

### 6a. Schema (Bundle) as Config Entity

Schema is the central "entity type definition" concept — it defines what bundles exist,
what fields they have, and which providers they use.

```
sync: SchemaAsConfigEntity
  when: Schema.define(schemaDef)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "schema_definition",
        data: schemaDef,
        entityType: "structured"
      })
    # Register with Score as a concept entity if it maps to a concept
    - if schemaDef.conceptRef:
        Relation.create({
          source: schemaDef.id,
          target: schemaDef.conceptRef,
          relationType: "schema_for_concept"
        })
```

### 6b. LLM Provider Configs as Config Entities

```
sync: LLMProviderAsConfigEntity
  when: LLMProvider.register(provider)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "llm_provider",
        data: provider,
        entityType: "structured"
      })
    - Relation.create({
        source: provider.id,
        target: "plugin:llm_provider:" + provider.id,
        relationType: "configured_by"
      })
```

### 6c. Deploy Configs as Config Entities

```
sync: DeployPlanAsConfigEntity
  when: DeployPlan.plan(plan)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "deploy_plan",
        data: plan,
        entityType: "structured"
      })
    # Link to each concept in the plan
    - for node in plan.graph.nodes:
        Relation.create({
          source: plan.id,
          target: node.conceptRef,
          relationType: "deploys"
        })

sync: RuntimeAsConfigEntity
  when: Runtime.provision(instance)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "runtime_instance",
        data: instance,
        entityType: "structured"
      })
```

### 6d. Extension Manifests as Config Entities

```
sync: ExtensionManifestAsConfigEntity
  when: ExtensionManifest.register(manifest)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "extension_manifest",
        data: manifest,
        entityType: "structured"
      })
    - for point in manifest.contributionPoints:
        Relation.create({
          source: manifest.id,
          target: point.id,
          relationType: "contributes_to"
        })
```

---

## 7. Cross-Suite Integration Syncs

These are the highest-value syncs — they connect suites that currently operate
independently.

### 7a. Data Integration → Score

Score already `uses` data-integration concepts (Transform, Enricher, FieldMapping,
DataQuality, Provenance). These syncs make the connection live:

```
sync: ConnectorAsScoreEntity
  when: Connector.configure(config)
  then:
    - Symbol.register({
        symbolString: "connector:" + config.id,
        kind: "data_connector",
        displayName: config.name
      })
    - ContentStorage.save({
        type: "config_entity",
        bundle: "connector_config",
        data: config,
        entityType: "structured"
      })

sync: FieldMappingAsScoreRelation
  when: FieldMapping.apply(mapping)
  then:
    # Each field mapping creates a "maps_to" relation
    - for pair in mapping.fieldPairs:
        Relation.create({
          source: "field:" + pair.sourceField,
          target: "field:" + pair.destField,
          relationType: "maps_to",
          metadata: { transform: pair.transform, mapping: mapping.id }
        })

sync: ProvenanceToChangeStream
  when: Provenance.record(event)
  then:
    - ChangeStream.append({
        entity: event.entityId,
        field: "provenance",
        source: event.sourceSystem,
        action: event.action,
        timestamp: event.timestamp
      })
```

### 7b. Versioning → Score

```
sync: DAGHistoryNodeAsScoreEntity
  when: DAGHistory.create(node)
  then:
    - Symbol.register({
        symbolString: "commit:" + node.hash,
        kind: "version_node",
        displayName: node.message
      })
    # Link parent commits
    - for parent in node.parents:
        Relation.create({
          source: "commit:" + node.hash,
          target: "commit:" + parent,
          relationType: "parent_of"
        })
```

### 7c. Collaboration → Score

```
sync: GroupAsContentEntity
  when: Group.create(group)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "group",
        data: group,
        entityType: "structured"
      })
    - Tag.addTag(group.id, "system:group")

sync: GroupMembershipAsRelation
  when: Group.addMember(groupId, userId, role)
  then:
    - Relation.create({
        source: userId,
        target: groupId,
        relationType: "member_of",
        metadata: { role: role }
      })

sync: FlagAsRelation
  when: Flag.flag(userId, entityId, flagType)
  then:
    - Relation.create({
        source: userId,
        target: entityId,
        relationType: "flagged:" + flagType,
        metadata: { flaggedAt: now() }
      })
```

### 7d. LLM Suites → Score + Content

```
sync: ConversationAsContentEntity
  when: Conversation.create(conv)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "conversation",
        data: conv,
        entityType: "structured"
      })

sync: AgentMemoryAsContentEntity
  when: AgentMemory.store(entry)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "agent_memory",
        data: entry,
        entityType: "structured"
      })
    - Tag.addTag(entry.id, "memory:" + entry.memoryType)

sync: ToolBindingAsConfigEntity
  when: ToolBinding.register(tool)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "tool_binding",
        data: tool,
        entityType: "structured"
      })
    - Relation.create({
        source: tool.id,
        target: "plugin:tool:" + tool.name,
        relationType: "binds_tool"
      })

sync: GuardrailAsConfigEntity
  when: Guardrail.define(rule)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "guardrail_rule",
        data: rule,
        entityType: "structured"
      })

sync: LLMTraceAsContentEntity
  when: LLMTrace.record(span)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "llm_trace_span",
        data: span,
        entityType: "structured"
      })
    # Link trace to the provider and model used
    - Relation.create({
        source: span.id,
        target: span.providerId,
        relationType: "executed_by"
      })
```

### 7e. Web3 → Score + Content

```
sync: WalletAsContentEntity
  when: Wallet.connect(wallet)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "wallet",
        data: wallet,
        entityType: "structured"
      })

sync: ChainMonitorAsConfigEntity
  when: ChainMonitor.watch(config)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "chain_monitor",
        data: config,
        entityType: "structured"
      })
```

### 7f. Surface → Score + Content

```
sync: WidgetRegistrationAsConfigEntity
  when: Widget.register(widget)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "widget_registration",
        data: widget,
        entityType: "structured"
      })
    - Relation.create({
        source: widget.id,
        target: widget.conceptRef,
        relationType: "renders_for"
      })

sync: ThemeAsConfigEntity
  when: Theme.activate(theme)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "theme",
        data: theme,
        entityType: "structured"
      })
```

### 7g. Bind Interface → Score

```
sync: TargetOutputAsConfigEntity
  when: Target.generate(output)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "interface_target",
        data: output,
        entityType: "structured"
      })
    # Link generated target to its source concept
    - Relation.create({
        source: output.id,
        target: output.conceptRef,
        relationType: "interface_for"
      })

sync: ApiSurfaceAsConfigEntity
  when: ApiSurface.compose(surface)
  then:
    - ContentStorage.save({
        type: "config_entity",
        bundle: "api_surface",
        data: surface,
        entityType: "structured"
      })
```

### 7h. Framework Generation → Score

```
sync: GenerationRunAsContentEntity
  when: GenerationPlan.complete(run)
  then:
    - ContentStorage.save({
        type: "content_entity",
        bundle: "generation_run",
        data: run,
        entityType: "structured"
      })
    - for step in run.steps:
        Relation.create({
          source: run.id,
          target: step.conceptRef,
          relationType: "generated"
        })
```

---

## 8. Unstructured Data Handling

Not all data is structured. The following concepts deal with free-text, binary,
or semi-structured content that should be treated as unstructured entities.

### Unstructured Content Entities

| Concept | Data Type | Handling |
|---------|-----------|----------|
| ContentNode.content | RichText/Markdown | ContentParser extracts structure on save |
| Comment.body | Free text | Stored as unstructured, parsed for references |
| Canvas.nodes | Spatial JSON | Semi-structured; treat as structured |
| MediaAsset.data | Binary | Stored via FileManagement; metadata structured |
| FileManagement.file | Binary blob | Reference-counted; metadata structured |
| DocumentChunk.content | Text fragment | Vector-embedded; source tracked via Provenance |
| Conversation.messages | Text messages | Stored as structured array of unstructured text |
| DailyNote.content | Markdown | ContentParser extracts; daily-note template applied |
| Capture.rawData | Arbitrary | Progressive schema infers structure over time |

### Unstructured Data Syncs

```
sync: UnstructuredContentParsed
  when: ContentStorage.save(entity)
  where: entity.entityType == "unstructured" OR entity.hasTextField
  then:
    - ContentParser.parse(entity.textContent) -> parsed
    # Extract inline references
    - for ref in parsed.references:
        Reference.create({
          source: entity.id,
          target: ref.target,
          fieldName: "content"
        })
    # Extract inline tags
    - for tag in parsed.inlineTags:
        Tag.addTag(entity.id, tag)
    # Extract inline properties
    - for prop in parsed.inlineProperties:
        Property.set(entity.id, prop.key, prop.value)

sync: UnstructuredToProgressiveSchema
  when: Capture.itemCaptured(item)
  where: item.schema == undefined
  then:
    - ProgressiveSchema.detect(item.rawData) -> structure
    - if structure.confidence > threshold:
        Schema.define({
          name: item.sourceType + "_inferred",
          fields: structure.fields,
          source: "progressive_inference"
        })

sync: BinaryAssetMetadataExtracted
  when: FileManagement.upload(file)
  then:
    - MediaAsset.extractMetadata(file) -> metadata
    - for key, value in metadata:
        Property.set(file.id, key, value)
    - ContentStorage.save({
        type: "content_entity",
        bundle: "file",
        data: { ...file, metadata },
        entityType: "unstructured"
      })
```

---

## 9. New Sync Inventory (Complete List)

### Suite: `repertoire/concepts/entity-reflection/` (new syncs-only suite)

All syncs below are organized by integration area. This is a syncs-only suite
(like surface-integration) that bridges concepts across suites.

#### A. Score ↔ ContentStorage Bridge (7 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 1 | ConceptEntityToConfigEntity | ConceptEntity.register → ContentStorage.save(config) |
| 2 | ActionEntityToConfigEntity | ActionEntity.register → ContentStorage.save(config) |
| 3 | SyncEntityToConfigEntity | SyncEntity.register → ContentStorage.save(config) |
| 4 | StateFieldToConfigEntity | StateField.register → ContentStorage.save(config) |
| 5 | VariantEntityToConfigEntity | VariantEntity.register → ContentStorage.save(config) |
| 6 | WidgetEntityToConfigEntity | WidgetEntity.register → ContentStorage.save(config) |
| 7 | ThemeEntityToConfigEntity | ThemeEntity.register → ContentStorage.save(config) |

#### B. PluginRegistry ↔ Score Bridge (3 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 8 | PluginRegistrationToScore | PluginRegistry.register → Symbol.register + ContentStorage.save |
| 9 | PluginProvidesForConcept | PluginRegistry.register → Relation.create(provides_for) |
| 10 | PluginTracksArtifact | Emitter.write → Relation.create(generates) |

#### C. SymbolRelationship ↔ Relation Bridge (3 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 11 | SymbolRelationshipToRelation | SymbolRelationship.add → Relation.create |
| 12 | ConceptBelongsToSuite | ConceptEntity.register → Relation.create(belongs_to_suite) |
| 13 | SyncConceptRelations | SyncEntity.register → Relation.create(triggered_by + invokes) |

#### D. Content Entity Cross-References (3 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 14 | ContentSaveTracksReferences | ContentStorage.save → Reference.create for each ref field |
| 15 | DerivedConceptComposesSource | ConceptEntity.register(derived) → Relation.create(composes) |
| 16 | ContentSaveTracksProvenance | ContentStorage.save → Provenance.record |

#### E. User-Facing Concept → Content Entity (12 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 17 | WorkflowDefinitionAsEntity | Workflow.define → ContentStorage.save(config) + Tag |
| 18 | WorkflowStateAsContentAttribute | Workflow.transition → Property.set + ChangeStream.append |
| 19 | AutomationRuleAsEntity | AutomationRule.create → ContentStorage.save + Tag + Relation |
| 20 | ViewAsEntity | View.define → ContentStorage.save + Tag + Relation(queries) |
| 21 | SavedQueryAsEntity | Query.save → ContentStorage.save + Tag |
| 22 | TemplateAsContentEntity | Template.define → ContentStorage.save + Relation(applicable_to) |
| 23 | DailyNoteAsContentEntity | DailyNote.getOrCreateToday → ContentStorage.save + Tag + Property |
| 24 | GroupAsContentEntity | Group.create → ContentStorage.save + Tag |
| 25 | GroupMembershipAsRelation | Group.addMember → Relation.create(member_of) |
| 26 | FlagAsRelation | Flag.flag → Relation.create(flagged:type) |
| 27 | ConversationAsContentEntity | Conversation.create → ContentStorage.save |
| 28 | AgentMemoryAsContentEntity | AgentMemory.store → ContentStorage.save + Tag |

#### F. Config Entity Registration (14 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 29 | SchemaAsConfigEntity | Schema.define → ContentStorage.save + Relation |
| 30 | ConnectorAsScoreEntity | Connector.configure → Symbol.register + ContentStorage.save |
| 31 | FieldMappingAsScoreRelation | FieldMapping.apply → Relation.create(maps_to) per field |
| 32 | LLMProviderAsConfigEntity | LLMProvider.register → ContentStorage.save + Relation |
| 33 | ToolBindingAsConfigEntity | ToolBinding.register → ContentStorage.save + Relation |
| 34 | GuardrailAsConfigEntity | Guardrail.define → ContentStorage.save |
| 35 | DeployPlanAsConfigEntity | DeployPlan.plan → ContentStorage.save + Relation(deploys) |
| 36 | RuntimeAsConfigEntity | Runtime.provision → ContentStorage.save |
| 37 | ExtensionManifestAsConfigEntity | ExtensionManifest.register → ContentStorage.save + Relation |
| 38 | ChainMonitorAsConfigEntity | ChainMonitor.watch → ContentStorage.save |
| 39 | WidgetRegistrationAsConfigEntity | Widget.register → ContentStorage.save + Relation(renders_for) |
| 40 | ThemeAsConfigEntity | Theme.activate → ContentStorage.save |
| 41 | TargetOutputAsConfigEntity | Target.generate → ContentStorage.save + Relation |
| 42 | ApiSurfaceAsConfigEntity | ApiSurface.compose → ContentStorage.save |

#### G. Content Entity Lifecycle (6 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 43 | LLMTraceAsContentEntity | LLMTrace.record → ContentStorage.save + Relation(executed_by) |
| 44 | WalletAsContentEntity | Wallet.connect → ContentStorage.save |
| 45 | GenerationRunAsContentEntity | GenerationPlan.complete → ContentStorage.save + Relation |
| 46 | ProvenanceToChangeStream | Provenance.record → ChangeStream.append |
| 47 | DAGHistoryNodeAsScoreEntity | DAGHistory.create → Symbol.register + Relation(parent_of) |
| 48 | InteractorEntityToConfigEntity | InteractorEntity.register → ContentStorage.save |

#### H. Unstructured Data (3 syncs)

| # | Sync Name | Trigger → Effect |
|---|-----------|------------------|
| 49 | UnstructuredContentParsed | ContentStorage.save(text) → ContentParser.parse → Reference + Tag + Property |
| 50 | UnstructuredToProgressiveSchema | Capture.itemCaptured(untyped) → ProgressiveSchema.detect → Schema.define |
| 51 | BinaryAssetMetadataExtracted | FileManagement.upload → MediaAsset.extractMetadata → Property.set |

**Total: 51 new syncs**

---

## 10. Implementation Order

### Wave 1: Core Reflection Infrastructure (syncs 1–7, 11–12)

Establish the Score → ContentStorage bridge. After this wave, every concept, action,
state field, sync, and variant registered in Score is also a queryable config entity.

**Prerequisites**: Score semantic suite, foundation suite, linking suite
**Touches**: ConceptEntity, ActionEntity, SyncEntity, StateField, VariantEntity,
WidgetEntity, ThemeEntity, ContentStorage, Relation

### Wave 2: PluginRegistry Connection (syncs 8–10, 13, 15)

Connect the plugin system to Score so that every plugin provider is tracked with
symbol identity and linked to its source concept.

**Prerequisites**: Wave 1
**Touches**: PluginRegistry, Symbol, ContentStorage, Relation, Emitter

### Wave 3: User-Facing Content Entities (syncs 17–28)

Make workflows, views, automation rules, groups, templates, daily notes, conversations,
and agent memories proper content entities manageable through the Surface pipeline.

**Prerequisites**: Wave 1
**Touches**: Workflow, AutomationRule, View, Query, Template, DailyNote, Group,
Flag, Conversation, AgentMemory, ContentStorage, Tag, Property, Relation, ChangeStream

### Wave 4: Configuration Entity Registration (syncs 29–42)

Register all structural/system configs — schemas, connectors, LLM providers,
deploy plans, extensions, widgets, themes, targets — as config entities.

**Prerequisites**: Wave 1
**Touches**: Schema, Connector, FieldMapping, LLMProvider, ToolBinding, Guardrail,
DeployPlan, Runtime, ExtensionManifest, ChainMonitor, Widget, Theme, Target,
ApiSurface, ContentStorage, Symbol, Relation

### Wave 5: Cross-References & Lifecycle (syncs 14, 16, 43–48)

Wire up content cross-references, provenance tracking, versioning integration,
and remaining content entity syncs.

**Prerequisites**: Wave 1, Wave 3
**Touches**: ContentStorage, Reference, Provenance, LLMTrace, Wallet,
GenerationPlan, ChangeStream, DAGHistory, Symbol, Relation, InteractorEntity

### Wave 6: Unstructured Data (syncs 49–51)

Handle unstructured and semi-structured data — parse text for references/tags,
infer schemas from raw captures, extract binary metadata.

**Prerequisites**: Wave 3, data-integration suite
**Touches**: ContentParser, ContentStorage, Reference, Tag, Property,
ProgressiveSchema, Schema, FileManagement, MediaAsset, Capture

---

## Appendix: Suite Manifest for entity-reflection

```yaml
suite:
  name: entity-reflection
  version: 0.1.0
  description: >
    Cross-suite entity reflection layer. Bridges Score semantic entities,
    PluginRegistry registrations, and all user/system concepts to the
    content/configuration entity model via ContentStorage, Relation,
    Reference, Tag, and Property. Ensures every concept in the system
    is a first-class queryable entity connected via Relations.

concepts: []  # Syncs-only suite — no new concepts

uses:
  # Score suites
  "@clef/semantic":
    concepts: [ConceptEntity, ActionEntity, SyncEntity, StateField,
               VariantEntity, WidgetEntity, ThemeEntity, InteractorEntity]
  "@clef/symbol":
    concepts: [Symbol, SymbolRelationship]
  # Foundation
  "@clef/foundation":
    concepts: [ContentNode, ContentStorage, ContentParser, Property, Intent]
  # Classification
  "@clef/classification":
    concepts: [Tag, Schema, Namespace]
  # Infrastructure
  "@clef/infrastructure":
    concepts: [PluginRegistry, EventBus, Validator, Cache]
  # Linking
  "@clef/linking":
    concepts: [Reference, Backlink, Relation, Alias]
  # Automation
  "@clef/automation":
    concepts: [Workflow, AutomationRule, Queue]
  # Content
  "@clef/content":
    concepts: [DailyNote, Template, Comment, Canvas, Version]
  # Presentation
  "@clef/presentation":
    concepts: [View, DisplayMode, FormBuilder, Renderer]
  # Query
  "@clef/query-retrieval":
    concepts: [Query, SearchIndex, ExposedFilter]
  # Collaboration
  "@clef/collaboration":
    concepts: [Flag, Group, Attribution, InlineAnnotation]
  # Data Integration
  "@clef/data-integration":
    concepts: [DataSource, Connector, Capture, FieldMapping, Transform,
               Enricher, Provenance, ProgressiveSchema, DataQuality]
  # Versioning
  "@clef/versioning":
    concepts: [ChangeStream, DAGHistory, Patch]
  # Media
  "@clef/media":
    concepts: [FileManagement, MediaAsset]
  # LLM suites
  "@clef/llm-core":
    concepts: [LLMProvider]
  "@clef/llm-conversation":
    concepts: [Conversation]
  "@clef/llm-agent":
    concepts: [AgentMemory, ToolBinding, Blackboard]
  "@clef/llm-prompt":
    concepts: [Signature, PromptAssembly]
  "@clef/llm-safety":
    concepts: [Guardrail, LLMTrace]
  # Web3
  "@clef/web3":
    concepts: [Wallet, ChainMonitor]
  # Extension
  "@clef/extension":
    concepts: [ExtensionManifest]
  # Deploy
  "@clef/deploy":
    concepts: [DeployPlan, Runtime]
  # Generation
  "@clef/generation":
    concepts: [GenerationPlan, Emitter]
  # Surface
  "@clef/surface-component":
    concepts: [Widget]
  "@clef/surface-theme":
    concepts: [Theme]
  # Bind
  "@clef/interface":
    concepts: [Target, ApiSurface]

syncs:
  required:
    # Wave 1: Core Reflection
    - path: ./syncs/score-bridge/concept-entity-to-config.sync
    - path: ./syncs/score-bridge/action-entity-to-config.sync
    - path: ./syncs/score-bridge/sync-entity-to-config.sync
    - path: ./syncs/score-bridge/state-field-to-config.sync
    - path: ./syncs/score-bridge/variant-entity-to-config.sync
    - path: ./syncs/score-bridge/widget-entity-to-config.sync
    - path: ./syncs/score-bridge/theme-entity-to-config.sync
    # Wave 2: Plugin Connection
    - path: ./syncs/plugin-bridge/plugin-registration-to-score.sync
    - path: ./syncs/plugin-bridge/plugin-provides-for-concept.sync
    - path: ./syncs/plugin-bridge/plugin-tracks-artifact.sync
    # Wave 1 continuation: Relations
    - path: ./syncs/relation-bridge/symbol-relationship-to-relation.sync
    - path: ./syncs/relation-bridge/concept-belongs-to-suite.sync
    - path: ./syncs/relation-bridge/sync-concept-relations.sync

  recommended:
    # Wave 3: Content Entities
    - path: ./syncs/content-entities/workflow-definition-as-entity.sync
    - path: ./syncs/content-entities/workflow-state-as-content-attribute.sync
    - path: ./syncs/content-entities/automation-rule-as-entity.sync
    - path: ./syncs/content-entities/view-as-entity.sync
    - path: ./syncs/content-entities/saved-query-as-entity.sync
    - path: ./syncs/content-entities/template-as-content-entity.sync
    - path: ./syncs/content-entities/daily-note-as-content-entity.sync
    - path: ./syncs/content-entities/group-as-content-entity.sync
    - path: ./syncs/content-entities/group-membership-as-relation.sync
    - path: ./syncs/content-entities/flag-as-relation.sync
    - path: ./syncs/content-entities/conversation-as-content-entity.sync
    - path: ./syncs/content-entities/agent-memory-as-content-entity.sync
    # Wave 4: Config Entities
    - path: ./syncs/config-entities/schema-as-config-entity.sync
    - path: ./syncs/config-entities/connector-as-score-entity.sync
    - path: ./syncs/config-entities/field-mapping-as-score-relation.sync
    - path: ./syncs/config-entities/llm-provider-as-config-entity.sync
    - path: ./syncs/config-entities/tool-binding-as-config-entity.sync
    - path: ./syncs/config-entities/guardrail-as-config-entity.sync
    - path: ./syncs/config-entities/deploy-plan-as-config-entity.sync
    - path: ./syncs/config-entities/runtime-as-config-entity.sync
    - path: ./syncs/config-entities/extension-manifest-as-config-entity.sync
    - path: ./syncs/config-entities/chain-monitor-as-config-entity.sync
    - path: ./syncs/config-entities/widget-registration-as-config-entity.sync
    - path: ./syncs/config-entities/theme-as-config-entity.sync
    - path: ./syncs/config-entities/target-output-as-config-entity.sync
    - path: ./syncs/config-entities/api-surface-as-config-entity.sync
    # Wave 5: Lifecycle
    - path: ./syncs/lifecycle/content-save-tracks-references.sync
    - path: ./syncs/lifecycle/derived-concept-composes-source.sync
    - path: ./syncs/lifecycle/content-save-tracks-provenance.sync
    - path: ./syncs/lifecycle/llm-trace-as-content-entity.sync
    - path: ./syncs/lifecycle/wallet-as-content-entity.sync
    - path: ./syncs/lifecycle/generation-run-as-content-entity.sync
    - path: ./syncs/lifecycle/provenance-to-change-stream.sync
    - path: ./syncs/lifecycle/dag-history-node-as-score-entity.sync
    - path: ./syncs/lifecycle/interactor-entity-to-config-entity.sync
    # Wave 6: Unstructured
    - path: ./syncs/unstructured/unstructured-content-parsed.sync
    - path: ./syncs/unstructured/unstructured-to-progressive-schema.sync
    - path: ./syncs/unstructured/binary-asset-metadata-extracted.sync
```

---

## Design Principles

1. **No new concepts** — this is a syncs-only suite. All entity storage, relation tracking,
   and reference management uses existing concepts.

2. **Content vs. Configuration** — follows Drupal's dual-domain model. Content entities are
   user-mutable runtime data (notes, conversations, groups). Configuration entities are
   structural metadata (workflows, schemas, plugins, deploy plans).

3. **Score as truth** — Score's semantic entities are the canonical representation of Clef
   metadata. The syncs here *bridge* Score entities to ContentStorage for queryability,
   they don't replace Score.

4. **Relation as the universal connector** — every cross-entity connection goes through the
   linking suite's Relation concept, creating a navigable graph of the entire system.

5. **Reference + Backlink for content** — user content uses Reference (explicit links) and
   Backlink (auto-discovered reverse links) for the tools-for-thought bidirectional linking.

6. **PluginRegistry ↔ Score bidirectional** — plugins are registered in PluginRegistry (for
   runtime dispatch) AND tracked in Score (for analysis/queryability). Relations connect them.

7. **Unstructured data respected** — text content is parsed for structure but stored as-is.
   Binary assets get metadata extraction. Raw captures get progressive schema inference.
   Nothing is forced into a schema it doesn't fit.
