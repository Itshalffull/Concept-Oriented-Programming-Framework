// SyncEntity concept implementation
// Manages the registry of compiled sync definitions as entities.
// Supports lookup by concept, by trigger action/variant, chain traversal,
// dead-end detection, and orphan variant analysis.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncEntityHandler;
use serde_json::json;

pub struct SyncEntityHandlerImpl;

#[async_trait]
impl SyncEntityHandler for SyncEntityHandlerImpl {
    async fn register(
        &self,
        input: SyncEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityRegisterOutput, Box<dyn std::error::Error>> {
        // Check if already registered
        let existing = storage.get("sync_entity", &input.name).await?;
        if let Some(e) = existing {
            let existing_ref = e.get("sync")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            return Ok(SyncEntityRegisterOutput::AlreadyRegistered {
                existing: existing_ref,
            });
        }

        // Parse the compiled sync to extract metadata
        let compiled: serde_json::Value = serde_json::from_str(&input.compiled)
            .unwrap_or(json!({}));

        let annotations = compiled.get("annotations")
            .map(|v| serde_json::to_string(v).unwrap_or_default())
            .unwrap_or_else(|| "{}".to_string());

        let when_count = compiled.get("when")
            .and_then(|v| v.as_array())
            .map(|a| a.len() as i64)
            .unwrap_or(0);

        let then_count = compiled.get("then")
            .and_then(|v| v.as_array())
            .map(|a| a.len() as i64)
            .unwrap_or(0);

        // Determine tier based on annotations
        let tier = if let Some(ann) = compiled.get("annotations") {
            if ann.get("gate").and_then(|v| v.as_bool()).unwrap_or(false) {
                "gate"
            } else {
                "standard"
            }
        } else {
            "standard"
        };

        let sync_id = format!("sync:{}", input.name);

        storage.put("sync_entity", &input.name, json!({
            "sync": &sync_id,
            "name": &input.name,
            "source": &input.source,
            "compiled": &input.compiled,
            "annotations": &annotations,
            "tier": tier,
            "whenPatternCount": when_count,
            "thenActionCount": then_count,
        })).await?;

        // Index by concepts referenced in when-clause
        if let Some(when_patterns) = compiled.get("when").and_then(|v| v.as_array()) {
            for pattern in when_patterns {
                if let Some(concept) = pattern.get("concept").and_then(|v| v.as_str()) {
                    let idx_key = format!("concept:{}:{}", concept, input.name);
                    storage.put("sync_concept_index", &idx_key, json!({
                        "syncName": &input.name,
                        "concept": concept,
                    })).await?;
                }

                // Index by action:variant for trigger lookup
                let action = pattern.get("action").and_then(|v| v.as_str()).unwrap_or("");
                let variant = pattern.get("variant").and_then(|v| v.as_str()).unwrap_or("*");
                let trigger_key = format!("trigger:{}:{}:{}", action, variant, input.name);
                storage.put("sync_trigger_index", &trigger_key, json!({
                    "syncName": &input.name,
                    "action": action,
                    "variant": variant,
                })).await?;
            }
        }

        Ok(SyncEntityRegisterOutput::Ok { sync: sync_id })
    }

    async fn find_by_concept(
        &self,
        input: SyncEntityFindByConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindByConceptOutput, Box<dyn std::error::Error>> {
        let index_entries = storage.find("sync_concept_index", Some(&json!({
            "concept": &input.concept,
        }))).await?;

        let sync_names: Vec<String> = index_entries.iter()
            .filter_map(|e| e.get("syncName").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        Ok(SyncEntityFindByConceptOutput::Ok {
            syncs: serde_json::to_string(&sync_names).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn find_triggerable_by(
        &self,
        input: SyncEntityFindTriggerableByInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindTriggerableByOutput, Box<dyn std::error::Error>> {
        // Look for syncs triggered by this action:variant
        let entries = storage.find("sync_trigger_index", Some(&json!({
            "action": &input.action,
            "variant": &input.variant,
        }))).await?;

        // Also check wildcard triggers
        let wildcard_entries = storage.find("sync_trigger_index", Some(&json!({
            "action": &input.action,
            "variant": "*",
        }))).await?;

        let mut sync_names: Vec<String> = entries.iter()
            .chain(wildcard_entries.iter())
            .filter_map(|e| e.get("syncName").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();
        sync_names.sort();
        sync_names.dedup();

        Ok(SyncEntityFindTriggerableByOutput::Ok {
            syncs: serde_json::to_string(&sync_names).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn chain_from(
        &self,
        input: SyncEntityChainFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityChainFromOutput, Box<dyn std::error::Error>> {
        let max_depth = input.depth;
        let mut chain = Vec::new();
        let mut current_action = input.action.clone();
        let mut current_variant = input.variant.clone();

        for _ in 0..max_depth {
            let entries = storage.find("sync_trigger_index", Some(&json!({
                "action": &current_action,
                "variant": &current_variant,
            }))).await?;

            if entries.is_empty() {
                break;
            }

            for entry in &entries {
                let sync_name = entry.get("syncName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if let Some(entity) = storage.get("sync_entity", sync_name).await? {
                    chain.push(json!({
                        "syncName": sync_name,
                        "triggeredBy": format!("{}:{}", current_action, current_variant),
                    }));

                    // Get the then-clause to find the next action in the chain
                    if let Ok(compiled) = serde_json::from_str::<serde_json::Value>(
                        entity.get("compiled").and_then(|v| v.as_str()).unwrap_or("{}")
                    ) {
                        if let Some(then_actions) = compiled.get("then").and_then(|v| v.as_array()) {
                            if let Some(first_then) = then_actions.first() {
                                current_action = first_then.get("action")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                current_variant = "*".to_string();
                            }
                        }
                    }
                }
            }
        }

        if chain.is_empty() {
            Ok(SyncEntityChainFromOutput::NoChain)
        } else {
            Ok(SyncEntityChainFromOutput::Ok {
                chain: serde_json::to_string(&chain).unwrap_or_else(|_| "[]".to_string()),
            })
        }
    }

    async fn find_dead_ends(
        &self,
        _input: SyncEntityFindDeadEndsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindDeadEndsOutput, Box<dyn std::error::Error>> {
        // Dead ends are syncs whose then-clause actions are never consumed by another sync's when-clause
        let all_entities = storage.find("sync_entity", None).await?;
        let all_triggers = storage.find("sync_trigger_index", None).await?;

        let triggered_actions: std::collections::HashSet<String> = all_triggers.iter()
            .filter_map(|t| t.get("action").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        let mut dead_ends = Vec::new();

        for entity in &all_entities {
            let name = entity.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let compiled_str = entity.get("compiled").and_then(|v| v.as_str()).unwrap_or("{}");

            if let Ok(compiled) = serde_json::from_str::<serde_json::Value>(compiled_str) {
                if let Some(then_actions) = compiled.get("then").and_then(|v| v.as_array()) {
                    for then_action in then_actions {
                        let action = then_action.get("action")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if !action.is_empty() && !triggered_actions.contains(action) {
                            dead_ends.push(json!({
                                "syncName": name,
                                "deadAction": action,
                            }));
                        }
                    }
                }
            }
        }

        Ok(SyncEntityFindDeadEndsOutput::Ok {
            dead_ends: serde_json::to_string(&dead_ends).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn find_orphan_variants(
        &self,
        _input: SyncEntityFindOrphanVariantsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindOrphanVariantsOutput, Box<dyn std::error::Error>> {
        // Orphan variants are trigger patterns that reference variants
        // which no action in the system ever produces
        let all_triggers = storage.find("sync_trigger_index", None).await?;
        let mut orphans = Vec::new();

        for trigger in &all_triggers {
            let variant = trigger.get("variant")
                .and_then(|v| v.as_str())
                .unwrap_or("*");

            if variant != "*" {
                // Check if any sync produces this variant
                let sync_name = trigger.get("syncName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                orphans.push(json!({
                    "syncName": sync_name,
                    "variant": variant,
                }));
            }
        }

        Ok(SyncEntityFindOrphanVariantsOutput::Ok {
            orphans: serde_json::to_string(&orphans).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn get(
        &self,
        input: SyncEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityGetOutput, Box<dyn std::error::Error>> {
        let entity = storage.get("sync_entity", &input.sync).await?;

        match entity {
            Some(e) => {
                let sync = e.get("sync").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let name = e.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let annotations = e.get("annotations").and_then(|v| v.as_str()).unwrap_or("{}").to_string();
                let tier = e.get("tier").and_then(|v| v.as_str()).unwrap_or("standard").to_string();
                let when_pattern_count = e.get("whenPatternCount").and_then(|v| v.as_i64()).unwrap_or(0);
                let then_action_count = e.get("thenActionCount").and_then(|v| v.as_i64()).unwrap_or(0);

                Ok(SyncEntityGetOutput::Ok {
                    sync,
                    name,
                    annotations,
                    tier,
                    when_pattern_count,
                    then_action_count,
                })
            }
            None => Ok(SyncEntityGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_sync_entity() {
        let storage = InMemoryStorage::new();
        let handler = SyncEntityHandlerImpl;
        let result = handler.register(
            SyncEntityRegisterInput {
                name: "UserFollowSync".to_string(),
                source: "sync/user-follow.sync".to_string(),
                compiled: r#"{"name":"UserFollowSync","when":[{"concept":"User","action":"follow"}],"then":[{"concept":"Follow","action":"create"}]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEntityRegisterOutput::Ok { sync } => {
                assert!(sync.contains("UserFollowSync"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = SyncEntityHandlerImpl;
        handler.register(
            SyncEntityRegisterInput {
                name: "TestSync".to_string(),
                source: "sync/test.sync".to_string(),
                compiled: r#"{"name":"TestSync","when":[],"then":[]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            SyncEntityRegisterInput {
                name: "TestSync".to_string(),
                source: "sync/test.sync".to_string(),
                compiled: r#"{"name":"TestSync","when":[],"then":[]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEntityRegisterOutput::AlreadyRegistered { .. } => {},
            _ => panic!("Expected AlreadyRegistered variant"),
        }
    }

    #[tokio::test]
    async fn test_get_existing() {
        let storage = InMemoryStorage::new();
        let handler = SyncEntityHandlerImpl;
        handler.register(
            SyncEntityRegisterInput {
                name: "TestSync".to_string(),
                source: "test.sync".to_string(),
                compiled: r#"{"name":"TestSync","when":[{"concept":"A"}],"then":[{"action":"b"}]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            SyncEntityGetInput { sync: "TestSync".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncEntityGetOutput::Ok { name, .. } => {
                assert_eq!(name, "TestSync");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncEntityHandlerImpl;
        let result = handler.get(
            SyncEntityGetInput { sync: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_chain_from_no_chain() {
        let storage = InMemoryStorage::new();
        let handler = SyncEntityHandlerImpl;
        let result = handler.chain_from(
            SyncEntityChainFromInput {
                action: "nonexistent".to_string(),
                variant: "ok".to_string(),
                depth: 5,
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEntityChainFromOutput::NoChain => {},
            _ => panic!("Expected NoChain variant"),
        }
    }
}
