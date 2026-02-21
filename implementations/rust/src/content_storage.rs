// ContentStorage Concept Implementation (Rust)
//
// Persistence layer for content nodes — save, load, delete, and query operations.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Save ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveInput {
    pub node_id: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SaveOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
}

// --- Load ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum LoadOutput {
    #[serde(rename = "ok")]
    Ok {
        node_id: String,
        data: serde_json::Value,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Delete ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeleteOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Query ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryInput {
    pub conditions: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QueryOutput {
    #[serde(rename = "ok")]
    Ok { results: String },
}

pub struct ContentStorageHandler;

impl ContentStorageHandler {
    pub async fn save(
        &self,
        input: SaveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SaveOutput> {
        storage
            .put(
                "persisted_node",
                &input.node_id,
                json!({
                    "node_id": input.node_id,
                    "data": input.data,
                    "saved_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(SaveOutput::Ok {
            node_id: input.node_id,
        })
    }

    pub async fn load(
        &self,
        input: LoadInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<LoadOutput> {
        let existing = storage.get("persisted_node", &input.node_id).await?;
        match existing {
            None => Ok(LoadOutput::NotFound {
                message: format!("persisted node '{}' not found", input.node_id),
            }),
            Some(record) => {
                let data = record
                    .get("data")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                Ok(LoadOutput::Ok {
                    node_id: input.node_id,
                    data,
                })
            }
        }
    }

    pub async fn delete(
        &self,
        input: DeleteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DeleteOutput> {
        let existing = storage.get("persisted_node", &input.node_id).await?;
        match existing {
            None => Ok(DeleteOutput::NotFound {
                message: format!("persisted node '{}' not found", input.node_id),
            }),
            Some(_) => {
                storage.del("persisted_node", &input.node_id).await?;
                Ok(DeleteOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn query(
        &self,
        input: QueryInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<QueryOutput> {
        let results = storage
            .find("persisted_node", Some(&input.conditions))
            .await?;
        let results_json = serde_json::to_string(&results)?;
        Ok(QueryOutput::Ok {
            results: results_json,
        })
    }
}
