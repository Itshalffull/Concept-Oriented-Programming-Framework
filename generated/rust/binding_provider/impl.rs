// BindingProvider concept implementation
// Bridges data models to UI widgets via reactive bindings.
// Supports bidirectional sync so data changes propagate to the UI
// and user interactions flow back to the model.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BindingProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct BindingProviderHandlerImpl {
    counter: AtomicU64,
}

impl BindingProviderHandlerImpl {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }
}

#[async_trait]
impl BindingProviderHandler for BindingProviderHandlerImpl {
    async fn initialize(
        &self,
        input: BindingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderInitializeOutput, Box<dyn std::error::Error>> {
        let plugin_ref = "surface-provider:binding".to_string();

        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(BindingProviderInitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(BindingProviderInitializeOutput::ConfigError {
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

        Ok(BindingProviderInitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    async fn bind(
        &self,
        input: BindingProviderBindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderBindOutput, Box<dyn std::error::Error>> {
        let valid_modes = ["one-way", "two-way", "one-time"];
        if !valid_modes.contains(&input.mode.as_str()) {
            return Ok(BindingProviderBindOutput::Error {
                message: format!(
                    "invalid binding mode '{}'; expected one of: one-way, two-way, one-time",
                    input.mode
                ),
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

        Ok(BindingProviderBindOutput::Ok { binding_id })
    }

    async fn sync(
        &self,
        input: BindingProviderSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderSyncOutput, Box<dyn std::error::Error>> {
        let record = storage.get("binding", &input.binding_id).await?;

        match record {
            Some(rec) => {
                let active = rec["active"].as_bool().unwrap_or(false);
                if !active {
                    return Ok(BindingProviderSyncOutput::Ok {
                        binding_id: input.binding_id,
                        synced: false,
                    });
                }

                let mut updated = rec.clone();
                updated["lastValue"] = json!(input.value);
                storage.put("binding", &input.binding_id, updated).await?;

                Ok(BindingProviderSyncOutput::Ok {
                    binding_id: input.binding_id,
                    synced: true,
                })
            }
            None => Ok(BindingProviderSyncOutput::NotFound {
                message: format!("binding '{}' not found", input.binding_id),
            }),
        }
    }

    async fn invoke(
        &self,
        input: BindingProviderInvokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderInvokeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("binding", &input.binding_id).await?;

        match record {
            Some(_) => Ok(BindingProviderInvokeOutput::Ok {
                result: format!(
                    "invoked '{}' on binding '{}' with payload",
                    input.action, input.binding_id
                ),
            }),
            None => Ok(BindingProviderInvokeOutput::NotFound {
                message: format!("binding '{}' not found", input.binding_id),
            }),
        }
    }

    async fn unbind(
        &self,
        input: BindingProviderUnbindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderUnbindOutput, Box<dyn std::error::Error>> {
        let record = storage.get("binding", &input.binding_id).await?;

        match record {
            Some(_) => {
                storage.del("binding", &input.binding_id).await?;
                Ok(BindingProviderUnbindOutput::Ok {
                    binding_id: input.binding_id,
                })
            }
            None => Ok(BindingProviderUnbindOutput::NotFound {
                message: format!("binding '{}' not found", input.binding_id),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_instance() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let result = handler.initialize(
            BindingProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BindingProviderInitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("binding-"));
                assert_eq!(plugin_ref, "surface-provider:binding");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let first = handler.initialize(
            BindingProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let second = handler.initialize(
            BindingProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let (i1, i2) = match (&first, &second) {
            (BindingProviderInitializeOutput::Ok { instance: i1, .. },
             BindingProviderInitializeOutput::Ok { instance: i2, .. }) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn test_bind_valid_mode() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let result = handler.bind(
            BindingProviderBindInput {
                source: "model.title".to_string(),
                target: "widget.label".to_string(),
                mode: "two-way".to_string(),
            },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, BindingProviderBindOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn test_bind_invalid_mode() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let result = handler.bind(
            BindingProviderBindInput {
                source: "a".to_string(),
                target: "b".to_string(),
                mode: "invalid".to_string(),
            },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, BindingProviderBindOutput::Error { .. }));
    }

    #[tokio::test]
    async fn test_sync_active_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let bind_result = handler.bind(
            BindingProviderBindInput {
                source: "s".to_string(),
                target: "t".to_string(),
                mode: "two-way".to_string(),
            },
            &storage,
        ).await.unwrap();
        let binding_id = match bind_result {
            BindingProviderBindOutput::Ok { binding_id } => binding_id,
            _ => panic!("expected Ok"),
        };
        let result = handler.sync(
            BindingProviderSyncInput { binding_id, value: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BindingProviderSyncOutput::Ok { synced, .. } => assert!(synced),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_unbind_removes_binding() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let bind_result = handler.bind(
            BindingProviderBindInput {
                source: "s".to_string(),
                target: "t".to_string(),
                mode: "one-way".to_string(),
            },
            &storage,
        ).await.unwrap();
        let binding_id = match bind_result {
            BindingProviderBindOutput::Ok { binding_id } => binding_id,
            _ => panic!("expected Ok"),
        };
        let result = handler.unbind(
            BindingProviderUnbindInput { binding_id: binding_id.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, BindingProviderUnbindOutput::Ok { .. }));
        let gone = storage.get("binding", &binding_id).await.unwrap();
        assert!(gone.is_none());
    }

    #[tokio::test]
    async fn test_unbind_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BindingProviderHandlerImpl::new();
        let result = handler.unbind(
            BindingProviderUnbindInput { binding_id: "nope".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, BindingProviderUnbindOutput::NotFound { .. }));
    }
}
