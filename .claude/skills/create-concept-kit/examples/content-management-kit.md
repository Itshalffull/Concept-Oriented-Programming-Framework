# Worked Example: Content Management Kit

A complete walkthrough of the content management kit (Entity, Field, Relation, Node) — the reference kit in the COPF architecture.

## Kit Purpose

> Drupal-style entity/field/relation system for structured content. Provides typed entities with attachable fields and inter-entity relationships, with cascade lifecycle management.

This kit enables any app to manage structured content without reinventing entity CRUD, field attachment, or relationship management. It's analogous to Drupal's entity system or WordPress's post/meta architecture, but expressed as independent concepts.

## Step 1: Identify the Kit Boundary

Four concepts belong together:

| Concept | Purpose | Why it's in the kit |
|---------|---------|-------------------|
| **Entity** | Manage typed entities with lifecycle | Foundation — everything else attaches to entities |
| **Field** | Attach named/typed fields to entities | Meaningless without entities to attach to |
| **Relation** | Link entities to each other | Meaningless without entities to link |
| **Node** | User-facing entity with a bundle type | Convenience layer on Entity |

**The boundary test**: Remove any one concept — do the others lose significant value?
- Remove Entity → Field, Relation, and Node have nothing to attach to. Yes.
- Remove Field → Entities can't store data beyond their core properties. Yes.
- Remove Relation → Entities can't link to each other. Yes.
- Remove Node → Entities still work, but no user-friendly bundle abstraction. Borderline — but Node simplifies the common case enough to include.

## Step 2: Type Parameter Alignment

```yaml
concepts:
  Entity:
    spec: ./entity.concept
    params:
      E: { as: entity-ref, description: "Reference to an entity" }

  Field:
    spec: ./field.concept
    params:
      F: { as: field-ref, description: "Reference to a field instance" }
      T: { as: entity-ref }    # Same as Entity's E

  Relation:
    spec: ./relation.concept
    params:
      R: { as: relation-ref, description: "Reference to a relation" }
      T: { as: entity-ref }    # Same as Entity's E

  Node:
    spec: ./node.concept
    params:
      N: { as: entity-ref }    # Node IS an entity
```

**Key alignment decisions:**
- Field's `T` and Relation's `T` both use `entity-ref` — when you attach a field to an entity or link two entities, the identifiers are the same kind
- Node's `N` uses `entity-ref` because a Node IS an Entity (same identifier space)
- Field's `F` and Relation's `R` are distinct (`field-ref`, `relation-ref`) — a field reference is not a relation reference

## Step 3: Sync Design with Tiers

### Required Syncs (3)

**1. Cascade Delete Fields**

When an entity is deleted, all attached fields must be removed. Without this, the Field concept accumulates orphaned records that reference a non-existent entity.

```
sync CascadeDeleteFields [required]
when {
  Entity/delete: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  Field: { ?field target: ?entity }
}
then {
  Field/detach: [ field: ?field ]
}
```

**Why required**: Removing this sync means every entity deletion leaves orphaned field records. Over time, Field's state grows unboundedly with garbage data.

**2. Cascade Delete Relations**

When an entity is deleted, all relations sourced from or targeting it must be unlinked.

```
sync CascadeDeleteRelations [required]
when {
  Entity/delete: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  Relation: { ?rel source: ?entity }
  Relation: { ?rel2 target: ?entity }
}
then {
  Relation/unlink: [ rel: ?rel ]
  Relation/unlink: [ rel: ?rel2 ]
}
```

**Why required**: Removing this sync means deleted entities leave dangling references in the Relation concept. Queries on Relation would return links to non-existent entities.

**3. Entity Lifecycle Timestamps**

Set created/updated timestamps on entity create and field attach.

```
sync EntityLifecycle [required]
when {
  Entity/create: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  bind(now() as ?timestamp)
}
then {
  Entity/setTimestamp: [ entity: ?entity; created: ?timestamp; updated: ?timestamp ]
}
```

**Why required**: Entity actions depend on timestamps being populated. Without this sync, `createdAt` and `updatedAt` are null, causing query and sort operations to fail.

### Recommended Syncs (3)

**4. Default Title Field**

When a node is created, automatically attach a title field. Apps can override this with a different title convention or disable it entirely.

```
sync DefaultTitleField [recommended]
when {
  Web/request: [ method: "create_node"; title: ?title ] => []
  Entity/create: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  bind(uuid() as ?field)
}
then {
  Field/attach: [ field: ?field; target: ?entity; name: "title"; value: ?title ]
}
```

**Override scenario**: An app might attach title + slug + description fields instead, all in a single custom sync. Override with name `DefaultTitleField`.

**5. Node Creates Entity**

When a node is created, create the underlying entity first. Apps can override this with custom entity initialization logic.

```
sync NodeCreateEntity [recommended]
when {
  Web/request: [ method: "create_node"; bundle: ?bundle; title: ?title ] => []
}
where {
  bind(uuid() as ?entity)
}
then {
  Entity/create: [ entity: ?entity; bundle: ?bundle ]
}
```

**Override scenario**: An app might need to validate the bundle type or apply permissions before entity creation. Override with name `NodeCreateEntity`.

**6. Update Timestamp on Field Change**

When a field is attached or updated, touch the entity's updated timestamp. Apps can disable this if they manage timestamps differently.

```
sync UpdateTimestamp [recommended]
when {
  Field/attach: [ target: ?entity ] => []
}
where {
  bind(now() as ?timestamp)
}
then {
  Entity/setTimestamp: [ entity: ?entity; updated: ?timestamp ]
}
```

