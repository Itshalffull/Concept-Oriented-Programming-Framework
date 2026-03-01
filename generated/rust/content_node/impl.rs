// ContentNode Handler Implementation
//
// CRUD operations for structured content nodes with type, metadata,
// and change tracking via timestamps.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ContentNodeHandler;
use serde_json::json;

pub struct ContentNodeHandlerImpl;

#[async_trait]
impl ContentNodeHandler for ContentNodeHandlerImpl {
    async fn create(
        &self,
        input: ContentNodeCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeCreateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("node", &input.node).await?;
        if existing.is_some() {
            return Ok(ContentNodeCreateOutput::Exists {
                message: "already exists".to_string(),
            });
        }

        let now = chrono::Utc::now().to_rfc3339();
        storage.put("node", &input.node, json!({
            "node": input.node,
            "type": input.r#type,
            "content": input.content,
            "metadata": "",
            "createdBy": input.created_by,
            "createdAt": now,
            "updatedAt": now,
        })).await?;

        Ok(ContentNodeCreateOutput::Ok {
            node: input.node,
        })
    }

    async fn update(
        &self,
        input: ContentNodeUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeUpdateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("node", &input.node).await?;
        match existing {
            None => Ok(ContentNodeUpdateOutput::Notfound {
                message: "Node not found".to_string(),
            }),
            Some(mut rec) => {
                rec["content"] = json!(input.content);
                rec["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("node", &input.node, rec).await?;
                Ok(ContentNodeUpdateOutput::Ok {
                    node: input.node,
                })
            }
        }
    }

    async fn delete(
        &self,
        input: ContentNodeDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeDeleteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("node", &input.node).await?;
        if existing.is_none() {
            return Ok(ContentNodeDeleteOutput::Notfound {
                message: "Node not found".to_string(),
            });
        }

        storage.del("node", &input.node).await?;
        Ok(ContentNodeDeleteOutput::Ok {
            node: input.node,
        })
    }

    async fn get(
        &self,
        input: ContentNodeGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("node", &input.node).await?;
        match record {
            None => Ok(ContentNodeGetOutput::Notfound {
                message: "Node not found".to_string(),
            }),
            Some(rec) => Ok(ContentNodeGetOutput::Ok {
                node: input.node,
                r#type: rec["type"].as_str().unwrap_or("").to_string(),
                content: rec["content"].as_str().unwrap_or("").to_string(),
                metadata: rec["metadata"].as_str().unwrap_or("").to_string(),
            }),
        }
    }

    async fn set_metadata(
        &self,
        input: ContentNodeSetMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeSetMetadataOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("node", &input.node).await?;
        match existing {
            None => Ok(ContentNodeSetMetadataOutput::Notfound {
                message: "Node not found".to_string(),
            }),
            Some(mut rec) => {
                rec["metadata"] = json!(input.metadata);
                rec["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("node", &input.node, rec).await?;
                Ok(ContentNodeSetMetadataOutput::Ok {
                    node: input.node,
                })
            }
        }
    }

    async fn change_type(
        &self,
        input: ContentNodeChangeTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeChangeTypeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("node", &input.node).await?;
        match existing {
            None => Ok(ContentNodeChangeTypeOutput::Notfound {
                message: "Node not found".to_string(),
            }),
            Some(mut rec) => {
                rec["type"] = json!(input.r#type);
                rec["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("node", &input.node, rec).await?;
                Ok(ContentNodeChangeTypeOutput::Ok {
                    node: input.node,
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
    async fn test_create_success() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;
        let result = handler.create(
            ContentNodeCreateInput {
                node: "node-1".to_string(),
                r#type: "document".to_string(),
                content: "Hello world".to_string(),
                created_by: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeCreateOutput::Ok { node } => {
                assert_eq!(node, "node-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_exists() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;

        handler.create(
            ContentNodeCreateInput {
                node: "node-1".to_string(),
                r#type: "doc".to_string(),
                content: "text".to_string(),
                created_by: "user".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.create(
            ContentNodeCreateInput {
                node: "node-1".to_string(),
                r#type: "doc".to_string(),
                content: "text".to_string(),
                created_by: "user".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeCreateOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_update_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;
        let result = handler.update(
            ContentNodeUpdateInput { node: "nonexistent".to_string(), content: "new".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeUpdateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;
        let result = handler.delete(
            ContentNodeDeleteInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeDeleteOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;
        let result = handler.get(
            ContentNodeGetInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeGetOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_metadata_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;
        let result = handler.set_metadata(
            ContentNodeSetMetadataInput { node: "nonexistent".to_string(), metadata: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeSetMetadataOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_change_type_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandlerImpl;
        let result = handler.change_type(
            ContentNodeChangeTypeInput { node: "nonexistent".to_string(), r#type: "new-type".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentNodeChangeTypeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
