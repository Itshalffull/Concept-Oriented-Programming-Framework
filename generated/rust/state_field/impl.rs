// State field registry: tracks concept state fields, their types, and traces
// to generated code and storage backends.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::StateFieldHandler;
use serde_json::json;

pub struct StateFieldHandlerImpl;

fn generate_field_id(concept: &str, name: &str) -> String {
    format!("field-{}-{}", concept, name)
}

/// Infer cardinality from a type expression.
/// "set T" -> "many", "list T" -> "many", "option T" -> "optional", else "one"
fn infer_cardinality(type_expr: &str) -> &str {
    let lower = type_expr.to_lowercase();
    if lower.starts_with("set ") || lower.starts_with("list ") {
        "many"
    } else if lower.starts_with("option ") {
        "optional"
    } else {
        "one"
    }
}

#[async_trait]
impl StateFieldHandler for StateFieldHandlerImpl {
    async fn register(
        &self,
        input: StateFieldRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldRegisterOutput, Box<dyn std::error::Error>> {
        let field_id = generate_field_id(&input.concept, &input.name);
        let cardinality = infer_cardinality(&input.type_expr);

        storage.put("stateField", &field_id, json!({
            "field": &field_id,
            "concept": &input.concept,
            "name": &input.name,
            "typeExpr": &input.type_expr,
            "cardinality": cardinality,
        })).await?;

        // Index by concept for find_by_concept queries
        let concept_key = format!("concept-fields-{}", &input.concept);
        let existing = storage.get("stateFieldIndex", &concept_key).await?;
        let mut fields: Vec<String> = existing
            .and_then(|v| serde_json::from_value(v["fields"].clone()).ok())
            .unwrap_or_default();

        if !fields.contains(&field_id) {
            fields.push(field_id.clone());
        }

        storage.put("stateFieldIndex", &concept_key, json!({
            "concept": &input.concept,
            "fields": fields,
        })).await?;

        Ok(StateFieldRegisterOutput::Ok { field: field_id })
    }

    async fn find_by_concept(
        &self,
        input: StateFieldFindByConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldFindByConceptOutput, Box<dyn std::error::Error>> {
        let concept_key = format!("concept-fields-{}", &input.concept);
        let existing = storage.get("stateFieldIndex", &concept_key).await?;

        let fields: Vec<String> = existing
            .and_then(|v| serde_json::from_value(v["fields"].clone()).ok())
            .unwrap_or_default();

        Ok(StateFieldFindByConceptOutput::Ok {
            fields: serde_json::to_string(&fields).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn trace_to_generated(
        &self,
        input: StateFieldTraceToGeneratedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldTraceToGeneratedOutput, Box<dyn std::error::Error>> {
        let field_record = storage.get("stateField", &input.field).await?;

        let targets = match field_record {
            Some(record) => {
                let concept = record["concept"].as_str().unwrap_or("");
                let name = record["name"].as_str().unwrap_or("");
                // Trace to typical generated code locations
                let generated_targets = vec![
                    format!("generated/rust/{}/types.rs#{}", concept, name),
                    format!("generated/ts/{}/types.ts#{}", concept, name),
                ];
                serde_json::to_string(&generated_targets).unwrap_or_else(|_| "[]".to_string())
            }
            None => "[]".to_string(),
        };

        Ok(StateFieldTraceToGeneratedOutput::Ok { targets })
    }

    async fn trace_to_storage(
        &self,
        input: StateFieldTraceToStorageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldTraceToStorageOutput, Box<dyn std::error::Error>> {
        let field_record = storage.get("stateField", &input.field).await?;

        let targets = match field_record {
            Some(record) => {
                let concept = record["concept"].as_str().unwrap_or("");
                let name = record["name"].as_str().unwrap_or("");
                // Trace to storage backend locations
                let storage_targets = vec![
                    format!("storage/{}/{}", concept, name),
                ];
                serde_json::to_string(&storage_targets).unwrap_or_else(|_| "[]".to_string())
            }
            None => "[]".to_string(),
        };

        Ok(StateFieldTraceToStorageOutput::Ok { targets })
    }

    async fn get(
        &self,
        input: StateFieldGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("stateField", &input.field).await?;

        match record {
            Some(v) => Ok(StateFieldGetOutput::Ok {
                field: input.field,
                concept: v["concept"].as_str().unwrap_or("").to_string(),
                name: v["name"].as_str().unwrap_or("").to_string(),
                type_expr: v["typeExpr"].as_str().unwrap_or("").to_string(),
                cardinality: v["cardinality"].as_str().unwrap_or("one").to_string(),
            }),
            None => Ok(StateFieldGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_field() {
        let storage = InMemoryStorage::new();
        let handler = StateFieldHandlerImpl;
        let result = handler.register(
            StateFieldRegisterInput {
                concept: "User".to_string(),
                name: "email".to_string(),
                type_expr: "String".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            StateFieldRegisterOutput::Ok { field } => {
                assert!(field.contains("User"));
                assert!(field.contains("email"));
            },
        }
    }

    #[tokio::test]
    async fn test_find_by_concept() {
        let storage = InMemoryStorage::new();
        let handler = StateFieldHandlerImpl;
        // Register a field first
        handler.register(
            StateFieldRegisterInput {
                concept: "Article".to_string(),
                name: "title".to_string(),
                type_expr: "String".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_by_concept(
            StateFieldFindByConceptInput { concept: "Article".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            StateFieldFindByConceptOutput::Ok { fields } => {
                assert!(fields.contains("Article"));
            },
        }
    }

    #[tokio::test]
    async fn test_trace_to_generated() {
        let storage = InMemoryStorage::new();
        let handler = StateFieldHandlerImpl;
        handler.register(
            StateFieldRegisterInput {
                concept: "User".to_string(),
                name: "name".to_string(),
                type_expr: "String".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.trace_to_generated(
            StateFieldTraceToGeneratedInput { field: "field-User-name".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            StateFieldTraceToGeneratedOutput::Ok { targets } => {
                assert!(targets.contains("User"));
            },
        }
    }

    #[tokio::test]
    async fn test_trace_to_storage() {
        let storage = InMemoryStorage::new();
        let handler = StateFieldHandlerImpl;
        handler.register(
            StateFieldRegisterInput {
                concept: "User".to_string(),
                name: "name".to_string(),
                type_expr: "String".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.trace_to_storage(
            StateFieldTraceToStorageInput { field: "field-User-name".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            StateFieldTraceToStorageOutput::Ok { targets } => {
                assert!(targets.contains("User"));
            },
        }
    }

    #[tokio::test]
    async fn test_get_existing_field() {
        let storage = InMemoryStorage::new();
        let handler = StateFieldHandlerImpl;
        handler.register(
            StateFieldRegisterInput {
                concept: "User".to_string(),
                name: "email".to_string(),
                type_expr: "set String".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            StateFieldGetInput { field: "field-User-email".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            StateFieldGetOutput::Ok { concept, name, cardinality, .. } => {
                assert_eq!(concept, "User");
                assert_eq!(name, "email");
                assert_eq!(cardinality, "many");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_field() {
        let storage = InMemoryStorage::new();
        let handler = StateFieldHandlerImpl;
        let result = handler.get(
            StateFieldGetInput { field: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            StateFieldGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
