// Capture Concept Implementation (Rust)
//
// Data integration kit — detect and ingest data from any source.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureClipInput {
    pub url: String,
    pub mode: String,
    pub metadata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CaptureClipOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String, content: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureImportInput {
    pub file: String,
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CaptureImportOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String, content: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSubscribeInput {
    pub source_id: String,
    pub schedule: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CaptureSubscribeOutput {
    #[serde(rename = "ok")]
    Ok { subscription_id: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureDetectChangesInput {
    pub subscription_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CaptureDetectChangesOutput {
    #[serde(rename = "ok")]
    Ok { changeset: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "empty")]
    Empty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureMarkReadyInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CaptureMarkReadyOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

pub struct CaptureHandler;

impl CaptureHandler {
    pub async fn clip(
        &self,
        input: CaptureClipInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CaptureClipOutput> {
        let item_id = format!("cap-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "capture_item",
                &item_id,
                json!({
                    "item_id": item_id,
                    "url": input.url,
                    "mode": input.mode,
                    "content": "",
                    "source_metadata": {
                        "url": input.url,
                        "captured_at": chrono::Utc::now().to_rfc3339(),
                        "content_type": input.mode,
                    },
                    "status": "new",
                }),
            )
            .await?;

        Ok(CaptureClipOutput::Ok {
            item_id,
            content: String::new(),
        })
    }

    pub async fn import(
        &self,
        input: CaptureImportInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CaptureImportOutput> {
        let item_id = format!("cap-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "capture_item",
                &item_id,
                json!({
                    "item_id": item_id,
                    "file": input.file,
                    "content": "",
                    "source_metadata": {
                        "file": input.file,
                        "captured_at": chrono::Utc::now().to_rfc3339(),
                        "content_type": "file_upload",
                    },
                    "status": "new",
                }),
            )
            .await?;

        Ok(CaptureImportOutput::Ok {
            item_id,
            content: String::new(),
        })
    }

    pub async fn subscribe(
        &self,
        input: CaptureSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CaptureSubscribeOutput> {
        let subscription_id = format!("sub-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "capture_subscription",
                &subscription_id,
                json!({
                    "subscription_id": subscription_id,
                    "source_id": input.source_id,
                    "schedule": input.schedule,
                    "capture_mode": input.mode,
                    "last_run": null,
                    "watermark": null,
                }),
            )
            .await?;

        Ok(CaptureSubscribeOutput::Ok { subscription_id })
    }

    pub async fn detect_changes(
        &self,
        input: CaptureDetectChangesInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CaptureDetectChangesOutput> {
        let existing = storage
            .get("capture_subscription", &input.subscription_id)
            .await?;
        match existing {
            None => Ok(CaptureDetectChangesOutput::Notfound {
                message: format!("Subscription \"{}\" not found", input.subscription_id),
            }),
            Some(mut record) => {
                record["last_run"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("capture_subscription", &input.subscription_id, record)
                    .await?;
                Ok(CaptureDetectChangesOutput::Ok {
                    changeset: "[]".into(),
                })
            }
        }
    }

    pub async fn mark_ready(
        &self,
        input: CaptureMarkReadyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CaptureMarkReadyOutput> {
        let existing = storage.get("capture_item", &input.item_id).await?;
        match existing {
            None => Ok(CaptureMarkReadyOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
            Some(mut record) => {
                record["status"] = json!("processing");
                storage.put("capture_item", &input.item_id, record).await?;
                Ok(CaptureMarkReadyOutput::Ok)
            }
        }
    }
}
