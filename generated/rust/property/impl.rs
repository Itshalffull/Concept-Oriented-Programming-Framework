// Property -- key-value property store for entities with type validation,
// retrieval, deletion, and listing of all properties.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PropertyHandler;
use serde_json::json;

pub struct PropertyHandlerImpl;

#[async_trait]
impl PropertyHandler for PropertyHandlerImpl {
    async fn set(
        &self,
        input: PropertySetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertySetOutput, Box<dyn std::error::Error>> {
        // Check for registered type constraints
        let type_record = storage.get("propertyType", &input.key).await?;
        if let Some(tr) = type_record {
            if let Some(schema_str) = tr["schema"].as_str() {
                if let Ok(schema) = serde_json::from_str::<serde_json::Value>(schema_str) {
                    if schema["type"].as_str() == Some("number") {
                        if input.value.parse::<f64>().is_err() {
                            return Ok(PropertySetOutput::Invalid {
                                message: "Value does not match the registered type".to_string(),
                            });
                        }
                    }
                }
            }
        }

        // Get existing properties for this entity
        let props_record = storage.get("property", &input.entity).await?;
        let mut properties: serde_json::Map<String, serde_json::Value> = match props_record {
            Some(record) => {
                if let Some(props_str) = record["properties"].as_str() {
                    serde_json::from_str(props_str).unwrap_or_default()
                } else {
                    serde_json::Map::new()
                }
            }
            None => serde_json::Map::new(),
        };

        properties.insert(input.key.clone(), json!(input.value));

        storage.put("property", &input.entity, json!({
            "entity": input.entity,
            "properties": serde_json::to_string(&properties)?,
        })).await?;

        Ok(PropertySetOutput::Ok {
            entity: input.entity,
        })
    }

    async fn get(
        &self,
        input: PropertyGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyGetOutput, Box<dyn std::error::Error>> {
        let props_record = storage.get("property", &input.entity).await?;
        let record = match props_record {
            Some(r) => r,
            None => {
                return Ok(PropertyGetOutput::Notfound {
                    message: "not found".to_string(),
                });
            }
        };

        let properties: serde_json::Map<String, serde_json::Value> =
            if let Some(props_str) = record["properties"].as_str() {
                serde_json::from_str(props_str).unwrap_or_default()
            } else {
                serde_json::Map::new()
            };

        match properties.get(&input.key) {
            Some(value) => {
                let value_str = value.as_str().unwrap_or("").to_string();
                Ok(PropertyGetOutput::Ok { value: value_str })
            }
            None => Ok(PropertyGetOutput::Notfound {
                message: "not found".to_string(),
            }),
        }
    }

    async fn delete(
        &self,
        input: PropertyDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyDeleteOutput, Box<dyn std::error::Error>> {
        let props_record = storage.get("property", &input.entity).await?;
        let record = match props_record {
            Some(r) => r,
            None => {
                return Ok(PropertyDeleteOutput::Notfound {
                    message: "not found".to_string(),
                });
            }
        };

        let mut properties: serde_json::Map<String, serde_json::Value> =
            if let Some(props_str) = record["properties"].as_str() {
                serde_json::from_str(props_str).unwrap_or_default()
            } else {
                serde_json::Map::new()
            };

        if !properties.contains_key(&input.key) {
            return Ok(PropertyDeleteOutput::Notfound {
                message: "not found".to_string(),
            });
        }

        properties.remove(&input.key);

        storage.put("property", &input.entity, json!({
            "entity": input.entity,
            "properties": serde_json::to_string(&properties)?,
        })).await?;

        Ok(PropertyDeleteOutput::Ok {
            entity: input.entity,
        })
    }

    async fn list_all(
        &self,
        input: PropertyListAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyListAllOutput, Box<dyn std::error::Error>> {
        let props_record = storage.get("property", &input.entity).await?;
        let properties = match props_record {
            Some(record) => {
                record["properties"].as_str().unwrap_or("{}").to_string()
            }
            None => "{}".to_string(),
        };

        Ok(PropertyListAllOutput::Ok { properties })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_set_property() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandlerImpl;
        let result = handler.set(
            PropertySetInput {
                entity: "entity-1".to_string(),
                key: "color".to_string(),
                value: "blue".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PropertySetOutput::Ok { entity } => assert_eq!(entity, "entity-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_property() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandlerImpl;
        handler.set(
            PropertySetInput {
                entity: "entity-1".to_string(),
                key: "color".to_string(),
                value: "blue".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            PropertyGetInput { entity: "entity-1".to_string(), key: "color".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PropertyGetOutput::Ok { value } => assert_eq!(value, "blue"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_property_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandlerImpl;
        let result = handler.get(
            PropertyGetInput { entity: "nonexistent".to_string(), key: "color".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PropertyGetOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_property() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandlerImpl;
        handler.set(
            PropertySetInput {
                entity: "entity-1".to_string(),
                key: "color".to_string(),
                value: "blue".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.delete(
            PropertyDeleteInput { entity: "entity-1".to_string(), key: "color".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PropertyDeleteOutput::Ok { entity } => assert_eq!(entity, "entity-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_property_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandlerImpl;
        let result = handler.delete(
            PropertyDeleteInput { entity: "nonexistent".to_string(), key: "color".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PropertyDeleteOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_all_properties() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandlerImpl;
        handler.set(
            PropertySetInput {
                entity: "entity-1".to_string(),
                key: "color".to_string(),
                value: "blue".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.list_all(
            PropertyListAllInput { entity: "entity-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PropertyListAllOutput::Ok { properties } => {
                assert!(properties.contains("color"));
            }
        }
    }
}
