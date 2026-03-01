// ContentStorage Handler Implementation
//
// Persistence layer for content records. Supports save, load, delete,
// query, and automatic schema generation from stored data.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ContentStorageHandler;
use serde_json::json;

pub struct ContentStorageHandlerImpl;

#[async_trait]
impl ContentStorageHandler for ContentStorageHandlerImpl {
    async fn save(
        &self,
        input: ContentStorageSaveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageSaveOutput, Box<dyn std::error::Error>> {
        match storage.put("record", &input.record, json!({
            "record": input.record,
            "data": input.data,
        })).await {
            Ok(_) => Ok(ContentStorageSaveOutput::Ok {
                record: input.record,
            }),
            Err(e) => Ok(ContentStorageSaveOutput::Error {
                message: format!("Backend write failed: {}", e),
            }),
        }
    }

    async fn load(
        &self,
        input: ContentStorageLoadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageLoadOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("record", &input.record).await?;
        match existing {
            None => Ok(ContentStorageLoadOutput::Notfound {
                message: "not found".to_string(),
            }),
            Some(rec) => Ok(ContentStorageLoadOutput::Ok {
                record: input.record,
                data: rec["data"].as_str().unwrap_or("").to_string(),
            }),
        }
    }

    async fn delete(
        &self,
        input: ContentStorageDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageDeleteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("record", &input.record).await?;
        if existing.is_none() {
            return Ok(ContentStorageDeleteOutput::Notfound {
                message: "not found".to_string(),
            });
        }

        storage.del("record", &input.record).await?;
        Ok(ContentStorageDeleteOutput::Ok {
            record: input.record,
        })
    }

    async fn query(
        &self,
        input: ContentStorageQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageQueryOutput, Box<dyn std::error::Error>> {
        let results = storage.find("record", json!(input.filter)).await?;
        Ok(ContentStorageQueryOutput::Ok {
            results: serde_json::to_string(&results)?,
        })
    }

    async fn generate_schema(
        &self,
        input: ContentStorageGenerateSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageGenerateSchemaOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("record", &input.record).await?;
        match existing {
            None => Ok(ContentStorageGenerateSchemaOutput::Notfound {
                message: "not found".to_string(),
            }),
            Some(rec) => {
                let data_str = rec["data"].as_str().unwrap_or("{}");
                let data: serde_json::Value = serde_json::from_str(data_str)
                    .unwrap_or(json!({}));

                // Generate schema by inspecting the type of each field
                let mut schema = serde_json::Map::new();
                if let Some(obj) = data.as_object() {
                    for (key, value) in obj {
                        let type_name = match value {
                            serde_json::Value::String(_) => "string",
                            serde_json::Value::Number(_) => "number",
                            serde_json::Value::Bool(_) => "boolean",
                            serde_json::Value::Array(_) => "object",
                            serde_json::Value::Object(_) => "object",
                            serde_json::Value::Null => "undefined",
                        };
                        schema.insert(key.clone(), json!(type_name));
                    }
                }

                Ok(ContentStorageGenerateSchemaOutput::Ok {
                    schema: serde_json::to_string(&schema)?,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_save_success() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandlerImpl;
        let result = handler.save(
            ContentStorageSaveInput {
                record: "rec-1".to_string(),
                data: r#"{"key":"value"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentStorageSaveOutput::Ok { record } => {
                assert_eq!(record, "rec-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_load_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandlerImpl;
        let result = handler.load(
            ContentStorageLoadInput { record: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentStorageLoadOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandlerImpl;
        let result = handler.delete(
            ContentStorageDeleteInput { record: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentStorageDeleteOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_save_then_load() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandlerImpl;

        handler.save(
            ContentStorageSaveInput {
                record: "rec-1".to_string(),
                data: "my-data".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.load(
            ContentStorageLoadInput { record: "rec-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentStorageLoadOutput::Ok { data, .. } => {
                assert_eq!(data, "my-data");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandlerImpl;
        let result = handler.generate_schema(
            ContentStorageGenerateSchemaInput { record: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentStorageGenerateSchemaOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_query() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandlerImpl;
        let result = handler.query(
            ContentStorageQueryInput { filter: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentStorageQueryOutput::Ok { results } => {
                assert!(!results.is_empty());
            },
        }
    }
}
