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
