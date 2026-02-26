// ContentNode Concept Implementation (Rust)
//
// Manages content nodes with type, content body, and metadata.
// See Architecture doc Sections on content model.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInput {
    pub id: String,
    pub node_type: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateOutput {
    #[serde(rename = "ok")]
    Ok { id: String },
}

// --- Update ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInput {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum UpdateOutput {
    #[serde(rename = "ok")]
    Ok { id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Delete ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeleteOutput {
    #[serde(rename = "ok")]
    Ok { id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- SetMetadata ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetMetadataInput {
    pub id: String,
    pub key: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetMetadataOutput {
    #[serde(rename = "ok")]
    Ok { id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- GetMetadata ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetMetadataInput {
    pub id: String,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetMetadataOutput {
    #[serde(rename = "ok")]
    Ok {
        id: String,
        key: String,
        value: serde_json::Value,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- ChangeType ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeTypeInput {
    pub id: String,
    pub new_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ChangeTypeOutput {
    #[serde(rename = "ok")]
    Ok { id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

pub struct ContentNodeHandler;

impl ContentNodeHandler {
    pub async fn create(
        &self,
        input: CreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "content_node",
                &input.id,
                json!({
                    "id": input.id,
                    "node_type": input.node_type,
                    "content": input.content,
                    "metadata": {},
                    "created_at": now,
                    "updated_at": now,
                    "created_by": null,
                }),
            )
            .await?;

        Ok(CreateOutput::Ok { id: input.id })
    }

    pub async fn update(
        &self,
        input: UpdateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<UpdateOutput> {
        let existing = storage.get("content_node", &input.id).await?;
        match existing {
            None => Ok(UpdateOutput::NotFound {
                message: format!("content node '{}' not found", input.id),
            }),
            Some(mut node) => {
                let now = chrono::Utc::now().to_rfc3339();
                node["content"] = json!(input.content);
                node["updated_at"] = json!(now);
                storage.put("content_node", &input.id, node).await?;
                Ok(UpdateOutput::Ok { id: input.id })
            }
        }
    }

    pub async fn delete(
        &self,
        input: DeleteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DeleteOutput> {
        let existing = storage.get("content_node", &input.id).await?;
        match existing {
            None => Ok(DeleteOutput::NotFound {
                message: format!("content node '{}' not found", input.id),
            }),
            Some(_) => {
                storage.del("content_node", &input.id).await?;
                Ok(DeleteOutput::Ok { id: input.id })
            }
        }
    }

    pub async fn set_metadata(
        &self,
        input: SetMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetMetadataOutput> {
        let existing = storage.get("content_node", &input.id).await?;
        match existing {
            None => Ok(SetMetadataOutput::NotFound {
                message: format!("content node '{}' not found", input.id),
            }),
            Some(mut node) => {
                let now = chrono::Utc::now().to_rfc3339();
                if node["metadata"].is_null() {
                    node["metadata"] = json!({});
                }
                node["metadata"][&input.key] = input.value;
                node["updated_at"] = json!(now);
                storage.put("content_node", &input.id, node).await?;
                Ok(SetMetadataOutput::Ok { id: input.id })
            }
        }
    }

    pub async fn get_metadata(
        &self,
        input: GetMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetMetadataOutput> {
        let existing = storage.get("content_node", &input.id).await?;
        match existing {
            None => Ok(GetMetadataOutput::NotFound {
                message: format!("content node '{}' not found", input.id),
            }),
            Some(node) => {
                let metadata = &node["metadata"];
                if metadata.is_null() || metadata.get(&input.key).is_none() {
                    return Ok(GetMetadataOutput::NotFound {
                        message: format!("metadata key '{}' not found on node '{}'", input.key, input.id),
                    });
                }
                Ok(GetMetadataOutput::Ok {
                    id: input.id,
                    key: input.key.clone(),
                    value: metadata[&input.key].clone(),
                })
            }
        }
    }

    pub async fn change_type(
        &self,
        input: ChangeTypeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ChangeTypeOutput> {
        let existing = storage.get("content_node", &input.id).await?;
        match existing {
            None => Ok(ChangeTypeOutput::NotFound {
                message: format!("content node '{}' not found", input.id),
            }),
            Some(mut node) => {
                let now = chrono::Utc::now().to_rfc3339();
                node["node_type"] = json!(input.new_type);
                node["updated_at"] = json!(now);
                storage.put("content_node", &input.id, node).await?;
                Ok(ChangeTypeOutput::Ok { id: input.id })
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn create_node(handler: &ContentNodeHandler, storage: &InMemoryStorage, id: &str) {
        handler
            .create(
                CreateInput {
                    id: id.into(),
                    node_type: "page".into(),
                    content: "Hello".into(),
                },
                storage,
            )
            .await
            .unwrap();
    }

    // --- create ---

    #[tokio::test]
    async fn create_stores_node() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        let result = handler
            .create(
                CreateInput {
                    id: "n1".into(),
                    node_type: "page".into(),
                    content: "Body text".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CreateOutput::Ok { id } => assert_eq!(id, "n1"),
        }

        let record = storage.get("content_node", "n1").await.unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn create_stores_correct_fields() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        handler
            .create(
                CreateInput {
                    id: "n1".into(),
                    node_type: "article".into(),
                    content: "Content here".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("content_node", "n1").await.unwrap().unwrap();
        assert_eq!(record["node_type"].as_str().unwrap(), "article");
        assert_eq!(record["content"].as_str().unwrap(), "Content here");
    }

    // --- update ---

    #[tokio::test]
    async fn update_changes_content() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        create_node(&handler, &storage, "n1").await;

        let result = handler
            .update(
                UpdateInput { id: "n1".into(), content: "Updated!".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, UpdateOutput::Ok { .. }));

        let record = storage.get("content_node", "n1").await.unwrap().unwrap();
        assert_eq!(record["content"].as_str().unwrap(), "Updated!");
    }

    #[tokio::test]
    async fn update_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        let result = handler
            .update(
                UpdateInput { id: "ghost".into(), content: "x".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, UpdateOutput::NotFound { .. }));
    }

    // --- delete ---

    #[tokio::test]
    async fn delete_removes_node() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        create_node(&handler, &storage, "n1").await;

        let result = handler
            .delete(DeleteInput { id: "n1".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::Ok { .. }));

        let record = storage.get("content_node", "n1").await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        let result = handler
            .delete(DeleteInput { id: "ghost".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::NotFound { .. }));
    }

    // --- set_metadata ---

    #[tokio::test]
    async fn set_metadata_adds_key() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        create_node(&handler, &storage, "n1").await;

        let result = handler
            .set_metadata(
                SetMetadataInput {
                    id: "n1".into(),
                    key: "color".into(),
                    value: json!("blue"),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetMetadataOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn set_metadata_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        let result = handler
            .set_metadata(
                SetMetadataInput {
                    id: "ghost".into(),
                    key: "k".into(),
                    value: json!("v"),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetMetadataOutput::NotFound { .. }));
    }

    // --- get_metadata ---

    #[tokio::test]
    async fn get_metadata_returns_value() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        create_node(&handler, &storage, "n1").await;

        handler
            .set_metadata(
                SetMetadataInput {
                    id: "n1".into(),
                    key: "priority".into(),
                    value: json!(5),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_metadata(
                GetMetadataInput { id: "n1".into(), key: "priority".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetMetadataOutput::Ok { value, .. } => assert_eq!(value, json!(5)),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn get_metadata_not_found_for_missing_key() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        create_node(&handler, &storage, "n1").await;

        let result = handler
            .get_metadata(
                GetMetadataInput { id: "n1".into(), key: "nonexistent".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, GetMetadataOutput::NotFound { .. }));
    }

    // --- change_type ---

    #[tokio::test]
    async fn change_type_updates_node_type() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        create_node(&handler, &storage, "n1").await;

        let result = handler
            .change_type(
                ChangeTypeInput { id: "n1".into(), new_type: "article".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ChangeTypeOutput::Ok { .. }));

        let record = storage.get("content_node", "n1").await.unwrap().unwrap();
        assert_eq!(record["node_type"].as_str().unwrap(), "article");
    }

    #[tokio::test]
    async fn change_type_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentNodeHandler;

        let result = handler
            .change_type(
                ChangeTypeInput { id: "ghost".into(), new_type: "x".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ChangeTypeOutput::NotFound { .. }));
    }
}
