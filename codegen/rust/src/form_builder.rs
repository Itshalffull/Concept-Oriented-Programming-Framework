// FormBuilder Concept Implementation (Rust)
//
// Manages form construction, validation, and widget registration.
// See Architecture doc Sections on form and input handling.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── BuildForm ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildFormInput {
    pub schema_id: String,
    pub mode: String,
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum BuildFormOutput {
    #[serde(rename = "ok")]
    Ok { form_id: String, fields: String },
    #[serde(rename = "schema_notfound")]
    SchemaNotFound { message: String },
}

// ── ValidateForm ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateFormInput {
    pub form_data: String,
    pub schema_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidateFormOutput {
    #[serde(rename = "ok")]
    Ok { valid: bool },
    #[serde(rename = "invalid")]
    Invalid { errors: String },
}

// ── ProcessSubmission ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSubmissionInput {
    pub form_data: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProcessSubmissionOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "validation_failed")]
    ValidationFailed { errors: String },
}

// ── RegisterWidget ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterWidgetInput {
    pub field_type: String,
    pub widget_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RegisterWidgetOutput {
    #[serde(rename = "ok")]
    Ok {
        field_type: String,
        widget_id: String,
    },
}

// ── Handler ───────────────────────────────────────────────

pub struct FormBuilderHandler;

