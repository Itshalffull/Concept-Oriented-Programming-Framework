// SlotProvider concept implementation
// Manages named content slots within a component tree.
// Slots are placeholders that can be defined, filled with content,
// cleared, and queried.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SlotProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct SlotProviderHandlerImpl {
    counter: AtomicU64,
}

impl SlotProviderHandlerImpl {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }
}

#[async_trait]
impl SlotProviderHandler for SlotProviderHandlerImpl {
    async fn initialize(
        &self,
        input: SlotProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderInitializeOutput, Box<dyn std::error::Error>> {
        let plugin_ref = "surface-provider:slot".to_string();

        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(SlotProviderInitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(SlotProviderInitializeOutput::ConfigError {
                message: "config must not be empty".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let instance = format!("slot-{}", id);

        storage
            .put(
                "slot_provider",
                &instance,
                json!({
                    "instance": instance,
                    "pluginRef": plugin_ref,
                    "config": input.config,
                }),
            )
            .await?;

        storage
            .put(
                "plugin_definition",
                &plugin_ref,
                json!({
                    "pluginRef": plugin_ref,
                    "instance": instance,
                    "type": "slot-provider",
                }),
            )
            .await?;

        Ok(SlotProviderInitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    async fn define(
        &self,
        input: SlotProviderDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderDefineOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("slot", &input.slot_name).await?;
        if existing.is_some() {
            return Ok(SlotProviderDefineOutput::AlreadyExists {
                message: format!("slot '{}' already defined", input.slot_name),
            });
        }

        storage
            .put(
                "slot",
                &input.slot_name,
                json!({
                    "slotName": input.slot_name,
                    "accepts": input.accepts,
                    "filled": false,
                    "content": null,
                }),
            )
            .await?;

        Ok(SlotProviderDefineOutput::Ok {
            slot_name: input.slot_name,
        })
    }

    async fn fill(
        &self,
        input: SlotProviderFillInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderFillOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("slot", &input.slot_name).await?;

        match existing {
            Some(mut rec) => {
                rec["content"] = json!(input.content);
                rec["filled"] = json!(true);
                storage.put("slot", &input.slot_name, rec).await?;

                Ok(SlotProviderFillOutput::Ok {
                    slot_name: input.slot_name,
                })
            }
            None => Ok(SlotProviderFillOutput::NotFound {
                message: format!("slot '{}' not found", input.slot_name),
            }),
        }
    }

    async fn clear(
        &self,
        input: SlotProviderClearInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderClearOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("slot", &input.slot_name).await?;

        match existing {
            Some(mut rec) => {
                rec["content"] = json!(null);
                rec["filled"] = json!(false);
                storage.put("slot", &input.slot_name, rec).await?;

                Ok(SlotProviderClearOutput::Ok {
                    slot_name: input.slot_name,
                })
            }
            None => Ok(SlotProviderClearOutput::NotFound {
                message: format!("slot '{}' not found", input.slot_name),
            }),
        }
    }

    async fn get_slots(
        &self,
        input: SlotProviderGetSlotsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderGetSlotsOutput, Box<dyn std::error::Error>> {
        let criteria = if input.filter == "filled" {
            Some(json!({ "filled": true }))
        } else if input.filter == "empty" {
            Some(json!({ "filled": false }))
        } else {
            None
        };

        let slots = storage.find("slot", criteria.as_ref()).await?;
        let slots_json = serde_json::to_string(&slots)?;

        Ok(SlotProviderGetSlotsOutput::Ok { slots: slots_json })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_instance() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        let result = handler.initialize(
            SlotProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotProviderInitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("slot-"));
                assert_eq!(plugin_ref, "surface-provider:slot");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        let first = handler.initialize(
            SlotProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let second = handler.initialize(
            SlotProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let (i1, i2) = match (&first, &second) {
            (SlotProviderInitializeOutput::Ok { instance: i1, .. },
             SlotProviderInitializeOutput::Ok { instance: i2, .. }) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn test_define_creates_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        let result = handler.define(
            SlotProviderDefineInput {
                slot_name: "header".to_string(),
                accepts: "component".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SlotProviderDefineOutput::Ok { slot_name } => assert_eq!(slot_name, "header"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_rejects_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        handler.define(
            SlotProviderDefineInput { slot_name: "header".to_string(), accepts: "component".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            SlotProviderDefineInput { slot_name: "header".to_string(), accepts: "text".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, SlotProviderDefineOutput::AlreadyExists { .. }));
    }

    #[tokio::test]
    async fn test_fill_populates_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        handler.define(
            SlotProviderDefineInput { slot_name: "sidebar".to_string(), accepts: "widget".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.fill(
            SlotProviderFillInput { slot_name: "sidebar".to_string(), content: "<Nav/>".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotProviderFillOutput::Ok { slot_name } => assert_eq!(slot_name, "sidebar"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fill_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        let result = handler.fill(
            SlotProviderFillInput { slot_name: "missing".to_string(), content: "x".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, SlotProviderFillOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn test_clear_empties_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        handler.define(
            SlotProviderDefineInput { slot_name: "main".to_string(), accepts: "any".to_string() },
            &storage,
        ).await.unwrap();
        handler.fill(
            SlotProviderFillInput { slot_name: "main".to_string(), content: "content".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.clear(
            SlotProviderClearInput { slot_name: "main".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotProviderClearOutput::Ok { slot_name } => assert_eq!(slot_name, "main"),
            _ => panic!("expected Ok variant"),
        }
        let rec = storage.get("slot", "main").await.unwrap().unwrap();
        assert_eq!(rec["filled"], json!(false));
    }

    #[tokio::test]
    async fn test_get_slots_returns_all() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandlerImpl::new();
        handler.define(
            SlotProviderDefineInput { slot_name: "a".to_string(), accepts: "any".to_string() },
            &storage,
        ).await.unwrap();
        handler.define(
            SlotProviderDefineInput { slot_name: "b".to_string(), accepts: "any".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.get_slots(
            SlotProviderGetSlotsInput { filter: "all".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotProviderGetSlotsOutput::Ok { slots } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&slots).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }
}
