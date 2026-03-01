// FormBuilder concept implementation
// Schema-driven form generation with widget registry, validation, and submission processing.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FormBuilderHandler;
use serde_json::json;
use chrono::Utc;

pub struct FormBuilderHandlerImpl;

#[async_trait]
impl FormBuilderHandler for FormBuilderHandlerImpl {
    async fn build_form(
        &self,
        input: FormBuilderBuildFormInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormBuilderBuildFormOutput, Box<dyn std::error::Error>> {
        if input.schema.is_empty() {
            return Ok(FormBuilderBuildFormOutput::Error {
                message: "Schema is required to build a form".to_string(),
            });
        }

        storage.put("formDefinition", &input.form, json!({
            "form": input.form,
            "schema": input.schema,
            "widgetRegistry": "{}",
            "validationState": "{}",
        })).await?;

        let definition = serde_json::to_string(&json!({
            "form": input.form,
            "schema": input.schema,
            "generatedAt": Utc::now().to_rfc3339(),
        }))?;

        Ok(FormBuilderBuildFormOutput::Ok { definition })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_build_form_success() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandlerImpl;
        let result = handler.build_form(
            FormBuilderBuildFormInput {
                form: "user-registration".to_string(),
                schema: r#"{"fields":["name","email"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FormBuilderBuildFormOutput::Ok { definition } => {
                assert!(definition.contains("user-registration"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_build_form_empty_schema() {
        let storage = InMemoryStorage::new();
        let handler = FormBuilderHandlerImpl;
        let result = handler.build_form(
            FormBuilderBuildFormInput {
                form: "empty-form".to_string(),
                schema: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FormBuilderBuildFormOutput::Error { message } => {
                assert!(message.contains("Schema"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
