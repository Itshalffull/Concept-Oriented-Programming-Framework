// SlotProvider Concept Implementation (Rust)
//
// Surface Provider — manages named content slots within a component tree.
// Slots are placeholders that can be defined, filled with content,
// cleared, and queried.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Initialize ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InitializeOutput {
    #[serde(rename = "ok")]
    Ok { instance: String, plugin_ref: String },
    #[serde(rename = "config_error")]
    ConfigError { message: String },
}

// ── Define ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DefineInput {
    pub slot_name: String,
    pub accepts: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DefineOutput {
    #[serde(rename = "ok")]
    Ok { slot_name: String },
    #[serde(rename = "already_exists")]
    AlreadyExists { message: String },
}

// ── Fill ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FillInput {
    pub slot_name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FillOutput {
    #[serde(rename = "ok")]
    Ok { slot_name: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Clear ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClearInput {
    pub slot_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ClearOutput {
    #[serde(rename = "ok")]
    Ok { slot_name: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── GetSlots ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GetSlotsInput {
    pub filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GetSlotsOutput {
    #[serde(rename = "ok")]
    Ok { slots: String },
}

// ── Handler ─────────────────────────────────────────────

pub struct SlotProviderHandler {
    counter: AtomicU64,
}

impl SlotProviderHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    pub async fn initialize(
        &self,
        input: InitializeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<InitializeOutput> {
        let plugin_ref = "surface-provider:slot".to_string();

        // Idempotent: check for existing registration
        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(InitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(InitializeOutput::ConfigError {
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

        Ok(InitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    pub async fn define(
        &self,
        input: DefineInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineOutput> {
        let existing = storage.get("slot", &input.slot_name).await?;
        if existing.is_some() {
            return Ok(DefineOutput::AlreadyExists {
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

        Ok(DefineOutput::Ok {
            slot_name: input.slot_name,
        })
    }

    pub async fn fill(
        &self,
        input: FillInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FillOutput> {
        let existing = storage.get("slot", &input.slot_name).await?;

        match existing {
            Some(mut rec) => {
                rec["content"] = json!(input.content);
                rec["filled"] = json!(true);
                storage.put("slot", &input.slot_name, rec).await?;

                Ok(FillOutput::Ok {
                    slot_name: input.slot_name,
                })
            }
            None => Ok(FillOutput::NotFound {
                message: format!("slot '{}' not found", input.slot_name),
            }),
        }
    }

    pub async fn clear(
        &self,
        input: ClearInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ClearOutput> {
        let existing = storage.get("slot", &input.slot_name).await?;

        match existing {
            Some(mut rec) => {
                rec["content"] = json!(null);
                rec["filled"] = json!(false);
                storage.put("slot", &input.slot_name, rec).await?;

                Ok(ClearOutput::Ok {
                    slot_name: input.slot_name,
                })
            }
            None => Ok(ClearOutput::NotFound {
                message: format!("slot '{}' not found", input.slot_name),
            }),
        }
    }

    pub async fn get_slots(
        &self,
        input: GetSlotsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetSlotsOutput> {
        let criteria = if input.filter == "filled" {
            Some(json!({ "filled": true }))
        } else if input.filter == "empty" {
            Some(json!({ "filled": false }))
        } else {
            None
        };

        let slots = storage
            .find("slot", criteria.as_ref())
            .await?;
        let slots_json = serde_json::to_string(&slots)?;

        Ok(GetSlotsOutput::Ok { slots: slots_json })
    }
}

// ── Tests ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn initialize_creates_instance_and_plugin_ref() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        let result = handler
            .initialize(
                InitializeInput {
                    config: r#"{"maxSlots":64}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            InitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("slot-"));
                assert_eq!(plugin_ref, "surface-provider:slot");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        let first = handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();
        let second = handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();

        let (i1, i2) = match (&first, &second) {
            (
                InitializeOutput::Ok { instance: i1, .. },
                InitializeOutput::Ok { instance: i2, .. },
            ) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn initialize_returns_config_error_on_empty_config() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        let result = handler
            .initialize(InitializeInput { config: "".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, InitializeOutput::ConfigError { .. }));
    }

    #[tokio::test]
    async fn define_creates_new_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        let result = handler
            .define(
                DefineInput {
                    slot_name: "header".into(),
                    accepts: "component".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DefineOutput::Ok { slot_name } => assert_eq!(slot_name, "header"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn define_rejects_duplicate_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        handler
            .define(
                DefineInput {
                    slot_name: "header".into(),
                    accepts: "component".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .define(
                DefineInput {
                    slot_name: "header".into(),
                    accepts: "text".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DefineOutput::AlreadyExists { .. }));
    }

    #[tokio::test]
    async fn fill_populates_existing_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        handler
            .define(
                DefineInput {
                    slot_name: "sidebar".into(),
                    accepts: "widget".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .fill(
                FillInput {
                    slot_name: "sidebar".into(),
                    content: "<Nav/>".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            FillOutput::Ok { slot_name } => assert_eq!(slot_name, "sidebar"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn fill_returns_not_found_for_missing_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        let result = handler
            .fill(
                FillInput {
                    slot_name: "nonexistent".into(),
                    content: "x".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, FillOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn clear_empties_filled_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        handler
            .define(
                DefineInput {
                    slot_name: "main".into(),
                    accepts: "any".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .fill(
                FillInput {
                    slot_name: "main".into(),
                    content: "content".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .clear(ClearInput { slot_name: "main".into() }, &storage)
            .await
            .unwrap();

        match result {
            ClearOutput::Ok { slot_name } => assert_eq!(slot_name, "main"),
            _ => panic!("expected Ok variant"),
        }

        // Verify it is no longer filled
        let rec = storage.get("slot", "main").await.unwrap().unwrap();
        assert_eq!(rec["filled"], json!(false));
    }

    #[tokio::test]
    async fn clear_returns_not_found_for_missing_slot() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        let result = handler
            .clear(ClearInput { slot_name: "missing".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ClearOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn get_slots_returns_all_slots() {
        let storage = InMemoryStorage::new();
        let handler = SlotProviderHandler::new();

        handler
            .define(
                DefineInput {
                    slot_name: "a".into(),
                    accepts: "any".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .define(
                DefineInput {
                    slot_name: "b".into(),
                    accepts: "any".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_slots(GetSlotsInput { filter: "all".into() }, &storage)
            .await
            .unwrap();

        match result {
            GetSlotsOutput::Ok { slots } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&slots).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }
}
