// Queue concept implementation
// Priority-based work queue with enqueue, claim, process, release, and delete operations.
// Workers claim items for exclusive processing with automatic release on failure.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::QueueHandler;
use serde_json::json;

pub struct QueueHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("item-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl QueueHandler for QueueHandlerImpl {
    async fn enqueue(
        &self,
        input: QueueEnqueueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueEnqueueOutput, Box<dyn std::error::Error>> {
        // Verify the queue exists or create it
        let queue = storage.get("queue-meta", &input.queue).await?;
        if queue.is_none() {
            storage.put("queue-meta", &input.queue, json!({
                "queue": input.queue,
                "createdAt": chrono::Utc::now().to_rfc3339(),
            })).await?;
        }

        let item_id = next_id();

        storage.put("queue-item", &item_id, json!({
            "itemId": item_id,
            "queue": input.queue,
            "item": input.item,
            "priority": input.priority,
            "status": "pending",
            "claimedBy": null,
            "enqueuedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(QueueEnqueueOutput::Ok { item_id })
    }

    async fn claim(
        &self,
        input: QueueClaimInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueClaimOutput, Box<dyn std::error::Error>> {
        // Find all pending items for this queue, sorted by priority (highest first)
        let items = storage.find("queue-item", Some(&json!({
            "queue": input.queue,
            "status": "pending",
        }))).await?;

        if items.is_empty() {
            return Ok(QueueClaimOutput::Empty {
                message: format!("No pending items in queue \"{}\"", input.queue),
            });
        }

        // Pick highest-priority item
        let mut sorted_items = items;
        sorted_items.sort_by(|a, b| {
            let pa = a.get("priority").and_then(|v| v.as_i64()).unwrap_or(0);
            let pb = b.get("priority").and_then(|v| v.as_i64()).unwrap_or(0);
            pb.cmp(&pa)
        });

        let chosen = &sorted_items[0];
        let item_id = chosen.get("itemId").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let mut claimed = chosen.clone();
        claimed["status"] = json!("claimed");
        claimed["claimedBy"] = json!(input.worker);
        claimed["claimedAt"] = json!(chrono::Utc::now().to_rfc3339());

        storage.put("queue-item", &item_id, claimed).await?;

        let item_payload = chosen.get("item").and_then(|v| v.as_str()).unwrap_or("").to_string();

        Ok(QueueClaimOutput::Ok {
            item: serde_json::to_string(&json!({
                "itemId": item_id,
                "payload": item_payload,
            }))?,
        })
    }

    async fn process(
        &self,
        input: QueueProcessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueProcessOutput, Box<dyn std::error::Error>> {
        let item = storage.get("queue-item", &input.item_id).await?;
        let mut item = match item {
            Some(r) => r,
            None => return Ok(QueueProcessOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
        };

        item["status"] = json!("processed");
        item["result"] = json!(input.result);
        item["processedAt"] = json!(chrono::Utc::now().to_rfc3339());

        storage.put("queue-item", &input.item_id, item).await?;

        Ok(QueueProcessOutput::Ok)
    }

    async fn release(
        &self,
        input: QueueReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueReleaseOutput, Box<dyn std::error::Error>> {
        let item = storage.get("queue-item", &input.item_id).await?;
        let mut item = match item {
            Some(r) => r,
            None => return Ok(QueueReleaseOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
        };

        // Release back to pending state for another worker
        item["status"] = json!("pending");
        item["claimedBy"] = json!(null);
        item["claimedAt"] = json!(null);

        storage.put("queue-item", &input.item_id, item).await?;

        Ok(QueueReleaseOutput::Ok)
    }

    async fn delete(
        &self,
        input: QueueDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueDeleteOutput, Box<dyn std::error::Error>> {
        let item = storage.get("queue-item", &input.item_id).await?;
        if item.is_none() {
            return Ok(QueueDeleteOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            });
        }

        storage.del("queue-item", &input.item_id).await?;

        Ok(QueueDeleteOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_enqueue() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandlerImpl;
        let result = handler.enqueue(
            QueueEnqueueInput {
                queue: "work".to_string(),
                item: "task-data".to_string(),
                priority: 5,
            },
            &storage,
        ).await.unwrap();
        match result {
            QueueEnqueueOutput::Ok { item_id } => {
                assert!(!item_id.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_claim_empty_queue() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandlerImpl;
        let result = handler.claim(
            QueueClaimInput { queue: "empty".to_string(), worker: "w1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            QueueClaimOutput::Empty { .. } => {}
            _ => panic!("Expected Empty variant"),
        }
    }

    #[tokio::test]
    async fn test_process_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandlerImpl;
        let result = handler.process(
            QueueProcessInput {
                queue: "work".to_string(),
                item_id: "nonexistent".to_string(),
                result: "done".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            QueueProcessOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_release_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandlerImpl;
        let result = handler.release(
            QueueReleaseInput {
                queue: "work".to_string(),
                item_id: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            QueueReleaseOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueueHandlerImpl;
        let result = handler.delete(
            QueueDeleteInput {
                queue: "work".to_string(),
                item_id: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            QueueDeleteOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
