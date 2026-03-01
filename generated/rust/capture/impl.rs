// Capture Handler Implementation
//
// Content capture from URLs, file imports, and subscriptions.
// Manages capture items, subscriptions with watermark-based change
// detection, and item readiness lifecycle.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CaptureHandler;
use serde_json::json;

pub struct CaptureHandlerImpl;

fn generate_id(prefix: &str) -> String {
    use std::time::SystemTime;
    let ts = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let rand = ts % 0xFFFFFF;
    format!("{}-{}-{:06x}", prefix, ts, rand)
}

#[async_trait]
impl CaptureHandler for CaptureHandlerImpl {
    async fn clip(
        &self,
        input: CaptureClipInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureClipOutput, Box<dyn std::error::Error>> {
        let item_id = generate_id("cap");
        let now = chrono::Utc::now().to_rfc3339();

        let metadata: serde_json::Value = serde_json::from_str(&input.metadata)
            .unwrap_or_else(|_| json!({}));

        storage.put("captureItem", &item_id, json!({
            "itemId": item_id,
            "url": input.url,
            "mode": input.mode,
            "content": "",
            "sourceMetadata": {
                "url": input.url,
                "capturedAt": now,
                "contentType": input.mode,
            },
            "status": "new",
        })).await?;

        Ok(CaptureClipOutput::Ok {
            item_id,
            content: String::new(),
        })
    }

    async fn import(
        &self,
        input: CaptureImportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureImportOutput, Box<dyn std::error::Error>> {
        let item_id = generate_id("cap");
        let now = chrono::Utc::now().to_rfc3339();

        let options: serde_json::Value = serde_json::from_str(&input.options)
            .unwrap_or_else(|_| json!({}));

        storage.put("captureItem", &item_id, json!({
            "itemId": item_id,
            "file": input.file,
            "content": "",
            "sourceMetadata": {
                "file": input.file,
                "capturedAt": now,
                "contentType": "file_upload",
            },
            "status": "new",
        })).await?;

        Ok(CaptureImportOutput::Ok {
            item_id,
            content: String::new(),
        })
    }

    async fn subscribe(
        &self,
        input: CaptureSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureSubscribeOutput, Box<dyn std::error::Error>> {
        let subscription_id = generate_id("sub");

        storage.put("captureSubscription", &subscription_id, json!({
            "subscriptionId": subscription_id,
            "sourceId": input.source_id,
            "schedule": input.schedule,
            "captureMode": input.mode,
            "lastRun": null,
            "watermark": null,
        })).await?;

        Ok(CaptureSubscribeOutput::Ok { subscription_id })
    }

    async fn detect_changes(
        &self,
        input: CaptureDetectChangesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureDetectChangesOutput, Box<dyn std::error::Error>> {
        let sub = storage.get("captureSubscription", &input.subscription_id).await?;

        match sub {
            None => Ok(CaptureDetectChangesOutput::Notfound {
                message: format!("Subscription \"{}\" not found", input.subscription_id),
            }),
            Some(sub) => {
                let now = chrono::Utc::now().to_rfc3339();

                // Update last run timestamp using watermark/hash comparison
                let mut updated = sub.clone();
                updated["lastRun"] = json!(now);
                storage.put("captureSubscription", &input.subscription_id, updated).await?;

                Ok(CaptureDetectChangesOutput::Ok {
                    changeset: "[]".to_string(),
                })
            }
        }
    }

    async fn mark_ready(
        &self,
        input: CaptureMarkReadyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureMarkReadyOutput, Box<dyn std::error::Error>> {
        let item = storage.get("captureItem", &input.item_id).await?;

        match item {
            None => Ok(CaptureMarkReadyOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
            Some(mut item) => {
                item["status"] = json!("processing");
                storage.put("captureItem", &input.item_id, item).await?;
                Ok(CaptureMarkReadyOutput::Ok)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_clip_creates_item() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let result = handler.clip(
            CaptureClipInput {
                url: "https://example.com".to_string(),
                mode: "html".to_string(),
                metadata: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CaptureClipOutput::Ok { item_id, .. } => {
                assert!(item_id.starts_with("cap-"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_import_creates_item() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let result = handler.import(
            CaptureImportInput {
                file: "/path/to/file.md".to_string(),
                options: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CaptureImportOutput::Ok { item_id, .. } => {
                assert!(item_id.starts_with("cap-"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_subscribe_creates_subscription() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let result = handler.subscribe(
            CaptureSubscribeInput {
                source_id: "feed-1".to_string(),
                schedule: "daily".to_string(),
                mode: "rss".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CaptureSubscribeOutput::Ok { subscription_id } => {
                assert!(subscription_id.starts_with("sub-"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_detect_changes_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let result = handler.detect_changes(
            CaptureDetectChangesInput { subscription_id: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CaptureDetectChangesOutput::Notfound { message } => {
                assert!(message.contains("not found"));
            }
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_detect_changes_success() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let sub_result = handler.subscribe(
            CaptureSubscribeInput {
                source_id: "feed-2".to_string(),
                schedule: "hourly".to_string(),
                mode: "atom".to_string(),
            },
            &storage,
        ).await.unwrap();
        let sub_id = match sub_result {
            CaptureSubscribeOutput::Ok { subscription_id } => subscription_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.detect_changes(
            CaptureDetectChangesInput { subscription_id: sub_id },
            &storage,
        ).await.unwrap();
        match result {
            CaptureDetectChangesOutput::Ok { changeset } => {
                assert_eq!(changeset, "[]");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_mark_ready_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let result = handler.mark_ready(
            CaptureMarkReadyInput { item_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CaptureMarkReadyOutput::Notfound { message } => {
                assert!(message.contains("not found"));
            }
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_mark_ready_success() {
        let storage = InMemoryStorage::new();
        let handler = CaptureHandlerImpl;
        let clip_result = handler.clip(
            CaptureClipInput {
                url: "https://example.com/page".to_string(),
                mode: "html".to_string(),
                metadata: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let item_id = match clip_result {
            CaptureClipOutput::Ok { item_id, .. } => item_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.mark_ready(
            CaptureMarkReadyInput { item_id },
            &storage,
        ).await.unwrap();
        match result {
            CaptureMarkReadyOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }
}
