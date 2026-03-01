// Machine (state machine) implementation
// Manages stateful UI component lifecycles through finite state
// machine transitions. Supports guards, context, and widget binding.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MachineHandler;
use serde_json::json;

pub struct MachineHandlerImpl;

fn default_transitions() -> serde_json::Value {
    json!({
        "idle": { "start": "active", "destroy": "terminated" },
        "active": { "pause": "paused", "error": "errored", "complete": "completed", "destroy": "terminated" },
        "paused": { "resume": "active", "destroy": "terminated" },
        "errored": { "retry": "active", "destroy": "terminated" },
        "completed": { "reset": "idle", "destroy": "terminated" },
        "terminated": {}
    })
}

#[async_trait]
impl MachineHandler for MachineHandlerImpl {
    async fn spawn(
        &self,
        input: MachineSpawnInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineSpawnOutput, Box<dyn std::error::Error>> {
        // Look up the widget in storage
        let widget_record = storage.get("widget", &input.widget).await?;
        if widget_record.is_none() {
            return Ok(MachineSpawnOutput::Notfound {
                message: format!("Widget \"{}\" not found", input.widget),
            });
        }

        // Validate context is valid JSON
        let parsed_context: serde_json::Value = serde_json::from_str(&input.context)
            .unwrap_or_else(|_| {
                if input.context.is_empty() { json!({}) }
                else { return json!(null); }
            });

        if parsed_context.is_null() && !input.context.is_empty() {
            return Ok(MachineSpawnOutput::Invalid {
                message: "Context must be valid JSON".into(),
            });
        }

        storage.put("machine", &input.machine, json!({
            "machine": input.machine,
            "currentState": "idle",
            "context": serde_json::to_string(&parsed_context)?,
            "component": input.widget,
            "status": "running",
            "transitions": serde_json::to_string(&default_transitions())?,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(MachineSpawnOutput::Ok {
            machine: input.machine,
        })
    }

    async fn send(
        &self,
        input: MachineSendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineSendOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("machine", &input.machine).await? {
            Some(r) => r,
            None => {
                return Ok(MachineSendOutput::Invalid {
                    message: format!("Machine \"{}\" not found", input.machine),
                });
            }
        };

        let current_state = existing.get("currentState")
            .and_then(|v| v.as_str())
            .unwrap_or("idle")
            .to_string();

        let transitions_str = existing.get("transitions")
            .and_then(|v| v.as_str())
            .unwrap_or("{}");
        let transitions: serde_json::Value = serde_json::from_str(transitions_str)?;

        // Parse event: may include guard as "event:guard"
        let parts: Vec<&str> = input.event.splitn(2, ':').collect();
        let event_name = parts[0];
        let guard = parts.get(1).copied();

        let state_transitions = transitions.get(&current_state);
        let next_state = state_transitions
            .and_then(|st| st.get(event_name))
            .and_then(|v| v.as_str());

        match next_state {
            None => Ok(MachineSendOutput::Invalid {
                message: format!(
                    "No transition for event \"{}\" from state \"{}\"",
                    event_name, current_state
                ),
            }),
            Some(new_state) => {
                // Check guard if specified
                if let Some(guard_name) = guard {
                    let context_str = existing.get("context")
                        .and_then(|v| v.as_str())
                        .unwrap_or("{}");
                    let context: serde_json::Value = serde_json::from_str(context_str)?;

                    let guard_value = context.get(guard_name);
                    let blocked = match guard_value {
                        None => true,
                        Some(v) => v == &json!(false),
                    };

                    if blocked {
                        return Ok(MachineSendOutput::Guarded {
                            machine: input.machine,
                            guard: guard_name.to_string(),
                        });
                    }
                }

                let new_status = if new_state == "terminated" { "terminated" } else { "running" };

                let mut updated = existing.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("currentState".into(), json!(new_state));
                    obj.insert("status".into(), json!(new_status));
                }
                storage.put("machine", &input.machine, updated).await?;

                Ok(MachineSendOutput::Ok {
                    machine: input.machine,
                    state: new_state.to_string(),
                })
            }
        }
    }

    async fn connect(
        &self,
        input: MachineConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineConnectOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("machine", &input.machine).await? {
            Some(r) => r,
            None => {
                return Ok(MachineConnectOutput::Notfound {
                    message: format!("Machine \"{}\" not found", input.machine),
                });
            }
        };

        let context_str = existing.get("context")
            .and_then(|v| v.as_str())
            .unwrap_or("{}");
        let mut context: serde_json::Value = serde_json::from_str(context_str)?;

        if let Some(obj) = context.as_object_mut() {
            obj.insert("currentState".into(), json!(existing.get("currentState")));
            obj.insert("status".into(), json!(existing.get("status")));
            obj.insert("component".into(), json!(existing.get("component")));
        }

        Ok(MachineConnectOutput::Ok {
            machine: input.machine,
            props: serde_json::to_string(&context)?,
        })
    }

    async fn destroy(
        &self,
        input: MachineDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineDestroyOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("machine", &input.machine).await? {
            Some(r) => r,
            None => {
                return Ok(MachineDestroyOutput::Notfound {
                    message: format!("Machine \"{}\" not found", input.machine),
                });
            }
        };

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("currentState".into(), json!("terminated"));
            obj.insert("status".into(), json!("terminated"));
        }
        storage.put("machine", &input.machine, updated).await?;

        Ok(MachineDestroyOutput::Ok {
            machine: input.machine,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn setup_widget(storage: &InMemoryStorage) {
        storage.put("widget", "my-widget", json!({"name": "my-widget"})).await.unwrap();
    }

    #[tokio::test]
    async fn test_spawn_success() {
        let storage = InMemoryStorage::new();
        setup_widget(&storage).await;
        let handler = MachineHandlerImpl;
        let result = handler.spawn(
            MachineSpawnInput { machine: "m1".into(), widget: "my-widget".into(), context: "{}".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineSpawnOutput::Ok { machine } => assert_eq!(machine, "m1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_spawn_widget_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MachineHandlerImpl;
        let result = handler.spawn(
            MachineSpawnInput { machine: "m1".into(), widget: "missing".into(), context: "{}".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineSpawnOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_send_transition() {
        let storage = InMemoryStorage::new();
        setup_widget(&storage).await;
        let handler = MachineHandlerImpl;
        handler.spawn(
            MachineSpawnInput { machine: "m1".into(), widget: "my-widget".into(), context: "{}".into() },
            &storage,
        ).await.unwrap();
        let result = handler.send(
            MachineSendInput { machine: "m1".into(), event: "start".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineSendOutput::Ok { machine, state } => {
                assert_eq!(machine, "m1");
                assert_eq!(state, "active");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_send_invalid_event() {
        let storage = InMemoryStorage::new();
        setup_widget(&storage).await;
        let handler = MachineHandlerImpl;
        handler.spawn(
            MachineSpawnInput { machine: "m1".into(), widget: "my-widget".into(), context: "{}".into() },
            &storage,
        ).await.unwrap();
        let result = handler.send(
            MachineSendInput { machine: "m1".into(), event: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineSendOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_connect_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MachineHandlerImpl;
        let result = handler.connect(
            MachineConnectInput { machine: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineConnectOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_success() {
        let storage = InMemoryStorage::new();
        setup_widget(&storage).await;
        let handler = MachineHandlerImpl;
        handler.spawn(
            MachineSpawnInput { machine: "m1".into(), widget: "my-widget".into(), context: "{}".into() },
            &storage,
        ).await.unwrap();
        let result = handler.destroy(
            MachineDestroyInput { machine: "m1".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineDestroyOutput::Ok { machine } => assert_eq!(machine, "m1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MachineHandlerImpl;
        let result = handler.destroy(
            MachineDestroyInput { machine: "ghost".into() },
            &storage,
        ).await.unwrap();
        match result {
            MachineDestroyOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
