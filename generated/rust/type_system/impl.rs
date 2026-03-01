// TypeSystem handler implementation
// Type registration, resolution with inheritance, navigation through schema
// properties, and serialization.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TypeSystemHandler;
use serde_json::{json, Value};

pub struct TypeSystemHandlerImpl;

#[async_trait]
impl TypeSystemHandler for TypeSystemHandlerImpl {
    async fn register_type(
        &self,
        input: TypeSystemRegisterTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemRegisterTypeOutput, Box<dyn std::error::Error>> {
        let type_name = &input.r#type;
        let schema = &input.schema;
        let constraints = &input.constraints;

        let existing = storage.get("type", type_name).await?;
        if existing.is_some() {
            return Ok(TypeSystemRegisterTypeOutput::Exists {
                message: "already exists".to_string(),
            });
        }

        storage.put("type", type_name, json!({
            "type": type_name,
            "schema": schema,
            "constraints": constraints,
            "parent": "",
        })).await?;

        Ok(TypeSystemRegisterTypeOutput::Ok {
            r#type: type_name.clone(),
        })
    }

    async fn resolve(
        &self,
        input: TypeSystemResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemResolveOutput, Box<dyn std::error::Error>> {
        let type_name = &input.r#type;

        let record = storage.get("type", type_name).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(TypeSystemResolveOutput::Notfound {
                message: "Type not found".to_string(),
            }),
        };

        let mut schema: Value = serde_json::from_str(
            record.get("schema").and_then(|v| v.as_str()).unwrap_or("{}")
        ).unwrap_or(json!({}));

        let mut parent_id = record.get("parent").and_then(|v| v.as_str()).unwrap_or("").to_string();

        while !parent_id.is_empty() {
            let parent_record = storage.get("type", &parent_id).await?;
            match parent_record {
                Some(pr) => {
                    let parent_schema: Value = serde_json::from_str(
                        pr.get("schema").and_then(|v| v.as_str()).unwrap_or("{}")
                    ).unwrap_or(json!({}));
                    // Merge parent into schema (schema overrides parent)
                    if let (Some(parent_obj), Some(schema_obj)) = (parent_schema.as_object(), schema.as_object()) {
                        let mut merged = parent_obj.clone();
                        for (k, v) in schema_obj {
                            merged.insert(k.clone(), v.clone());
                        }
                        schema = Value::Object(merged);
                    }
                    parent_id = pr.get("parent").and_then(|v| v.as_str()).unwrap_or("").to_string();
                }
                None => break,
            }
        }

        Ok(TypeSystemResolveOutput::Ok {
            r#type: type_name.clone(),
            schema: serde_json::to_string(&schema)?,
        })
    }

    async fn navigate(
        &self,
        input: TypeSystemNavigateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemNavigateOutput, Box<dyn std::error::Error>> {
        let type_name = &input.r#type;
        let path = &input.path;

        let record = storage.get("type", type_name).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(TypeSystemNavigateOutput::Notfound {
                message: "Type not found".to_string(),
            }),
        };

        let schema: Value = serde_json::from_str(
            record.get("schema").and_then(|v| v.as_str()).unwrap_or("{}")
        ).unwrap_or(json!({}));

        let segments: Vec<&str> = path.split('.').collect();
        let mut current = schema;

        for segment in segments {
            if let Some(props) = current.get("properties").and_then(|p| p.get(segment)) {
                current = props.clone();
            } else {
                return Ok(TypeSystemNavigateOutput::Notfound {
                    message: format!("Path segment '{}' not found", segment),
                });
            }
        }

        Ok(TypeSystemNavigateOutput::Ok {
            r#type: type_name.clone(),
            schema: serde_json::to_string(&current)?,
        })
    }

    async fn serialize(
        &self,
        input: TypeSystemSerializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemSerializeOutput, Box<dyn std::error::Error>> {
        let type_name = &input.r#type;
        let value = &input.value;

        let record = storage.get("type", type_name).await?;
        if record.is_none() {
            return Ok(TypeSystemSerializeOutput::Notfound {
                message: "Type not found".to_string(),
            });
        }

        // Parse and re-serialize the value to normalize it
        let parsed: Value = serde_json::from_str(value)?;
        Ok(TypeSystemSerializeOutput::Ok {
            serialized: serde_json::to_string(&parsed)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_type_success() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        let result = handler.register_type(
            TypeSystemRegisterTypeInput {
                r#type: "User".to_string(),
                schema: r#"{"properties":{"name":{"type":"string"}}}"#.to_string(),
                constraints: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemRegisterTypeOutput::Ok { r#type } => {
                assert_eq!(r#type, "User");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_type_exists() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        handler.register_type(
            TypeSystemRegisterTypeInput {
                r#type: "User".to_string(),
                schema: "{}".to_string(),
                constraints: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_type(
            TypeSystemRegisterTypeInput {
                r#type: "User".to_string(),
                schema: "{}".to_string(),
                constraints: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemRegisterTypeOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_success() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        handler.register_type(
            TypeSystemRegisterTypeInput {
                r#type: "User".to_string(),
                schema: r#"{"properties":{"name":{"type":"string"}}}"#.to_string(),
                constraints: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            TypeSystemResolveInput { r#type: "User".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemResolveOutput::Ok { r#type, schema } => {
                assert_eq!(r#type, "User");
                assert!(schema.contains("name"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        let result = handler.resolve(
            TypeSystemResolveInput { r#type: "NonExistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemResolveOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_navigate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        let result = handler.navigate(
            TypeSystemNavigateInput {
                r#type: "NonExistent".to_string(),
                path: "foo".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemNavigateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_serialize_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        let result = handler.serialize(
            TypeSystemSerializeInput {
                r#type: "NonExistent".to_string(),
                value: r#"{"a":1}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemSerializeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_serialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandlerImpl;
        handler.register_type(
            TypeSystemRegisterTypeInput {
                r#type: "User".to_string(),
                schema: "{}".to_string(),
                constraints: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.serialize(
            TypeSystemSerializeInput {
                r#type: "User".to_string(),
                value: r#"{"name":"Alice"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeSystemSerializeOutput::Ok { serialized } => {
                assert!(serialized.contains("Alice"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
