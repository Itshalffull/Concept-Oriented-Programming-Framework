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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- save ---

    #[tokio::test]
    async fn save_persists_node_data() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        let result = handler
            .save(
                SaveInput {
                    node_id: "n1".into(),
                    data: json!({ "title": "Test", "body": "Content" }),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            SaveOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
        }

        let record = storage.get("persisted_node", "n1").await.unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn save_overwrites_existing() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        handler
            .save(
                SaveInput {
                    node_id: "n1".into(),
                    data: json!({ "v": 1 }),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .save(
                SaveInput {
                    node_id: "n1".into(),
                    data: json!({ "v": 2 }),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("persisted_node", "n1").await.unwrap().unwrap();
        assert_eq!(record["data"]["v"].as_i64().unwrap(), 2);
    }

    // --- load ---

    #[tokio::test]
    async fn load_returns_saved_data() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        handler
            .save(
                SaveInput {
                    node_id: "n1".into(),
                    data: json!({ "title": "Loaded" }),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .load(LoadInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();

        match result {
            LoadOutput::Ok { node_id, data } => {
                assert_eq!(node_id, "n1");
                assert_eq!(data["title"].as_str().unwrap(), "Loaded");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn load_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        let result = handler
            .load(LoadInput { node_id: "ghost".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, LoadOutput::NotFound { .. }));
    }

    // --- delete ---

    #[tokio::test]
    async fn delete_removes_persisted_node() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        handler
            .save(
                SaveInput {
                    node_id: "n1".into(),
                    data: json!({ "x": 1 }),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .delete(DeleteInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::Ok { .. }));

        let record = storage.get("persisted_node", "n1").await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        let result = handler
            .delete(DeleteInput { node_id: "ghost".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::NotFound { .. }));
    }

    // --- query ---

    #[tokio::test]
    async fn query_returns_matching_results() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        handler
            .save(
                SaveInput {
                    node_id: "n1".into(),
                    data: json!({ "type": "page", "title": "Intro" }),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .query(
                QueryInput {
                    conditions: json!({ "node_id": "n1" }),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            QueryOutput::Ok { results } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&results).unwrap();
                assert!(!parsed.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn query_returns_empty_for_no_match() {
        let storage = InMemoryStorage::new();
        let handler = ContentStorageHandler;

        let result = handler
            .query(
                QueryInput {
                    conditions: json!({ "node_id": "nonexistent" }),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            QueryOutput::Ok { results } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&results).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }
}