**Disable scenario**: An app might batch field updates and only touch the timestamp once at the end. Disable `UpdateTimestamp` and manage timestamps in a custom sync.

### Optional Uses Syncs (1)

**7. Entity Ownership** (activates with auth kit)

When a user creates an entity, record ownership. This sync only loads if the auth kit is also present. Declared as an optional uses entry.

```
sync EntityOwnership [eager]
when {
  JWT/verify: [] => [ user: ?user ]
  Entity/create: [ entity: ?entity ] => [ entity: ?entity ]
}
then {
  Entity/setOwner: [ entity: ?entity; owner: ?user ]
}
```

## Step 4: Full Kit Manifest

```yaml
kit:
  name: content-management
  version: 0.1.0
  description: >
    Drupal-style entity/field/relation system for structured content.
    Provides typed entities with attachable fields and inter-entity
    relationships, with cascade lifecycle management.

concepts:
  Entity:
    spec: ./entity.concept
    params:
      E: { as: entity-ref, description: "Reference to an entity" }
  Field:
    spec: ./field.concept
    params:
      F: { as: field-ref, description: "Reference to a field instance" }
      T: { as: entity-ref }
  Relation:
    spec: ./relation.concept
    params:
      R: { as: relation-ref, description: "Reference to a relation" }
      T: { as: entity-ref }
  Node:
    spec: ./node.concept
    params:
      N: { as: entity-ref }

syncs:
  required:
    - path: ./syncs/cascade-delete-fields.sync
      description: >
        When an entity is deleted, all attached fields are detached
        and deleted. Without this, the Field concept accumulates
        orphaned records.
    - path: ./syncs/cascade-delete-relations.sync
      description: >
        When an entity is deleted, all relations sourced from or
        targeting it are unlinked. Without this, the Relation concept
        holds dangling references.
    - path: ./syncs/entity-lifecycle.sync
      description: >
        Sets created/updated timestamps on entity create and field
        attach. Without this, entity timestamps are never populated.

  recommended:
    - path: ./syncs/default-title-field.sync
      name: DefaultTitleField
      description: >
        When a node is created, automatically attach a title field.
        Override if your app uses a different title convention.
    - path: ./syncs/node-create-entity.sync
      name: NodeCreateEntity
      description: >
        When a node is created, create the underlying entity first.
        Override if you need custom entity initialization logic.
    - path: ./syncs/update-timestamp-on-field-change.sync
      name: UpdateTimestamp
      description: >
        When a field is attached or updated, touch the entity's
        updated timestamp. Disable if you manage timestamps differently.

uses:
  - kit: auth
    optional: true
    concepts:
      - name: JWT
      - name: User
    syncs:
      - path: ./syncs/entity-ownership.sync
        description: >
          When a user creates an entity, record ownership.
          Only loads if the auth kit is present.

dependencies: []
```

## Step 5: App Usage Examples

### Basic usage (no customization)

```yaml
# deploy.yaml
kits:
  - name: content-management
    path: ./kits/content-management
```

All 3 required + 3 recommended syncs load. Optional uses syncs are skipped (no auth kit present).

### With auth kit

```yaml
kits:
  - name: content-management
    path: ./kits/content-management
  - name: auth
    path: ./kits/auth
```

All 6 kit syncs + 1 optional uses sync (EntityOwnership) load.

### With overrides and disables

```yaml
kits:
  - name: content-management
    path: ./kits/content-management
    overrides:
      DefaultTitleField: ./syncs/custom-title-and-slug.sync
    disable:
      - UpdateTimestamp
```

3 required syncs load (always). NodeCreateEntity loads (not overridden or disabled). DefaultTitleField is replaced with the app's custom sync. UpdateTimestamp is removed entirely.

## Directory Structure

```
kits/content-management/
├── kit.yaml
├── entity.concept
├── field.concept
├── relation.concept
├── node.concept
├── syncs/
│   ├── cascade-delete-fields.sync        # Required
│   ├── cascade-delete-relations.sync     # Required
│   ├── entity-lifecycle.sync             # Required
│   ├── default-title-field.sync          # Recommended
│   ├── node-create-entity.sync           # Recommended
│   ├── update-timestamp-on-field-change.sync  # Recommended
│   └── entity-ownership.sync             # Integration (auth)
├── implementations/
│   └── typescript/
│       ├── entity.handler.ts
│       ├── field.handler.ts
│       ├── relation.handler.ts
│       └── node.handler.ts
└── tests/
    ├── conformance/
    └── integration/
```

## Design Decisions

**Why Entity and Node are separate concepts**: Entity handles the generic lifecycle (create, delete, timestamps). Node adds a bundle type and user-facing semantics. An app might use entities without nodes (for system-internal entities), or might add other specializations (Media, Block) that also use entity-ref.

**Why 3 required syncs is the right number**: Each required sync prevents a specific data corruption pattern. cascade-delete-fields prevents orphaned field records. cascade-delete-relations prevents dangling references. entity-lifecycle prevents null timestamps. No other kit sync prevents corruption — the rest are behavioral preferences.

**Why UpdateTimestamp is recommended, not required**: Unlike entity-lifecycle (which sets timestamps on create — required because other code depends on timestamps being non-null), UpdateTimestamp sets timestamps on field changes. If disabled, timestamps just become stale — no corruption, just inaccuracy. Some apps prefer to manage timestamps differently.
