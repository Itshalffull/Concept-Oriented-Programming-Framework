// Workflow Concept Implementation (Rust)
//
// Automation kit — defines workflow states and transitions,
// performs guarded state transitions, and tracks current state per entity.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── DefineState ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefineStateInput {
    pub workflow_id: String,
    pub name: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WorkflowDefineStateOutput {
    #[serde(rename = "ok")]
    Ok {
        workflow_id: String,
        state_name: String,
    },
}

// ── DefineTransition ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefineTransitionInput {
    pub workflow_id: String,
    pub from_state: String,
    pub to_state: String,
    pub guard: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WorkflowDefineTransitionOutput {
    #[serde(rename = "ok")]
    Ok { workflow_id: String },
}

// ── Transition ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTransitionInput {
    pub entity_id: String,
    pub workflow_id: String,
    pub target_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WorkflowTransitionOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        from_state: String,
        to_state: String,
    },
    #[serde(rename = "not_allowed")]
    NotAllowed { message: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetCurrentState ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowGetCurrentStateInput {
    pub entity_id: String,
    pub workflow_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WorkflowGetCurrentStateOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String, state: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct WorkflowHandler;

impl WorkflowHandler {
    pub async fn define_state(
        &self,
        input: WorkflowDefineStateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<WorkflowDefineStateOutput> {
        let key = format!("{}:{}", input.workflow_id, input.name);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "workflow",
                &key,
                json!({
                    "workflow_id": input.workflow_id,
                    "state_name": input.name,
                    "config": input.config,
                    "type": "state",
                    "created_at": now,
                }),
            )
            .await?;
        Ok(WorkflowDefineStateOutput::Ok {
            workflow_id: input.workflow_id,
            state_name: input.name,
        })
    }

    pub async fn define_transition(
        &self,
        input: WorkflowDefineTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<WorkflowDefineTransitionOutput> {
        let key = format!("{}:{}:{}", input.workflow_id, input.from_state, input.to_state);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "workflow",
                &key,
                json!({
                    "workflow_id": input.workflow_id,
                    "from_state": input.from_state,
                    "to_state": input.to_state,
                    "guard": input.guard,
                    "type": "transition",
                    "created_at": now,
                }),
            )
            .await?;
        Ok(WorkflowDefineTransitionOutput::Ok {
            workflow_id: input.workflow_id,
        })
    }

    pub async fn transition(
        &self,
        input: WorkflowTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<WorkflowTransitionOutput> {
        // Get current state for this entity+workflow
        let state_key = format!("{}:{}", input.entity_id, input.workflow_id);
        let current = storage.get("workflow_state", &state_key).await?;

        let from_state = match &current {
            Some(record) => record["state"]
                .as_str()
                .unwrap_or("__initial__")
                .to_string(),
            None => "__initial__".to_string(),
        };

        // Check if transition is allowed
        let transition_key = format!(
            "{}:{}:{}",
            input.workflow_id, from_state, input.target_state
        );
        let transition_def = storage.get("workflow", &transition_key).await?;

        if transition_def.is_none() {
            return Ok(WorkflowTransitionOutput::NotAllowed {
                message: format!(
                    "transition from '{}' to '{}' is not allowed in workflow '{}'",
                    from_state, input.target_state, input.workflow_id
                ),
            });
        }

        // Perform the transition
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "workflow_state",
                &state_key,
                json!({
                    "entity_id": input.entity_id,
                    "workflow_id": input.workflow_id,
                    "state": input.target_state,
                    "previous_state": from_state,
                    "transitioned_at": now,
                }),
            )
            .await?;

        Ok(WorkflowTransitionOutput::Ok {
            entity_id: input.entity_id,
            from_state,
            to_state: input.target_state,
        })
    }

    pub async fn get_current_state(
        &self,
        input: WorkflowGetCurrentStateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<WorkflowGetCurrentStateOutput> {
        let state_key = format!("{}:{}", input.entity_id, input.workflow_id);
        let current = storage.get("workflow_state", &state_key).await?;

        match current {
            None => Ok(WorkflowGetCurrentStateOutput::NotFound {
                message: format!(
                    "no state found for entity '{}' in workflow '{}'",
                    input.entity_id, input.workflow_id
                ),
            }),
            Some(record) => {
                let state = record["state"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_string();
                Ok(WorkflowGetCurrentStateOutput::Ok {
                    entity_id: input.entity_id,
                    state,
                })
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── define_state tests ─────────────────────────────────

    #[tokio::test]
    async fn define_state_returns_ok_with_state_name() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        let result = handler
            .define_state(
                WorkflowDefineStateInput {
                    workflow_id: "wf1".into(),
                    name: "draft".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            WorkflowDefineStateOutput::Ok {
                workflow_id,
                state_name,
            } => {
                assert_eq!(workflow_id, "wf1");
                assert_eq!(state_name, "draft");
            }
        }
    }

    #[tokio::test]
    async fn define_state_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        handler
            .define_state(
                WorkflowDefineStateInput {
                    workflow_id: "wf1".into(),
                    name: "published".into(),
                    config: r#"{"final":true}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("workflow", "wf1:published").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["type"].as_str().unwrap(), "state");
    }

    // ── define_transition tests ────────────────────────────

    #[tokio::test]
    async fn define_transition_returns_ok() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        let result = handler
            .define_transition(
                WorkflowDefineTransitionInput {
                    workflow_id: "wf1".into(),
                    from_state: "draft".into(),
                    to_state: "review".into(),
                    guard: "has_content".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            WorkflowDefineTransitionOutput::Ok { workflow_id } => {
                assert_eq!(workflow_id, "wf1");
            }
        }
    }

    #[tokio::test]
    async fn define_transition_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        handler
            .define_transition(
                WorkflowDefineTransitionInput {
                    workflow_id: "wf1".into(),
                    from_state: "review".into(),
                    to_state: "published".into(),
                    guard: "approved".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage
            .get("workflow", "wf1:review:published")
            .await
            .unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["type"].as_str().unwrap(), "transition");
        assert_eq!(record["guard"].as_str().unwrap(), "approved");
    }

    // ── transition tests ───────────────────────────────────

    #[tokio::test]
    async fn transition_succeeds_when_allowed() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        // Define a transition from __initial__ to draft
        handler
            .define_transition(
                WorkflowDefineTransitionInput {
                    workflow_id: "wf1".into(),
                    from_state: "__initial__".into(),
                    to_state: "draft".into(),
                    guard: "none".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .transition(
                WorkflowTransitionInput {
                    entity_id: "doc1".into(),
                    workflow_id: "wf1".into(),
                    target_state: "draft".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            WorkflowTransitionOutput::Ok {
                entity_id,
                from_state,
                to_state,
            } => {
                assert_eq!(entity_id, "doc1");
                assert_eq!(from_state, "__initial__");
                assert_eq!(to_state, "draft");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn transition_returns_not_allowed_when_undefined() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        let result = handler
            .transition(
                WorkflowTransitionInput {
                    entity_id: "doc1".into(),
                    workflow_id: "wf1".into(),
                    target_state: "published".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            WorkflowTransitionOutput::NotAllowed { .. }
        ));
    }

    #[tokio::test]
    async fn transition_chains_correctly() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        handler
            .define_transition(
                WorkflowDefineTransitionInput {
                    workflow_id: "wf1".into(),
                    from_state: "__initial__".into(),
                    to_state: "draft".into(),
                    guard: "none".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .define_transition(
                WorkflowDefineTransitionInput {
                    workflow_id: "wf1".into(),
                    from_state: "draft".into(),
                    to_state: "published".into(),
                    guard: "none".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // First transition: __initial__ -> draft
        handler
            .transition(
                WorkflowTransitionInput {
                    entity_id: "doc1".into(),
                    workflow_id: "wf1".into(),
                    target_state: "draft".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Second transition: draft -> published
        let result = handler
            .transition(
                WorkflowTransitionInput {
                    entity_id: "doc1".into(),
                    workflow_id: "wf1".into(),
                    target_state: "published".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            WorkflowTransitionOutput::Ok {
                from_state,
                to_state,
                ..
            } => {
                assert_eq!(from_state, "draft");
                assert_eq!(to_state, "published");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    // ── get_current_state tests ────────────────────────────

    #[tokio::test]
    async fn get_current_state_returns_state_after_transition() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        handler
            .define_transition(
                WorkflowDefineTransitionInput {
                    workflow_id: "wf1".into(),
                    from_state: "__initial__".into(),
                    to_state: "active".into(),
                    guard: "none".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .transition(
                WorkflowTransitionInput {
                    entity_id: "item1".into(),
                    workflow_id: "wf1".into(),
                    target_state: "active".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_current_state(
                WorkflowGetCurrentStateInput {
                    entity_id: "item1".into(),
                    workflow_id: "wf1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            WorkflowGetCurrentStateOutput::Ok { entity_id, state } => {
                assert_eq!(entity_id, "item1");
                assert_eq!(state, "active");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn get_current_state_returns_notfound_when_no_state() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandler;

        let result = handler
            .get_current_state(
                WorkflowGetCurrentStateInput {
                    entity_id: "unknown".into(),
                    workflow_id: "wf1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            WorkflowGetCurrentStateOutput::NotFound { .. }
        ));
    }
}
