// SyncedContent concept implementation
// Manages content that is synchronized from an original source.
// References stay linked to originals and auto-update; they can be
// converted to independent copies that no longer track changes.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncedContentHandler;
use serde_json::json;

pub struct SyncedContentHandlerImpl;

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}Z", t.as_secs())
}

#[async_trait]
impl SyncedContentHandler for SyncedContentHandlerImpl {
    async fn create_reference(
        &self,
        input: SyncedContentCreateReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentCreateReferenceOutput, Box<dyn std::error::Error>> {
        // Note: types use `ref` as field name which is a Rust keyword;
        // we access via the struct field which is likely renamed with #[serde(rename)]
        let ref_id = &input.r#ref;
        let original_id = &input.original;

        // Check original exists
        let original = storage.get("synced_content", original_id).await?;
        if original.is_none() {
            // Create the original record if it doesn't exist yet
            storage.put("synced_content", original_id, json!({
                "id": original_id,
                "type": "original",
                "content": "",
                "createdAt": current_timestamp(),
            })).await?;
        }

        // Create the reference
        storage.put("synced_content_ref", ref_id, json!({
            "id": ref_id,
            "original": original_id,
            "type": "reference",
            "independent": false,
            "createdAt": current_timestamp(),
        })).await?;

        Ok(SyncedContentCreateReferenceOutput::Ok)
    }

    async fn edit_original(
        &self,
        input: SyncedContentEditOriginalInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentEditOriginalOutput, Box<dyn std::error::Error>> {
        let original_id = &input.original;

        let existing = storage.get("synced_content", original_id).await?;
        if existing.is_none() {
            return Ok(SyncedContentEditOriginalOutput::Notfound {
                message: format!("Original content \"{}\" not found", original_id),
            });
        }

        let mut updated = existing.unwrap();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("content".to_string(), json!(&input.content));
            obj.insert("updatedAt".to_string(), json!(current_timestamp()));
        }

        storage.put("synced_content", original_id, updated).await?;

        // Propagate to all non-independent references
        let all_refs = storage.find("synced_content_ref", Some(&json!({
            "original": original_id,
        }))).await?;

        for r in &all_refs {
            let independent = r.get("independent")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if !independent {
                let ref_id = r.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let mut ref_updated = r.clone();
                if let Some(obj) = ref_updated.as_object_mut() {
                    obj.insert("syncedContent".to_string(), json!(&input.content));
                    obj.insert("lastSyncAt".to_string(), json!(current_timestamp()));
                }
                storage.put("synced_content_ref", ref_id, ref_updated).await?;
            }
        }

        Ok(SyncedContentEditOriginalOutput::Ok)
    }

    async fn delete_reference(
        &self,
        input: SyncedContentDeleteReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentDeleteReferenceOutput, Box<dyn std::error::Error>> {
        let ref_id = &input.r#ref;

        let existing = storage.get("synced_content_ref", ref_id).await?;
        if existing.is_none() {
            return Ok(SyncedContentDeleteReferenceOutput::Notfound {
                message: format!("Reference \"{}\" not found", ref_id),
            });
        }

        storage.del("synced_content_ref", ref_id).await?;

        Ok(SyncedContentDeleteReferenceOutput::Ok)
    }

    async fn convert_to_independent(
        &self,
        input: SyncedContentConvertToIndependentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentConvertToIndependentOutput, Box<dyn std::error::Error>> {
        let ref_id = &input.r#ref;

        let existing = storage.get("synced_content_ref", ref_id).await?;
        match existing {
            Some(mut e) => {
                if let Some(obj) = e.as_object_mut() {
                    obj.insert("independent".to_string(), json!(true));
                    obj.insert("convertedAt".to_string(), json!(current_timestamp()));
                }
                storage.put("synced_content_ref", ref_id, e).await?;
                Ok(SyncedContentConvertToIndependentOutput::Ok)
            }
            None => {
                Ok(SyncedContentConvertToIndependentOutput::Notfound {
                    message: format!("Reference \"{}\" not found", ref_id),
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_reference() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        let result = handler.create_reference(
            SyncedContentCreateReferenceInput {
                r#ref: "ref-1".to_string(),
                original: "original-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentCreateReferenceOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_edit_original() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        // Create a reference to establish the original
        handler.create_reference(
            SyncedContentCreateReferenceInput {
                r#ref: "ref-1".to_string(),
                original: "original-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.edit_original(
            SyncedContentEditOriginalInput {
                original: "original-1".to_string(),
                content: "Updated content".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentEditOriginalOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_edit_original_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        let result = handler.edit_original(
            SyncedContentEditOriginalInput {
                original: "nonexistent".to_string(),
                content: "content".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentEditOriginalOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_reference() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        handler.create_reference(
            SyncedContentCreateReferenceInput {
                r#ref: "ref-1".to_string(),
                original: "original-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.delete_reference(
            SyncedContentDeleteReferenceInput { r#ref: "ref-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentDeleteReferenceOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_reference_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        let result = handler.delete_reference(
            SyncedContentDeleteReferenceInput { r#ref: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentDeleteReferenceOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_convert_to_independent() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        handler.create_reference(
            SyncedContentCreateReferenceInput {
                r#ref: "ref-1".to_string(),
                original: "original-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.convert_to_independent(
            SyncedContentConvertToIndependentInput { r#ref: "ref-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentConvertToIndependentOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_convert_to_independent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncedContentHandlerImpl;
        let result = handler.convert_to_independent(
            SyncedContentConvertToIndependentInput { r#ref: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncedContentConvertToIndependentOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
