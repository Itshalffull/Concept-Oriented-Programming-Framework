// BindingProvider Concept Implementation (Rust)
//
// Surface Provider — bridges data models to UI widgets via reactive bindings.
// Supports bidirectional sync so that data changes propagate to the UI
// and user interactions flow back to the model.

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

// ── Bind ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindInput {
    pub source: String,
    pub target: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BindOutput {
    #[serde(rename = "ok")]
    Ok { binding_id: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Sync ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncInput {
    pub binding_id: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncOutput {
    #[serde(rename = "ok")]
    Ok { binding_id: String, synced: bool },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Invoke ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvokeInput {
    pub binding_id: String,
    pub action: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InvokeOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Unbind ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UnbindInput {
    pub binding_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UnbindOutput {
    #[serde(rename = "ok")]
    Ok { binding_id: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Handler ─────────────────────────────────────────────

pub struct BindingProviderHandler {
    counter: AtomicU64,
}

impl BindingProviderHandler {
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
        let plugin_ref = "surface-provider:binding".to_string();

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
        let instance = format!("binding-{}", id);

        storage
            .put(
                "binding_provider",
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
                    "type": "binding-provider",
                }),
            )
            .await?;

        Ok(InitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    pub async fn bind(
        &self,
        input: BindInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<BindOutput> {
        let valid_modes = ["one-way", "two-way", "one-time"];
        if !valid_modes.contains(&input.mode.as_str()) {
            return Ok(BindOutput::Error {
                message: format!("invalid binding mode '{}'; expected one of: one-way, two-way, one-time", input.mode),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let binding_id = format!("bind-{}", id);

        storage
            .put(
                "binding",
                &binding_id,
                json!({
                    "bindingId": binding_id,
                    "source": input.source,
                    "target": input.target,
                    "mode": input.mode,
                    "active": true,
                }),
            )
            .await?;

        Ok(BindOutput::Ok { binding_id })
    }

    pub async fn sync(
        &self,
        input: SyncInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncOutput> {
        let record = storage.get("binding", &input.binding_id).await?;

        match record {
            Some(rec) => {
                let active = rec["active"].as_bool().unwrap_or(false);
                if !active {
                    return Ok(SyncOutput::Ok {
                        binding_id: input.binding_id,
                        synced: false,
                    });
                }

                // Update binding with latest value
                let mut updated = rec.clone();
                updated["lastValue"] = json!(input.value);
                storage
                    .put("binding", &input.binding_id, updated)
                    .await?;

                Ok(SyncOutput::Ok {
                    binding_id: input.binding_id,
                    synced: true,
                })
            }
            None => Ok(SyncOutput::NotFound {
                message: format!("binding '{}' not found", input.binding_id),
            }),
        }
    }

    pub async fn invoke(
        &self,
        input: InvokeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<InvokeOutput> {
        let record = storage.get("binding", &input.binding_id).await?;

        match record {
            Some(_rec) => Ok(InvokeOutput::Ok {
                result: format!(
                    "invoked '{}' on binding '{}' with payload",
                    input.action, input.binding_id
                ),
            }),
            None => Ok(InvokeOutput::NotFound {
                message: format!("binding '{}' not found", input.binding_id),
            }),
        }
    }

    pub async fn unbind(
        &self,
        input: UnbindInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<UnbindOutput> {
        let record = storage.get("binding", &input.binding_id).await?;

        match record {
            Some(_) => {
                storage.del("binding", &input.binding_id).await?;
                Ok(UnbindOutput::Ok {
                    binding_id: input.binding_id,
                })
            }
            None => Ok(UnbindOutput::NotFound {
                message: format!("binding '{}' not found", input.binding_id),
            }),
        }
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
        let handler = BindingProviderHandler::new();

        let result = handler
            .initialize(
                InitializeInput {
                    config: r#"{"mode":"reactive"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            InitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("binding-"));
                assert_eq!(plugin_ref, "surface-provider:binding");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

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
        let handler = BindingProviderHandler::new();

        let result = handler
            .initialize(InitializeInput { config: "".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, InitializeOutput::ConfigError { .. }));
    }

    #[tokio::test]
    async fn bind_creates_binding_with_valid_mode() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let result = handler
            .bind(
                BindInput {
                    source: "model.title".into(),
                    target: "widget.label".into(),
                    mode: "two-way".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, BindOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn bind_rejects_invalid_mode() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let result = handler
            .bind(
                BindInput {
                    source: "a".into(),
                    target: "b".into(),
                    mode: "invalid".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, BindOutput::Error { .. }));
    }

    #[tokio::test]
    async fn sync_updates_active_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let bind_result = handler
            .bind(
                BindInput {
                    source: "s".into(),
                    target: "t".into(),
                    mode: "two-way".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let binding_id = match bind_result {
            BindOutput::Ok { binding_id } => binding_id,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .sync(
                SyncInput {
                    binding_id: binding_id.clone(),
                    value: "hello".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            SyncOutput::Ok { synced, .. } => assert!(synced),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn sync_returns_not_found_for_missing_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let result = handler
            .sync(
                SyncInput {
                    binding_id: "missing".into(),
                    value: "v".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SyncOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn invoke_succeeds_on_existing_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let bind_result = handler
            .bind(
                BindInput {
                    source: "s".into(),
                    target: "t".into(),
                    mode: "one-way".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let binding_id = match bind_result {
            BindOutput::Ok { binding_id } => binding_id,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .invoke(
                InvokeInput {
                    binding_id,
                    action: "refresh".into(),
                    payload: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, InvokeOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn unbind_removes_existing_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let bind_result = handler
            .bind(
                BindInput {
                    source: "s".into(),
                    target: "t".into(),
                    mode: "one-way".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let binding_id = match bind_result {
            BindOutput::Ok { binding_id } => binding_id,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .unbind(UnbindInput { binding_id: binding_id.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, UnbindOutput::Ok { .. }));

        // Confirm it is gone
        let gone = storage.get("binding", &binding_id).await.unwrap();
        assert!(gone.is_none());
    }

    #[tokio::test]
    async fn unbind_returns_not_found_for_missing_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandler::new();

        let result = handler
            .unbind(UnbindInput { binding_id: "nope".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, UnbindOutput::NotFound { .. }));
    }
}