impl FormBuilderHandler {
    pub async fn build_form(
        &self,
        input: BuildFormInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<BuildFormOutput> {
        let schema = storage.get("schema", &input.schema_id).await?;

        match schema {
            None => Ok(BuildFormOutput::SchemaNotFound {
                message: format!("Schema '{}' not found", input.schema_id),
            }),
            Some(schema_record) => {
                let form_id = format!("form_{}_{}", input.schema_id, input.entity_id);

                let fields = schema_record["fields"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();

                // Build form field descriptors with widget info
                let mut form_fields: Vec<serde_json::Value> = vec![];
                for field in &fields {
                    let field_type = field["type"].as_str().unwrap_or("text");
                    let widget = storage.get("widget_registry", field_type).await?;
                    let widget_id = widget
                        .as_ref()
                        .and_then(|w| w["widget_id"].as_str())
                        .unwrap_or("default_widget");

                    form_fields.push(json!({
                        "field": field,
                        "widget_id": widget_id,
                        "mode": input.mode,
                    }));
                }

                storage
                    .put(
                        "form_def",
                        &form_id,
                        json!({
                            "form_id": form_id,
                            "schema_id": input.schema_id,
                            "entity_id": input.entity_id,
                            "mode": input.mode,
                            "fields": form_fields,
                        }),
                    )
                    .await?;

                Ok(BuildFormOutput::Ok {
                    form_id,
                    fields: serde_json::to_string(&form_fields)?,
                })
            }
        }
    }

    pub async fn validate_form(
        &self,
        input: ValidateFormInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidateFormOutput> {
        let schema = storage.get("schema", &input.schema_id).await?;

        let form_data: serde_json::Value =
            serde_json::from_str(&input.form_data).unwrap_or(json!({}));

        match schema {
            None => Ok(ValidateFormOutput::Invalid {
                errors: format!("Schema '{}' not found", input.schema_id),
            }),
            Some(schema_record) => {
                let fields = schema_record["fields"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();

                let mut errors: Vec<String> = vec![];

                for field in &fields {
                    let field_name = field["name"].as_str().unwrap_or("");
                    let required = field["required"].as_bool().unwrap_or(false);

                    if required && form_data.get(field_name).is_none() {
                        errors.push(format!("Field '{}' is required", field_name));
                    }
                }

                if errors.is_empty() {
                    Ok(ValidateFormOutput::Ok { valid: true })
                } else {
                    Ok(ValidateFormOutput::Invalid {
                        errors: serde_json::to_string(&errors)?,
                    })
                }
            }
        }
    }

    pub async fn process_submission(
        &self,
        input: ProcessSubmissionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProcessSubmissionOutput> {
        let form_data: serde_json::Value =
            serde_json::from_str(&input.form_data).unwrap_or(json!({}));

        if form_data.as_object().map_or(true, |o| o.is_empty()) {
            return Ok(ProcessSubmissionOutput::ValidationFailed {
                errors: "Empty form data".to_string(),
            });
        }

        // Store the submitted data on the node
        storage
            .put(
                "form_def",
                &format!("submission_{}", input.node_id),
                json!({
                    "node_id": input.node_id,
                    "form_data": form_data,
                    "submitted_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(ProcessSubmissionOutput::Ok {
            node_id: input.node_id,
        })
    }

    pub async fn register_widget(
        &self,
        input: RegisterWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterWidgetOutput> {
        storage
            .put(
                "widget_registry",
                &input.field_type,
                json!({
                    "field_type": input.field_type,
                    "widget_id": input.widget_id,
                }),
            )
            .await?;

        Ok(RegisterWidgetOutput::Ok {
            field_type: input.field_type,
            widget_id: input.widget_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn build_form_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        let result = handler
            .build_form(
                BuildFormInput {
                    schema_id: "nonexistent".into(),
                    mode: "edit".into(),
                    entity_id: "e1".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, BuildFormOutput::SchemaNotFound { .. }));
    }

    #[tokio::test]
    async fn build_form_with_schema() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        // Create a schema in storage
        storage
            .put(
                "schema",
                "article",
                serde_json::json!({
                    "schema_id": "article",
                    "fields": [
                        {"name": "title", "type": "text", "required": true},
                        {"name": "body", "type": "textarea", "required": false}
                    ]
                }),
            )
            .await
            .unwrap();

        let result = handler
            .build_form(
                BuildFormInput {
                    schema_id: "article".into(),
                    mode: "edit".into(),
                    entity_id: "e1".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            BuildFormOutput::Ok { form_id, fields } => {
                assert_eq!(form_id, "form_article_e1");
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&fields).unwrap();
                assert_eq!(parsed.len(), 2);
            }
            BuildFormOutput::SchemaNotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn validate_form_valid() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        storage
            .put(
                "schema",
                "article",
                serde_json::json!({
                    "schema_id": "article",
                    "fields": [
                        {"name": "title", "type": "text", "required": true}
                    ]
                }),
            )
            .await
            .unwrap();

        let result = handler
            .validate_form(
                ValidateFormInput {
                    form_data: r#"{"title": "Hello"}"#.into(),
                    schema_id: "article".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ValidateFormOutput::Ok { valid } => assert!(valid),
            ValidateFormOutput::Invalid { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn validate_form_missing_required_field() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        storage
            .put(
                "schema",
                "article",
                serde_json::json!({
                    "schema_id": "article",
                    "fields": [
                        {"name": "title", "type": "text", "required": true}
                    ]
                }),
            )
            .await
            .unwrap();

        let result = handler
            .validate_form(
                ValidateFormInput {
                    form_data: r#"{}"#.into(),
                    schema_id: "article".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ValidateFormOutput::Invalid { .. }));
    }

    #[tokio::test]
    async fn process_submission_ok() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        let result = handler
            .process_submission(
                ProcessSubmissionInput {
                    form_data: r#"{"title": "Test"}"#.into(),
                    node_id: "n1".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ProcessSubmissionOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
            ProcessSubmissionOutput::ValidationFailed { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn process_submission_empty_data() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        let result = handler
            .process_submission(
                ProcessSubmissionInput {
                    form_data: r#"{}"#.into(),
                    node_id: "n1".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ProcessSubmissionOutput::ValidationFailed { .. }));
    }

    #[tokio::test]
    async fn register_widget() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandler;
        let result = handler
            .register_widget(
                RegisterWidgetInput {
                    field_type: "date".into(),
                    widget_id: "datepicker_v2".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            RegisterWidgetOutput::Ok { field_type, widget_id } => {
                assert_eq!(field_type, "date");
                assert_eq!(widget_id, "datepicker_v2");
            }
        }
    }
}
