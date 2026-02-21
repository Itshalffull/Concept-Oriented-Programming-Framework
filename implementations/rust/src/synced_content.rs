// SyncedContent Concept Implementation (Rust)
//
// Manages synced content references with edit propagation and independence conversion.
// See Architecture doc Sections on content synchronization.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── CreateReference ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateReferenceInput {
    pub source_id: String,
    pub target_location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateReferenceOutput {
    #[serde(rename = "ok")]
    Ok { ref_id: String },
}

// ── EditOriginal ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditOriginalInput {
    pub ref_id: String,
    pub new_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EditOriginalOutput {
    #[serde(rename = "ok")]
    Ok { ref_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── DeleteReference ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteReferenceInput {
    pub ref_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeleteReferenceOutput {
    #[serde(rename = "ok")]
    Ok { ref_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ConvertToIndependent ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertToIndependentInput {
    pub ref_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConvertToIndependentOutput {
    #[serde(rename = "ok")]
    Ok { new_node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct SyncedContentHandler;

impl SyncedContentHandler {
    pub async fn create_reference(
        &self,
        input: CreateReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateReferenceOutput> {
        let ref_id = format!(
            "ref_{}_{}",
            input.source_id,
            chrono::Utc::now().timestamp_millis()
        );

        // Store the original content record
        let original = storage.get("synced_original", &input.source_id).await?;
        if original.is_none() {
            storage
                .put(
                    "synced_original",
                    &input.source_id,
                    json!({
                        "source_id": input.source_id,
                        "content": "",
                    }),
                )
                .await?;
        }

        // Store the reference
        storage
            .put(
                "synced_reference",
                &ref_id,
                json!({
                    "ref_id": ref_id,
                    "source_id": input.source_id,
                    "target_location": input.target_location,
                    "synced": true,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(CreateReferenceOutput::Ok { ref_id })
    }

    pub async fn edit_original(
        &self,
        input: EditOriginalInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EditOriginalOutput> {
        let reference = storage.get("synced_reference", &input.ref_id).await?;

        match reference {
            None => Ok(EditOriginalOutput::NotFound {
                message: format!("Reference '{}' not found", input.ref_id),
            }),
            Some(ref_record) => {
                let source_id = ref_record["source_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                // Update the original content
                storage
                    .put(
                        "synced_original",
                        &source_id,
                        json!({
                            "source_id": source_id,
                            "content": input.new_content,
                            "updated_at": chrono::Utc::now().to_rfc3339(),
                        }),
                    )
                    .await?;

                Ok(EditOriginalOutput::Ok {
                    ref_id: input.ref_id,
                })
            }
        }
    }

    pub async fn delete_reference(
        &self,
        input: DeleteReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DeleteReferenceOutput> {
        let existing = storage.get("synced_reference", &input.ref_id).await?;

        if existing.is_none() {
            return Ok(DeleteReferenceOutput::NotFound {
                message: format!("Reference '{}' not found", input.ref_id),
            });
        }

        storage.del("synced_reference", &input.ref_id).await?;

        Ok(DeleteReferenceOutput::Ok {
            ref_id: input.ref_id,
        })
    }

    pub async fn convert_to_independent(
        &self,
        input: ConvertToIndependentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConvertToIndependentOutput> {
        let reference = storage.get("synced_reference", &input.ref_id).await?;

        match reference {
            None => Ok(ConvertToIndependentOutput::NotFound {
                message: format!("Reference '{}' not found", input.ref_id),
            }),
            Some(ref_record) => {
                let source_id = ref_record["source_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                // Get the current content from the original
                let original = storage.get("synced_original", &source_id).await?;
                let content = original
                    .as_ref()
                    .and_then(|o| o["content"].as_str())
                    .unwrap_or("")
                    .to_string();

                // Create an independent copy
                let new_node_id = format!(
                    "independent_{}_{}",
                    source_id,
                    chrono::Utc::now().timestamp_millis()
                );

                storage
                    .put(
                        "synced_original",
                        &new_node_id,
                        json!({
                            "source_id": new_node_id,
                            "content": content,
                            "independent": true,
                            "created_at": chrono::Utc::now().to_rfc3339(),
                        }),
                    )
                    .await?;

                // Remove the synced reference
                storage.del("synced_reference", &input.ref_id).await?;

                Ok(ConvertToIndependentOutput::Ok { new_node_id })
            }
        }
    }
}
