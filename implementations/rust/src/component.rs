// Component Concept Implementation (Rust)
//
// Layout kit — registers components with configuration, places them
// in regions with weight ordering, manages visibility conditions,
// and renders component output.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Register ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentRegisterInput {
    pub component_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ComponentRegisterOutput {
    #[serde(rename = "ok")]
    Ok { component_id: String },
}

// ── Place ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentPlaceInput {
    pub component_id: String,
    pub region: String,
    pub weight: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ComponentPlaceOutput {
    #[serde(rename = "ok")]
    Ok { placement_id: String },
}

// ── SetVisibility ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentSetVisibilityInput {
    pub placement_id: String,
    pub conditions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ComponentSetVisibilityOutput {
    #[serde(rename = "ok")]
    Ok { placement_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── EvaluateVisibility ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentEvaluateVisibilityInput {
    pub placement_id: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ComponentEvaluateVisibilityOutput {
    #[serde(rename = "ok")]
    Ok { placement_id: String, visible: bool },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Render ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentRenderInput {
    pub component_id: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ComponentRenderOutput {
    #[serde(rename = "ok")]
    Ok {
        component_id: String,
        output: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ComponentHandler;

impl ComponentHandler {
    pub async fn register(
        &self,
        input: ComponentRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ComponentRegisterOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "component",
                &input.component_id,
                json!({
                    "component_id": input.component_id,
                    "config": input.config,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(ComponentRegisterOutput::Ok {
            component_id: input.component_id,
        })
    }

    pub async fn place(
        &self,
        input: ComponentPlaceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ComponentPlaceOutput> {
        let placement_id = format!("plc_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "placement",
                &placement_id,
                json!({
                    "placement_id": placement_id,
                    "component_id": input.component_id,
                    "region": input.region,
                    "weight": input.weight,
                    "visibility_conditions": null,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(ComponentPlaceOutput::Ok { placement_id })
    }

    pub async fn set_visibility(
        &self,
        input: ComponentSetVisibilityInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ComponentSetVisibilityOutput> {
        let existing = storage.get("placement", &input.placement_id).await?;
        match existing {
            None => Ok(ComponentSetVisibilityOutput::NotFound {
                message: format!("placement '{}' not found", input.placement_id),
            }),
            Some(mut record) => {
                record["visibility_conditions"] = json!(input.conditions);
                storage
                    .put("placement", &input.placement_id, record)
                    .await?;
                Ok(ComponentSetVisibilityOutput::Ok {
                    placement_id: input.placement_id,
                })
            }
        }
    }

    pub async fn evaluate_visibility(
        &self,
        input: ComponentEvaluateVisibilityInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ComponentEvaluateVisibilityOutput> {
        let existing = storage.get("placement", &input.placement_id).await?;
        match existing {
            None => Ok(ComponentEvaluateVisibilityOutput::NotFound {
                message: format!("placement '{}' not found", input.placement_id),
            }),
            Some(record) => {
                // If no visibility conditions set, the component is visible
                let visible = record["visibility_conditions"].is_null()
                    || record["visibility_conditions"]
                        .as_str()
                        .map(|s| s.is_empty())
                        .unwrap_or(false);
                Ok(ComponentEvaluateVisibilityOutput::Ok {
                    placement_id: input.placement_id,
                    visible,
                })
            }
        }
    }

    pub async fn render(
        &self,
        input: ComponentRenderInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ComponentRenderOutput> {
        let existing = storage.get("component", &input.component_id).await?;
        match existing {
            None => Ok(ComponentRenderOutput::NotFound {
                message: format!("component '{}' not found", input.component_id),
            }),
            Some(record) => {
                let config = record["config"]
                    .as_str()
                    .unwrap_or("{}")
                    .to_string();
                let output = json!({
                    "component_id": input.component_id,
                    "config": config,
                    "context": input.context,
                    "rendered_at": chrono::Utc::now().to_rfc3339(),
                })
                .to_string();
                Ok(ComponentRenderOutput::Ok {
                    component_id: input.component_id,
                    output,
                })
            }
        }
    }
}
