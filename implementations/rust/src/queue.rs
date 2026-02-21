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
