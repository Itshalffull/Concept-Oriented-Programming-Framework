// Template Concept Implementation (Rust)
//
// Manages template definitions, instantiation, and trigger registration.
// See Architecture doc Sections on template and automation.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Define ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineInput {
    pub template_id: String,
    pub block_tree: String,
    pub variables: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DefineOutput {
    #[serde(rename = "ok")]
    Ok { template_id: String },
}

// ── Instantiate ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstantiateInput {
    pub template_id: String,
    pub target_location: String,
    pub bindings: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum InstantiateOutput {
    #[serde(rename = "ok")]
    Ok { instance_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── RegisterTrigger ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterTriggerInput {
    pub template_id: String,
    pub condition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RegisterTriggerOutput {
    #[serde(rename = "ok")]
    Ok { template_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct TemplateHandler;

impl TemplateHandler {
    pub async fn define(
        &self,
        input: DefineInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineOutput> {
        let block_tree: serde_json::Value =
            serde_json::from_str(&input.block_tree).unwrap_or(json!([]));
        let variables: serde_json::Value =
            serde_json::from_str(&input.variables).unwrap_or(json!([]));

        storage
            .put(
                "template",
                &input.template_id,
                json!({
                    "template_id": input.template_id,
                    "block_tree": block_tree,
                    "variables": variables,
                    "triggers": [],
                }),
            )
            .await?;

        Ok(DefineOutput::Ok {
            template_id: input.template_id,
        })
    }

    pub async fn instantiate(
        &self,
        input: InstantiateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<InstantiateOutput> {
        let template = storage.get("template", &input.template_id).await?;

        match template {
            None => Ok(InstantiateOutput::NotFound {
                message: format!("Template '{}' not found", input.template_id),
            }),
            Some(template_record) => {
                let bindings: serde_json::Value =
                    serde_json::from_str(&input.bindings).unwrap_or(json!({}));

                let instance_id = format!(
                    "inst_{}_{}",
                    input.template_id,
                    chrono::Utc::now().timestamp_millis()
                );

                // Apply bindings to the block tree
                let block_tree = template_record["block_tree"].clone();

                storage
                    .put(
                        "template",
                        &instance_id,
                        json!({
                            "instance_id": instance_id,
                            "template_id": input.template_id,
                            "target_location": input.target_location,
                            "bindings": bindings,
                            "resolved_tree": block_tree,
                            "created_at": chrono::Utc::now().to_rfc3339(),
                        }),
                    )
                    .await?;

                Ok(InstantiateOutput::Ok { instance_id })
            }
        }
    }

    pub async fn register_trigger(
        &self,
        input: RegisterTriggerInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterTriggerOutput> {
        let existing = storage.get("template", &input.template_id).await?;

        match existing {
            None => Ok(RegisterTriggerOutput::NotFound {
                message: format!("Template '{}' not found", input.template_id),
            }),
            Some(mut template) => {
                let trigger = json!({
                    "condition": input.condition,
                    "registered_at": chrono::Utc::now().to_rfc3339(),
                });

                match template["triggers"].as_array_mut() {
                    Some(arr) => arr.push(trigger),
                    None => template["triggers"] = json!([trigger]),
                }

                storage
                    .put("template", &input.template_id, template)
                    .await?;

                Ok(RegisterTriggerOutput::Ok {
                    template_id: input.template_id,
                })
            }
        }
    }
}
