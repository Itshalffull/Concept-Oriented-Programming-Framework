// UISchema handler implementation
// Inspects concept specs to derive UI schemas, with override support and element extraction.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::UISchemaHandler;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("S-{}", id)
}

pub struct UISchemaHandlerImpl;

#[async_trait]
impl UISchemaHandler for UISchemaHandlerImpl {
    async fn inspect(
        &self,
        input: UISchemaInspectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaInspectOutput, Box<dyn std::error::Error>> {
        let concept_spec = &input.concept_spec;

        let parsed: Value = match serde_json::from_str(concept_spec) {
            Ok(v) => v,
            Err(_) => return Ok(UISchemaInspectOutput::ParseError {
                message: "Failed to parse concept spec as JSON".to_string(),
            }),
        };

        let id = if input.schema.is_empty() { next_id() } else { input.schema.clone() };

        // Derive UI schema from concept spec structure
        let mut elements: Vec<String> = Vec::new();
        if let Some(fields) = parsed.get("fields").and_then(|v| v.as_array()) {
            for field in fields {
                let field_name = if let Some(s) = field.as_str() {
                    s.to_string()
                } else if let Some(name) = field.get("name").and_then(|v| v.as_str()) {
                    name.to_string()
                } else {
                    continue;
                };
                elements.push(field_name);
            }
        }

        let concept_name = parsed.get("name").and_then(|v| v.as_str()).unwrap_or(&id);
        let ui_schema = json!({
            "concept": concept_name,
            "elements": elements,
            "layout": "vertical",
        });

        storage.put("uiSchema", &id, json!({
            "concept": concept_name,
            "elements": serde_json::to_string(&elements)?,
            "uiSchema": serde_json::to_string(&ui_schema)?,
            "overrides": "{}",
        })).await?;

        Ok(UISchemaInspectOutput::Ok { schema: id })
    }

    async fn r#override(
        &self,
        input: UISchemaOverrideInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaOverrideOutput, Box<dyn std::error::Error>> {
        let schema = &input.schema;
        let overrides = &input.overrides;

        let existing = storage.get("uiSchema", schema).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(UISchemaOverrideOutput::Notfound {
                message: format!("UI schema \"{}\" not found", schema),
            }),
        };

        let parsed_overrides: Value = match serde_json::from_str(overrides) {
            Ok(v) => v,
            Err(_) => return Ok(UISchemaOverrideOutput::Invalid {
                message: "Overrides must be valid JSON".to_string(),
            }),
        };

        // Merge overrides
        let existing_overrides: Value = serde_json::from_str(
            existing.get("overrides").and_then(|v| v.as_str()).unwrap_or("{}")
        ).unwrap_or(json!({}));

        let mut merged = existing_overrides.as_object().cloned().unwrap_or_default();
        if let Some(new_overrides) = parsed_overrides.as_object() {
            for (k, v) in new_overrides {
                merged.insert(k.clone(), v.clone());
            }
        }

        // Apply overrides to ui schema
        let ui_schema: Value = serde_json::from_str(
            existing.get("uiSchema").and_then(|v| v.as_str()).unwrap_or("{}")
        ).unwrap_or(json!({}));

        let mut updated = ui_schema.as_object().cloned().unwrap_or_default();
        for (k, v) in &merged {
            updated.insert(k.clone(), v.clone());
        }

        storage.put("uiSchema", schema, json!({
            "concept": existing.get("concept").and_then(|v| v.as_str()).unwrap_or(""),
            "elements": existing.get("elements").and_then(|v| v.as_str()).unwrap_or("[]"),
            "uiSchema": serde_json::to_string(&Value::Object(updated))?,
            "overrides": serde_json::to_string(&Value::Object(merged))?,
        })).await?;

        Ok(UISchemaOverrideOutput::Ok { schema: schema.clone() })
    }

    async fn get_schema(
        &self,
        input: UISchemaGetSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaGetSchemaOutput, Box<dyn std::error::Error>> {
        let schema = &input.schema;

        let existing = storage.get("uiSchema", schema).await?;
        match existing {
            Some(rec) => Ok(UISchemaGetSchemaOutput::Ok {
                schema: schema.clone(),
                ui_schema: rec.get("uiSchema").and_then(|v| v.as_str()).unwrap_or("{}").to_string(),
            }),
            None => Ok(UISchemaGetSchemaOutput::Notfound {
                message: format!("UI schema \"{}\" not found", schema),
            }),
        }
    }

    async fn get_elements(
        &self,
        input: UISchemaGetElementsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaGetElementsOutput, Box<dyn std::error::Error>> {
        let schema = &input.schema;

        let existing = storage.get("uiSchema", schema).await?;
        match existing {
            Some(rec) => Ok(UISchemaGetElementsOutput::Ok {
                elements: rec.get("elements").and_then(|v| v.as_str()).unwrap_or("[]").to_string(),
            }),
            None => Ok(UISchemaGetElementsOutput::Notfound {
                message: format!("UI schema \"{}\" not found", schema),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_inspect_success() {
        let storage = InMemoryStorage::new();
        let handler = UISchemaHandlerImpl;
        let result = handler.inspect(
            UISchemaInspectInput {
                schema: "test-schema".to_string(),
                concept_spec: r#"{"name":"User","fields":["name","email"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UISchemaInspectOutput::Ok { schema } => {
                assert_eq!(schema, "test-schema");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_inspect_parse_error() {
        let storage = InMemoryStorage::new();
        let handler = UISchemaHandlerImpl;
        let result = handler.inspect(
            UISchemaInspectInput {
                schema: "".to_string(),
                concept_spec: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UISchemaInspectOutput::ParseError { .. } => {},
            _ => panic!("Expected ParseError variant"),
        }
    }

    #[tokio::test]
    async fn test_override_not_found() {
        let storage = InMemoryStorage::new();
        let handler = UISchemaHandlerImpl;
        let result = handler.r#override(
            UISchemaOverrideInput {
                schema: "nonexistent".to_string(),
                overrides: r#"{"layout":"horizontal"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UISchemaOverrideOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_override_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = UISchemaHandlerImpl;
        // First create a schema
        handler.inspect(
            UISchemaInspectInput {
                schema: "s1".to_string(),
                concept_spec: r#"{"name":"User","fields":["name"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.r#override(
            UISchemaOverrideInput {
                schema: "s1".to_string(),
                overrides: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UISchemaOverrideOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_get_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = UISchemaHandlerImpl;
        let result = handler.get_schema(
            UISchemaGetSchemaInput { schema: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            UISchemaGetSchemaOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_elements_not_found() {
        let storage = InMemoryStorage::new();
        let handler = UISchemaHandlerImpl;
        let result = handler.get_elements(
            UISchemaGetElementsInput { schema: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            UISchemaGetElementsOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
