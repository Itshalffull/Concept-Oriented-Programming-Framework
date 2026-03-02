// MachineProvider Concept Implementation (Rust)
//
// Surface Provider — manages finite state machines that drive UI behavior.
// Each machine is spawned from a definition, receives events via send,
// and can be connected to other machines or destroyed.

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

// ── Spawn ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpawnInput {
    pub machine_def: String,
    pub initial_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpawnOutput {
    #[serde(rename = "ok")]
    Ok { machine_id: String, state: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Send ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SendInput {
    pub machine_id: String,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SendOutput {
    #[serde(rename = "ok")]
    Ok { machine_id: String, state: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Connect ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectInput {
    pub source_id: String,
    pub target_id: String,
    pub on_event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectOutput {
    #[serde(rename = "ok")]
    Ok { connection_id: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Destroy ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DestroyInput {
    pub machine_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DestroyOutput {
    #[serde(rename = "ok")]
    Ok { machine_id: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── Handler ─────────────────────────────────────────────

pub struct MachineProviderHandler {
    counter: AtomicU64,
}

impl MachineProviderHandler {
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
        let plugin_ref = "surface-provider:machine".to_string();

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

        Ok(InitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    pub async fn spawn(
        &self,
        input: SpawnInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SpawnOutput> {
        if input.machine_def.is_empty() {
            return Ok(SpawnOutput::Error {
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

        Ok(SpawnOutput::Ok {
            machine_id,
            state: input.initial_state,
        })
    }

    pub async fn send(
        &self,
        input: SendInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SendOutput> {
        let record = storage.get("machine", &input.machine_id).await?;

        match record {
            Some(mut rec) => {
                // Simple transition: event name becomes the new state
                // (real implementations would consult the definition)
                let new_state = format!(
                    "{}_after_{}",
                    rec["state"].as_str().unwrap_or("unknown"),
                    input.event
                );
                rec["state"] = json!(new_state);
                storage.put("machine", &input.machine_id, rec).await?;

                Ok(SendOutput::Ok {
                    machine_id: input.machine_id,
                    state: new_state,
                })
            }
            None => Ok(SendOutput::NotFound {
                message: format!("machine '{}' not found", input.machine_id),
            }),
        }
    }

    pub async fn connect(
        &self,
        input: ConnectInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectOutput> {
        let source = storage.get("machine", &input.source_id).await?;
        let target = storage.get("machine", &input.target_id).await?;

        if source.is_none() {
            return Ok(ConnectOutput::NotFound {
                message: format!("source machine '{}' not found", input.source_id),
            });
        }
        if target.is_none() {
            return Ok(ConnectOutput::NotFound {
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

        Ok(ConnectOutput::Ok { connection_id })
    }

    pub async fn destroy(
        &self,
        input: DestroyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DestroyOutput> {
        let record = storage.get("machine", &input.machine_id).await?;

        match record {
            Some(_) => {
                storage.del("machine", &input.machine_id).await?;
                Ok(DestroyOutput::Ok {
                    machine_id: input.machine_id,
                })
            }
            None => Ok(DestroyOutput::NotFound {
                message: format!("machine '{}' not found", input.machine_id),
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
        let handler = MachineProviderHandler::new();

        let result = handler
            .initialize(
                InitializeInput {
                    config: r#"{"maxMachines":128}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            InitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("machine-"));
                assert_eq!(plugin_ref, "surface-provider:machine");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

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
        let handler = MachineProviderHandler::new();

        let result = handler
            .initialize(InitializeInput { config: "".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, InitializeOutput::ConfigError { .. }));
    }

    #[tokio::test]
    async fn spawn_creates_machine_with_initial_state() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let result = handler
            .spawn(
                SpawnInput {
                    machine_def: r#"{"states":["idle","active"]}"#.into(),
                    initial_state: "idle".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            SpawnOutput::Ok { machine_id, state } => {
                assert!(machine_id.starts_with("machine-"));
                assert_eq!(state, "idle");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn spawn_rejects_empty_definition() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let result = handler
            .spawn(
                SpawnInput {
                    machine_def: "".into(),
                    initial_state: "idle".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SpawnOutput::Error { .. }));
    }

    #[tokio::test]
    async fn send_transitions_machine_state() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let spawn_result = handler
            .spawn(
                SpawnInput {
                    machine_def: "def".into(),
                    initial_state: "idle".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let machine_id = match spawn_result {
            SpawnOutput::Ok { machine_id, .. } => machine_id,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .send(
                SendInput {
                    machine_id: machine_id.clone(),
                    event: "activate".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            SendOutput::Ok { state, .. } => {
                assert_eq!(state, "idle_after_activate");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn send_returns_not_found_for_missing_machine() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let result = handler
            .send(
                SendInput {
                    machine_id: "missing".into(),
                    event: "e".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SendOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn connect_links_two_machines() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let s1 = handler
            .spawn(SpawnInput { machine_def: "d1".into(), initial_state: "s1".into() }, &storage)
            .await
            .unwrap();
        let s2 = handler
            .spawn(SpawnInput { machine_def: "d2".into(), initial_state: "s2".into() }, &storage)
            .await
            .unwrap();

        let id1 = match s1 { SpawnOutput::Ok { machine_id, .. } => machine_id, _ => panic!("expected Ok") };
        let id2 = match s2 { SpawnOutput::Ok { machine_id, .. } => machine_id, _ => panic!("expected Ok") };

        let result = handler
            .connect(
                ConnectInput {
                    source_id: id1,
                    target_id: id2,
                    on_event: "done".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ConnectOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn connect_returns_not_found_for_missing_source() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let s2 = handler
            .spawn(SpawnInput { machine_def: "d".into(), initial_state: "s".into() }, &storage)
            .await
            .unwrap();
        let id2 = match s2 { SpawnOutput::Ok { machine_id, .. } => machine_id, _ => panic!("expected Ok") };

        let result = handler
            .connect(
                ConnectInput {
                    source_id: "missing".into(),
                    target_id: id2,
                    on_event: "e".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ConnectOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn destroy_removes_machine() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let spawn_result = handler
            .spawn(SpawnInput { machine_def: "d".into(), initial_state: "idle".into() }, &storage)
            .await
            .unwrap();

        let machine_id = match spawn_result {
            SpawnOutput::Ok { machine_id, .. } => machine_id,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .destroy(DestroyInput { machine_id: machine_id.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DestroyOutput::Ok { .. }));

        let gone = storage.get("machine", &machine_id).await.unwrap();
        assert!(gone.is_none());
    }

    #[tokio::test]
    async fn destroy_returns_not_found_for_missing_machine() {
        let storage = InMemoryStorage::new();
        let handler = MachineProviderHandler::new();

        let result = handler
            .destroy(DestroyInput { machine_id: "nope".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DestroyOutput::NotFound { .. }));
    }
}
