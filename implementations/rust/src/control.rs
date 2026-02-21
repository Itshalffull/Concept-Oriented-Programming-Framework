// Control Concept Implementation (Rust)
//
// Automation kit — creates UI controls with bindings and actions,
// handles interaction events, and gets/sets control values.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Create ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlCreateInput {
    pub control_type: String,
    pub label: String,
    pub value: String,
    pub binding: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ControlCreateOutput {
    #[serde(rename = "ok")]
    Ok { control_id: String },
}

// ── Interact ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlInteractInput {
    pub control_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ControlInteractOutput {
    #[serde(rename = "ok")]
    Ok {
        control_id: String,
        action_triggered: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetValue ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlGetValueInput {
    pub control_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ControlGetValueOutput {
    #[serde(rename = "ok")]
    Ok { control_id: String, value: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── SetValue ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlSetValueInput {
    pub control_id: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ControlSetValueOutput {
    #[serde(rename = "ok")]
    Ok { control_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ControlHandler;

impl ControlHandler {
    pub async fn create(
        &self,
        input: ControlCreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ControlCreateOutput> {
        let control_id = format!("ctrl_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "control",
                &control_id,
                json!({
                    "control_id": control_id,
                    "control_type": input.control_type,
                    "label": input.label,
                    "value": input.value,
                    "binding": input.binding,
                    "action": input.action,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(ControlCreateOutput::Ok { control_id })
    }

    pub async fn interact(
        &self,
        input: ControlInteractInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ControlInteractOutput> {
        let existing = storage.get("control", &input.control_id).await?;
        match existing {
            None => Ok(ControlInteractOutput::NotFound {
                message: format!("control '{}' not found", input.control_id),
            }),
            Some(record) => {
                let action_triggered = record["action"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                Ok(ControlInteractOutput::Ok {
                    control_id: input.control_id,
                    action_triggered,
                })
            }
        }
    }

    pub async fn get_value(
        &self,
        input: ControlGetValueInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ControlGetValueOutput> {
        let existing = storage.get("control", &input.control_id).await?;
        match existing {
            None => Ok(ControlGetValueOutput::NotFound {
                message: format!("control '{}' not found", input.control_id),
            }),
            Some(record) => {
                let value = record["value"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                Ok(ControlGetValueOutput::Ok {
                    control_id: input.control_id,
                    value,
                })
            }
        }
    }

    pub async fn set_value(
        &self,
        input: ControlSetValueInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ControlSetValueOutput> {
        let existing = storage.get("control", &input.control_id).await?;
        match existing {
            None => Ok(ControlSetValueOutput::NotFound {
                message: format!("control '{}' not found", input.control_id),
            }),
            Some(mut record) => {
                record["value"] = json!(input.value);
                storage
                    .put("control", &input.control_id, record)
                    .await?;
                Ok(ControlSetValueOutput::Ok {
                    control_id: input.control_id,
                })
            }
        }
    }
}
