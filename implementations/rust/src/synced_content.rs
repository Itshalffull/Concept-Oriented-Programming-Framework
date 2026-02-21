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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── create_reference tests ─────────────────────────────

    #[tokio::test]
    async fn create_reference_returns_ref_id() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let result = handler
            .create_reference(
                CreateReferenceInput {
                    source_id: "src1".into(),
                    target_location: "/page/2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CreateReferenceOutput::Ok { ref_id } => {
                assert!(ref_id.starts_with("ref_src1_"));
            }
        }
    }

    #[tokio::test]
    async fn create_reference_stores_reference_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let result = handler
            .create_reference(
                CreateReferenceInput {
                    source_id: "src2".into(),
                    target_location: "/page/3".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let ref_id = match result {
            CreateReferenceOutput::Ok { ref_id } => ref_id,
        };

        let record = storage.get("synced_reference", &ref_id).await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["source_id"].as_str().unwrap(), "src2");
        assert_eq!(record["synced"], serde_json::json!(true));
    }

    // ── edit_original tests ────────────────────────────────

    #[tokio::test]
    async fn edit_original_updates_content() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let create_result = handler
            .create_reference(
                CreateReferenceInput {
                    source_id: "src1".into(),
                    target_location: "/loc".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let ref_id = match create_result {
            CreateReferenceOutput::Ok { ref_id } => ref_id,
        };

        let result = handler
            .edit_original(
                EditOriginalInput {
                    ref_id: ref_id.clone(),
                    new_content: "Updated content".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, EditOriginalOutput::Ok { .. }));

        let original = storage.get("synced_original", "src1").await.unwrap().unwrap();
        assert_eq!(original["content"].as_str().unwrap(), "Updated content");
    }

    #[tokio::test]
    async fn edit_original_returns_notfound_for_missing_ref() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let result = handler
            .edit_original(
                EditOriginalInput {
                    ref_id: "nonexistent".into(),
                    new_content: "content".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, EditOriginalOutput::NotFound { .. }));
    }

    // ── delete_reference tests ─────────────────────────────

    #[tokio::test]
    async fn delete_reference_removes_synced_reference() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let create_result = handler
            .create_reference(
                CreateReferenceInput {
                    source_id: "src1".into(),
                    target_location: "/loc".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let ref_id = match create_result {
            CreateReferenceOutput::Ok { ref_id } => ref_id,
        };

        let result = handler
            .delete_reference(
                DeleteReferenceInput {
                    ref_id: ref_id.clone(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DeleteReferenceOutput::Ok { .. }));

        let record = storage.get("synced_reference", &ref_id).await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn delete_reference_returns_notfound_for_missing() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let result = handler
            .delete_reference(
                DeleteReferenceInput {
                    ref_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DeleteReferenceOutput::NotFound { .. }));
    }

    // ── convert_to_independent tests ───────────────────────

    #[tokio::test]
    async fn convert_to_independent_creates_independent_copy() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let create_result = handler
            .create_reference(
                CreateReferenceInput {
                    source_id: "src1".into(),
                    target_location: "/loc".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let ref_id = match create_result {
            CreateReferenceOutput::Ok { ref_id } => ref_id,
        };

        // Set some content first
        handler
            .edit_original(
                EditOriginalInput {
                    ref_id: ref_id.clone(),
                    new_content: "Original text".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .convert_to_independent(
                ConvertToIndependentInput {
                    ref_id: ref_id.clone(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ConvertToIndependentOutput::Ok { new_node_id } => {
                assert!(new_node_id.starts_with("independent_src1_"));

                let independent = storage
                    .get("synced_original", &new_node_id)
                    .await
                    .unwrap()
                    .unwrap();
                assert_eq!(independent["content"].as_str().unwrap(), "Original text");
                assert_eq!(independent["independent"], serde_json::json!(true));
            }
            _ => panic!("expected Ok variant"),
        }

        // The synced reference should be removed
        let ref_record = storage.get("synced_reference", &ref_id).await.unwrap();
        assert!(ref_record.is_none());
    }

    #[tokio::test]
    async fn convert_to_independent_returns_notfound_for_missing() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandler;

        let result = handler
            .convert_to_independent(
                ConvertToIndependentInput {
                    ref_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ConvertToIndependentOutput::NotFound { .. }
        ));
    }
}
