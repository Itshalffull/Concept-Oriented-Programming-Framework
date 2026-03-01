// ActionEntity concept implementation
// Action declaration with full lifecycle tracing from spec through sync participation,
// implementation, interface exposure, to runtime invocation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ActionEntityHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("action-entity-{}", id)
}

pub struct ActionEntityHandlerImpl;

#[async_trait]
impl ActionEntityHandler for ActionEntityHandlerImpl {
    async fn register(
        &self,
        input: ActionEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityRegisterOutput, Box<dyn std::error::Error>> {
        // Check for duplicate by concept + name
        let existing = storage.find("action-entity", Some(&json!({
            "concept": input.concept,
            "name": input.name
        }))).await?;

        if !existing.is_empty() {
            let id = existing[0]["id"].as_str().unwrap_or("").to_string();
            return Ok(ActionEntityRegisterOutput::Ok { action: id });
        }

        let id = next_id();
        let symbol = format!("clef/action/{}/{}", input.concept, input.name);

        let variant_count: i64 = serde_json::from_str::<Vec<serde_json::Value>>(&input.variant_refs)
            .map(|v| v.len() as i64)
            .unwrap_or(0);

        storage.put("action-entity", &id, json!({
            "id": id,
            "concept": input.concept,
            "name": input.name,
            "symbol": symbol,
            "params": input.params,
            "variantRefs": input.variant_refs,
            "variantCount": variant_count,
            "implementationSymbols": "[]",
        })).await?;

        Ok(ActionEntityRegisterOutput::Ok { action: id })
    }

    async fn find_by_concept(
        &self,
        input: ActionEntityFindByConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityFindByConceptOutput, Box<dyn std::error::Error>> {
        let criteria = if input.concept.is_empty() {
            None
        } else {
            Some(json!({ "concept": input.concept }))
        };
        let results = storage.find("action-entity", criteria.as_ref()).await?;
        Ok(ActionEntityFindByConceptOutput::Ok {
            actions: serde_json::to_string(&results)?,
        })
    }

    async fn triggering_syncs(
        &self,
        input: ActionEntityTriggeringSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityTriggeringSyncsOutput, Box<dyn std::error::Error>> {
        let action_record = storage.get("action-entity", &input.action).await?;
        let action_record = match action_record {
            Some(r) => r,
            None => return Ok(ActionEntityTriggeringSyncsOutput::Ok { syncs: "[]".to_string() }),
        };

        let concept = action_record["concept"].as_str().unwrap_or("");
        let name = action_record["name"].as_str().unwrap_or("");

        let all_syncs = storage.find("sync-entity", None).await?;
        let matching: Vec<_> = all_syncs.into_iter().filter(|s| {
            if let Ok(compiled) = serde_json::from_str::<serde_json::Value>(
                s["compiled"].as_str().unwrap_or("{}")
            ) {
                if let Some(when_patterns) = compiled["when"].as_array() {
                    return when_patterns.iter().any(|w| {
                        w["concept"].as_str() == Some(concept) && w["action"].as_str() == Some(name)
                    });
                }
            }
            false
        }).collect();

        Ok(ActionEntityTriggeringSyncsOutput::Ok {
            syncs: serde_json::to_string(&matching)?,
        })
    }

    async fn invoking_syncs(
        &self,
        input: ActionEntityInvokingSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityInvokingSyncsOutput, Box<dyn std::error::Error>> {
        let action_record = storage.get("action-entity", &input.action).await?;
        let action_record = match action_record {
            Some(r) => r,
            None => return Ok(ActionEntityInvokingSyncsOutput::Ok { syncs: "[]".to_string() }),
        };

        let concept = action_record["concept"].as_str().unwrap_or("");
        let name = action_record["name"].as_str().unwrap_or("");

        let all_syncs = storage.find("sync-entity", None).await?;
        let matching: Vec<_> = all_syncs.into_iter().filter(|s| {
            if let Ok(compiled) = serde_json::from_str::<serde_json::Value>(
                s["compiled"].as_str().unwrap_or("{}")
            ) {
                if let Some(then_actions) = compiled["then"].as_array() {
                    return then_actions.iter().any(|t| {
                        t["concept"].as_str() == Some(concept) && t["action"].as_str() == Some(name)
                    });
                }
            }
            false
        }).collect();

        Ok(ActionEntityInvokingSyncsOutput::Ok {
            syncs: serde_json::to_string(&matching)?,
        })
    }

    async fn implementations(
        &self,
        input: ActionEntityImplementationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityImplementationsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("action-entity", &input.action).await?;
        match record {
            Some(r) => {
                let symbols = r["implementationSymbols"].as_str().unwrap_or("[]").to_string();
                Ok(ActionEntityImplementationsOutput::Ok { symbols })
            }
            None => Ok(ActionEntityImplementationsOutput::Ok { symbols: "[]".to_string() }),
        }
    }

    async fn interface_exposures(
        &self,
        input: ActionEntityInterfaceExposuresInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityInterfaceExposuresOutput, Box<dyn std::error::Error>> {
        let record = storage.get("action-entity", &input.action).await?;
        match record {
            Some(r) => {
                let symbol = r["symbol"].as_str().unwrap_or("");
                let exposures = storage.find("interface-exposure", Some(&json!({
                    "actionSymbol": symbol
                }))).await?;
                Ok(ActionEntityInterfaceExposuresOutput::Ok {
                    exposures: serde_json::to_string(&exposures)?,
                })
            }
            None => Ok(ActionEntityInterfaceExposuresOutput::Ok {
                exposures: "[]".to_string(),
            }),
        }
    }

    async fn get(
        &self,
        input: ActionEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("action-entity", &input.action).await?;
        match record {
            Some(r) => Ok(ActionEntityGetOutput::Ok {
                action: r["id"].as_str().unwrap_or("").to_string(),
                concept: r["concept"].as_str().unwrap_or("").to_string(),
                name: r["name"].as_str().unwrap_or("").to_string(),
                params: r["params"].as_str().unwrap_or("").to_string(),
                variant_count: r["variantCount"].as_i64().unwrap_or(0),
            }),
            None => Ok(ActionEntityGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_creates_action_entity() {
        let storage = InMemoryStorage::new();
        let handler = ActionEntityHandlerImpl;
        let result = handler.register(
            ActionEntityRegisterInput {
                concept: "article".to_string(),
                name: "create".to_string(),
                params: "title,body".to_string(),
                variant_refs: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionEntityRegisterOutput::Ok { action } => {
                assert!(!action.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_find_by_concept_returns_registered_actions() {
        let storage = InMemoryStorage::new();
        let handler = ActionEntityHandlerImpl;
        handler.register(
            ActionEntityRegisterInput {
                concept: "user".to_string(),
                name: "login".to_string(),
                params: "credentials".to_string(),
                variant_refs: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_by_concept(
            ActionEntityFindByConceptInput {
                concept: "user".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionEntityFindByConceptOutput::Ok { actions } => {
                assert!(!actions.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_get_existing_action() {
        let storage = InMemoryStorage::new();
        let handler = ActionEntityHandlerImpl;
        let reg = handler.register(
            ActionEntityRegisterInput {
                concept: "profile".to_string(),
                name: "update".to_string(),
                params: "bio".to_string(),
                variant_refs: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        let action_id = match reg {
            ActionEntityRegisterOutput::Ok { action } => action,
        };
        let result = handler.get(
            ActionEntityGetInput { action: action_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ActionEntityGetOutput::Ok { concept, name, .. } => {
                assert_eq!(concept, "profile");
                assert_eq!(name, "update");
            }
            ActionEntityGetOutput::Notfound => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_action_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ActionEntityHandlerImpl;
        let result = handler.get(
            ActionEntityGetInput { action: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ActionEntityGetOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_triggering_syncs_returns_empty_for_missing_action() {
        let storage = InMemoryStorage::new();
        let handler = ActionEntityHandlerImpl;
        let result = handler.triggering_syncs(
            ActionEntityTriggeringSyncsInput { action: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ActionEntityTriggeringSyncsOutput::Ok { syncs } => {
                assert_eq!(syncs, "[]");
            }
        }
    }

    #[tokio::test]
    async fn test_implementations_returns_empty_for_new_action() {
        let storage = InMemoryStorage::new();
        let handler = ActionEntityHandlerImpl;
        let reg = handler.register(
            ActionEntityRegisterInput {
                concept: "echo".to_string(),
                name: "ping".to_string(),
                params: "".to_string(),
                variant_refs: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        let action_id = match reg {
            ActionEntityRegisterOutput::Ok { action } => action,
        };
        let result = handler.implementations(
            ActionEntityImplementationsInput { action: action_id },
            &storage,
        ).await.unwrap();
        match result {
            ActionEntityImplementationsOutput::Ok { symbols } => {
                assert_eq!(symbols, "[]");
            }
        }
    }
}
