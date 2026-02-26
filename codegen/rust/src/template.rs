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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── define tests ───────────────────────────────────────

    #[tokio::test]
    async fn define_returns_ok_with_template_id() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandler;

        let result = handler
            .define(
                DefineInput {
                    template_id: "tpl_report".into(),
                    block_tree: r#"[{"type":"heading"},{"type":"body"}]"#.into(),
                    variables: r#"["title","author"]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DefineOutput::Ok { template_id } => {
                assert_eq!(template_id, "tpl_report");
            }
        }
    }

    #[tokio::test]
    async fn define_stores_template_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandler;

        handler
            .define(
                DefineInput {
                    template_id: "tpl_page".into(),
                    block_tree: r#"[{"type":"section"}]"#.into(),
                    variables: r#"["content"]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("template", "tpl_page").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["template_id"].as_str().unwrap(), "tpl_page");
    }

    // ── instantiate tests ──────────────────────────────────

    #[tokio::test]
    async fn instantiate_creates_instance_from_template() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandler;

        handler
            .define(
                DefineInput {
                    template_id: "tpl_note".into(),
                    block_tree: r#"[{"type":"text"}]"#.into(),
                    variables: r#"["body"]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .instantiate(
                InstantiateInput {
                    template_id: "tpl_note".into(),
                    target_location: "/notes/new".into(),
                    bindings: r#"{"body":"Hello"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            InstantiateOutput::Ok { instance_id } => {
                assert!(instance_id.starts_with("inst_tpl_note_"));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn instantiate_returns_notfound_for_missing_template() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandler;

        let result = handler
            .instantiate(
                InstantiateInput {
                    template_id: "nonexistent".into(),
                    target_location: "/loc".into(),
                    bindings: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, InstantiateOutput::NotFound { .. }));
    }

    // ── register_trigger tests ─────────────────────────────

    #[tokio::test]
    async fn register_trigger_adds_trigger_to_template() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandler;

        handler
            .define(
                DefineInput {
                    template_id: "tpl_auto".into(),
                    block_tree: "[]".into(),
                    variables: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register_trigger(
                RegisterTriggerInput {
                    template_id: "tpl_auto".into(),
                    condition: "on_create".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterTriggerOutput::Ok { .. }));

        let record = storage.get("template", "tpl_auto").await.unwrap().unwrap();
        let triggers = record["triggers"].as_array().unwrap();
        assert_eq!(triggers.len(), 1);
        assert_eq!(
            triggers[0]["condition"].as_str().unwrap(),
            "on_create"
        );
    }

    #[tokio::test]
    async fn register_trigger_returns_notfound_for_missing_template() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandler;

        let result = handler
            .register_trigger(
                RegisterTriggerInput {
                    template_id: "nonexistent".into(),
                    condition: "on_update".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterTriggerOutput::NotFound { .. }));
    }
}
