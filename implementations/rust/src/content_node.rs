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
