# FilterSpec Seed Mapping

Which views map to which FilterSpec seeds, extracted from `clef-base/seeds/View.seeds.yaml`.

## Views with no filter (use identity-filter)

| View | FilterSpec |
|------|------------|
| schemas-list | identity-filter |
| workflows-list | identity-filter |
| automations-list | identity-filter |
| taxonomy-list | identity-filter |
| themes-list | identity-filter |
| views-list | identity-filter |
| mappings-list | identity-filter |
| dashboard-stats | identity-filter |
| dashboard-concepts | identity-filter |
| score-schemas | identity-filter |
| installed-suites | identity-filter |
| entity-properties | identity-filter |
| entity-content | identity-filter |
| entity-same-schema | identity-filter |
| automations-rules-list | identity-filter |
| version-spaces-list | identity-filter |

## Interactive toggle-group filters

| View | FilterSpec | Fields |
|------|------------|--------|
| content-list | schemas-toggle-filter | schemas (Schema) |
| concept-graph | schemas-toggle-filter | schemas (Schema) |
| entity-all-content | schemas-toggle-filter | schemas (Schema) |
| display-modes-list | schema-toggle-filter | schema (Schema) |
| syncs-list | suite-tier-toggle-filter | suite (Suite), tier (Tier) |
| process-catalog | enabled-toggle-filter | enabled (Status) |
| deployment-overview | status-visibility-toggle-filter | status (Status), visibility (Visibility) |
| step-checks | status-mode-toggle-filter | status (Status), mode (Mode) |

## Contextual filters

| View | FilterSpec | Operator | Context Binding |
|------|------------|----------|-----------------|
| backlinks | backlinks-context-filter | equals | context.entity |
| similar-entities | similar-entities-context-filter | embedding_similarity | context.entity |
| unlinked-references | unlinked-references-context-filter | contains | context.entity |
| graph-neighbors | graph-neighbors-context-filter | equals | context.entity |
