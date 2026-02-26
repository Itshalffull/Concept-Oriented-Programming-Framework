// Queue Concept Implementation (Rust)
//
// Automation kit — enqueues items, claims the oldest unclaimed item,
// releases items back to the queue, and deletes processed items.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Enqueue ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueEnqueueInput {
    pub queue_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QueueEnqueueOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String },
}

// ── Claim ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueClaimInput {
    pub queue_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QueueClaimOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String, data: String },
    #[serde(rename = "empty")]
    Empty { queue_id: String },
}

// ── Release ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueReleaseInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QueueReleaseOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── DeleteItem ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueDeleteItemInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QueueDeleteItemOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct QueueHandler;

impl QueueHandler {
    pub async fn enqueue(
        &self,
        input: QueueEnqueueInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<QueueEnqueueOutput> {
        let item_id = format!("qi_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "queue_item",
                &item_id,
                json!({
                    "item_id": item_id,
                    "queue_id": input.queue_id,
                    "data": input.data,
                    "status": "pending",
                    "created_at": now,
                }),
            )
            .await?;
        Ok(QueueEnqueueOutput::Ok { item_id })
    }

    pub async fn claim(
        &self,
        input: QueueClaimInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<QueueClaimOutput> {
        let criteria = json!({ "queue_id": input.queue_id, "status": "pending" });
        let items = storage
            .find("queue_item", Some(&criteria))
            .await?;

        // Find the oldest item (first by created_at)
        let oldest = items.iter().min_by_key(|item| {
            item["created_at"].as_str().unwrap_or("").to_string()
        });

        match oldest {
            None => Ok(QueueClaimOutput::Empty {
                queue_id: input.queue_id,
            }),
            Some(item) => {
                let item_id = item["item_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let data = item["data"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                let mut claimed = item.clone();
                claimed["status"] = json!("claimed");
                claimed["claimed_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("queue_item", &item_id, claimed).await?;

                Ok(QueueClaimOutput::Ok { item_id, data })
            }
        }
    }

    pub async fn release(
        &self,
        input: QueueReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<QueueReleaseOutput> {
        let existing = storage.get("queue_item", &input.item_id).await?;
        match existing {
            None => Ok(QueueReleaseOutput::NotFound {
                message: format!("queue item '{}' not found", input.item_id),
            }),
            Some(mut record) => {
                record["status"] = json!("pending");
                record["claimed_at"] = serde_json::Value::Null;
                storage
                    .put("queue_item", &input.item_id, record)
                    .await?;
                Ok(QueueReleaseOutput::Ok {
                    item_id: input.item_id,
                })
            }
        }
    }

    pub async fn delete_item(
        &self,
        input: QueueDeleteItemInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<QueueDeleteItemOutput> {
        let existing = storage.get("queue_item", &input.item_id).await?;
        match existing {
            None => Ok(QueueDeleteItemOutput::NotFound {
                message: format!("queue item '{}' not found", input.item_id),
            }),
            Some(_) => {
                storage.del("queue_item", &input.item_id).await?;
                Ok(QueueDeleteItemOutput::Ok {
                    item_id: input.item_id,
                })
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── enqueue tests ──────────────────────────────────────

    #[tokio::test]
    async fn enqueue_returns_item_id() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let result = handler
            .enqueue(
                QueueEnqueueInput {
                    queue_id: "q1".into(),
                    data: "task data".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            QueueEnqueueOutput::Ok { item_id } => {
                assert!(item_id.starts_with("qi_"));
            }
        }
    }

    #[tokio::test]
    async fn enqueue_stores_item_as_pending() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let result = handler
            .enqueue(
                QueueEnqueueInput {
                    queue_id: "q1".into(),
                    data: "job payload".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let item_id = match result {
            QueueEnqueueOutput::Ok { item_id } => item_id,
        };

        let record = storage.get("queue_item", &item_id).await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["status"].as_str().unwrap(), "pending");
        assert_eq!(record["data"].as_str().unwrap(), "job payload");
    }

    // ── claim tests ────────────────────────────────────────

    #[tokio::test]
    async fn claim_returns_oldest_pending_item() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        handler
            .enqueue(
                QueueEnqueueInput {
                    queue_id: "q1".into(),
                    data: "first".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .claim(
                QueueClaimInput {
                    queue_id: "q1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            QueueClaimOutput::Ok { data, .. } => {
                assert_eq!(data, "first");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn claim_returns_empty_when_queue_is_empty() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let result = handler
            .claim(
                QueueClaimInput {
                    queue_id: "q_empty".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, QueueClaimOutput::Empty { .. }));
    }

    // ── release tests ──────────────────────────────────────

    #[tokio::test]
    async fn release_sets_item_back_to_pending() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let enqueue_result = handler
            .enqueue(
                QueueEnqueueInput {
                    queue_id: "q1".into(),
                    data: "work".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let item_id = match enqueue_result {
            QueueEnqueueOutput::Ok { item_id } => item_id,
        };

        // Claim the item first
        handler
            .claim(
                QueueClaimInput {
                    queue_id: "q1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Release it
        let result = handler
            .release(
                QueueReleaseInput {
                    item_id: item_id.clone(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, QueueReleaseOutput::Ok { .. }));

        let record = storage.get("queue_item", &item_id).await.unwrap().unwrap();
        assert_eq!(record["status"].as_str().unwrap(), "pending");
    }

    #[tokio::test]
    async fn release_returns_notfound_for_missing_item() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let result = handler
            .release(
                QueueReleaseInput {
                    item_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, QueueReleaseOutput::NotFound { .. }));
    }

    // ── delete_item tests ──────────────────────────────────

    #[tokio::test]
    async fn delete_item_removes_existing_item() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let enqueue_result = handler
            .enqueue(
                QueueEnqueueInput {
                    queue_id: "q1".into(),
                    data: "deleteme".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let item_id = match enqueue_result {
            QueueEnqueueOutput::Ok { item_id } => item_id,
        };

        let result = handler
            .delete_item(
                QueueDeleteItemInput {
                    item_id: item_id.clone(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, QueueDeleteItemOutput::Ok { .. }));

        let record = storage.get("queue_item", &item_id).await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn delete_item_returns_notfound_for_missing_item() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandler;

        let result = handler
            .delete_item(
                QueueDeleteItemInput {
                    item_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, QueueDeleteItemOutput::NotFound { .. }));
    }
}
