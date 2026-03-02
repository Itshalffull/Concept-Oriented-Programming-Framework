// MachineProvider concept implementation
// Manages finite state machines that drive UI behavior.
// Each machine is spawned from a definition, receives events via send,
// and can be connected to other machines or destroyed.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MachineProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct MachineProviderHandlerImpl {
    counter: AtomicU64,
}

impl MachineProviderHandlerImpl {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }
}

#[async_trait]
impl MachineProviderHandler for MachineProviderHandlerImpl {
    async fn initialize(
        &self,
        input: MachineProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderInitializeOutput, Box<dyn std::error::Error>> {
        let plugin_ref = "surface-provider:machine".to_string();

        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(MachineProviderInitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(MachineProviderInitializeOutput::ConfigError {
                message: "config must not be empty".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let instance = format!("machine-{}", id);

        storage
            .put(
                "machine_provider",
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
                    "type": "machine-provider",
                }),
            )
            .await?;

        Ok(MachineProviderInitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    async fn spawn(
        &self,
        input: MachineProviderSpawnInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderSpawnOutput, Box<dyn std::error::Error>> {
        if input.machine_def.is_empty() {
            return Ok(MachineProviderSpawnOutput::Error {
                message: "machine_def must not be empty".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let machine_id = format!("machine-{}", id);

        storage
            .put(
                "machine",
                &machine_id,
                json!({
                    "machineId": machine_id,
                    "definition": input.machine_def,
                    "state": input.initial_state,
                    "active": true,
                }),
            )
            .await?;

        Ok(MachineProviderSpawnOutput::Ok {
            machine_id,
            state: input.initial_state,
        })
    }

    async fn send(
        &self,
        input: MachineProviderSendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderSendOutput, Box<dyn std::error::Error>> {
        let record = storage.get("machine", &input.machine_id).await?;

        match record {
            Some(mut rec) => {
                let new_state = format!(
                    "{}_after_{}",
                    rec["state"].as_str().unwrap_or("unknown"),
                    input.event
                );
                rec["state"] = json!(new_state);
                storage.put("machine", &input.machine_id, rec).await?;

                Ok(MachineProviderSendOutput::Ok {
                    machine_id: input.machine_id,
                    state: new_state,
                })
            }
            None => Ok(MachineProviderSendOutput::NotFound {
                message: format!("machine '{}' not found", input.machine_id),
            }),
        }
    }

    async fn connect(
        &self,
        input: MachineProviderConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderConnectOutput, Box<dyn std::error::Error>> {
        let source = storage.get("machine", &input.source_id).await?;
        let target = storage.get("machine", &input.target_id).await?;

        if source.is_none() {
            return Ok(MachineProviderConnectOutput::NotFound {
                message: format!("source machine '{}' not found", input.source_id),
            });
        }
        if target.is_none() {
            return Ok(MachineProviderConnectOutput::NotFound {
                message: format!("target machine '{}' not found", input.target_id),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let connection_id = format!("conn-{}", id);

        storage
            .put(
                "machine_connection",
                &connection_id,
                json!({
                    "connectionId": connection_id,
                    "sourceId": input.source_id,
                    "targetId": input.target_id,
                    "onEvent": input.on_event,
                }),
            )
            .await?;

        Ok(MachineProviderConnectOutput::Ok { connection_id })
    }

    async fn destroy(
        &self,
        input: MachineProviderDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderDestroyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("machine", &input.machine_id).await?;

        match record {
            Some(_) => {
                storage.del("machine", &input.machine_id).await?;
                Ok(MachineProviderDestroyOutput::Ok {
                    machine_id: input.machine_id,
                })
            }
            None => Ok(MachineProviderDestroyOutput::NotFound {
                message: format!("machine '{}' not found", input.machine_id),
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
        let handler = MachineProviderHandlerImpl::new();
        let result = handler.initialize(
            MachineProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            MachineProviderInitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("machine-"));
                assert_eq!(plugin_ref, "surface-provider:machine");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let first = handler.initialize(
            MachineProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let second = handler.initialize(
            MachineProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let (i1, i2) = match (&first, &second) {
            (MachineProviderInitializeOutput::Ok { instance: i1, .. },
             MachineProviderInitializeOutput::Ok { instance: i2, .. }) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn test_spawn_creates_machine() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let result = handler.spawn(
            MachineProviderSpawnInput {
                machine_def: r#"{"states":["idle","active"]}"#.to_string(),
                initial_state: "idle".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MachineProviderSpawnOutput::Ok { machine_id, state } => {
                assert!(machine_id.starts_with("machine-"));
                assert_eq!(state, "idle");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_spawn_rejects_empty_def() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let result = handler.spawn(
            MachineProviderSpawnInput {
                machine_def: "".to_string(),
                initial_state: "idle".to_string(),
            },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, MachineProviderSpawnOutput::Error { .. }));
    }

    #[tokio::test]
    async fn test_send_transitions_state() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let spawn_result = handler.spawn(
            MachineProviderSpawnInput { machine_def: "def".to_string(), initial_state: "idle".to_string() },
            &storage,
        ).await.unwrap();
        let machine_id = match spawn_result {
            MachineProviderSpawnOutput::Ok { machine_id, .. } => machine_id,
            _ => panic!("expected Ok"),
        };
        let result = handler.send(
            MachineProviderSendInput { machine_id, event: "activate".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            MachineProviderSendOutput::Ok { state, .. } => {
                assert_eq!(state, "idle_after_activate");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_send_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let result = handler.send(
            MachineProviderSendInput { machine_id: "missing".to_string(), event: "e".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, MachineProviderSendOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn test_connect_links_machines() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let s1 = handler.spawn(
            MachineProviderSpawnInput { machine_def: "d1".to_string(), initial_state: "s1".to_string() },
            &storage,
        ).await.unwrap();
        let s2 = handler.spawn(
            MachineProviderSpawnInput { machine_def: "d2".to_string(), initial_state: "s2".to_string() },
            &storage,
        ).await.unwrap();
        let id1 = match s1 { MachineProviderSpawnOutput::Ok { machine_id, .. } => machine_id, _ => panic!("expected Ok") };
        let id2 = match s2 { MachineProviderSpawnOutput::Ok { machine_id, .. } => machine_id, _ => panic!("expected Ok") };
        let result = handler.connect(
            MachineProviderConnectInput { source_id: id1, target_id: id2, on_event: "done".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, MachineProviderConnectOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn test_destroy_removes_machine() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let spawn_result = handler.spawn(
            MachineProviderSpawnInput { machine_def: "d".to_string(), initial_state: "idle".to_string() },
            &storage,
        ).await.unwrap();
        let machine_id = match spawn_result {
            MachineProviderSpawnOutput::Ok { machine_id, .. } => machine_id,
            _ => panic!("expected Ok"),
        };
        let result = handler.destroy(
            MachineProviderDestroyInput { machine_id: machine_id.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, MachineProviderDestroyOutput::Ok { .. }));
        let gone = storage.get("machine", &machine_id).await.unwrap();
        assert!(gone.is_none());
    }

    #[tokio::test]
    async fn test_destroy_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandlerImpl::new();
        let result = handler.destroy(
            MachineProviderDestroyInput { machine_id: "nope".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, MachineProviderDestroyOutput::NotFound { .. }));
    }
}
