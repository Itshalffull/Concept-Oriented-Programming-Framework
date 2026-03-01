// InlineAnnotation -- tracked changes within content with accept/reject workflow.
// Supports per-annotation and bulk operations, tracking toggle, and pending list.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::InlineAnnotationHandler;
use serde_json::json;

pub struct InlineAnnotationHandlerImpl;

const VALID_CHANGE_TYPES: &[&str] = &["insert", "delete", "replace", "format"];

#[async_trait]
impl InlineAnnotationHandler for InlineAnnotationHandlerImpl {
    async fn annotate(
        &self,
        input: InlineAnnotationAnnotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationAnnotateOutput, Box<dyn std::error::Error>> {
        // Check if tracking is enabled for this content
        let tracking = storage.get("tracking", &input.content_ref).await?;
        if let Some(ref t) = tracking {
            if t.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
                return Ok(InlineAnnotationAnnotateOutput::TrackingDisabled {
                    message: format!("Change tracking is disabled for '{}'", input.content_ref),
                });
            }
        }

        // Validate change type
        if !VALID_CHANGE_TYPES.contains(&input.change_type.as_str()) {
            return Ok(InlineAnnotationAnnotateOutput::InvalidChangeType {
                message: format!(
                    "Invalid change type '{}'. Must be one of: {}",
                    input.change_type,
                    VALID_CHANGE_TYPES.join(", ")
                ),
            });
        }

        let annotation_id = format!("ann-{}-{}", input.content_ref, input.author);

        storage.put("annotation", &annotation_id, json!({
            "annotationId": annotation_id,
            "contentRef": input.content_ref,
            "changeType": input.change_type,
            "scope": input.scope,
            "author": input.author,
            "status": "pending",
        })).await?;

        Ok(InlineAnnotationAnnotateOutput::Ok {
            annotation_id,
        })
    }

    async fn accept(
        &self,
        input: InlineAnnotationAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationAcceptOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("annotation", &input.annotation_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(InlineAnnotationAcceptOutput::NotFound {
                    message: format!("Annotation '{}' not found", input.annotation_id),
                });
            }
        };

        let status = record.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if status == "accepted" || status == "rejected" {
            return Ok(InlineAnnotationAcceptOutput::AlreadyResolved {
                message: format!("Annotation '{}' already {}", input.annotation_id, status),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("accepted");
        storage.put("annotation", &input.annotation_id, updated).await?;

        // Return the accepted content (scope bytes represent the clean content after acceptance)
        let scope = record.get("scope")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|b| b.as_u64().map(|n| n as u8)).collect::<Vec<u8>>())
            .unwrap_or_default();

        Ok(InlineAnnotationAcceptOutput::Ok {
            clean_content: scope,
        })
    }

    async fn reject(
        &self,
        input: InlineAnnotationRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationRejectOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("annotation", &input.annotation_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(InlineAnnotationRejectOutput::NotFound {
                    message: format!("Annotation '{}' not found", input.annotation_id),
                });
            }
        };

        let status = record.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if status == "accepted" || status == "rejected" {
            return Ok(InlineAnnotationRejectOutput::AlreadyResolved {
                message: format!("Annotation '{}' already {}", input.annotation_id, status),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("rejected");
        storage.put("annotation", &input.annotation_id, updated).await?;

        Ok(InlineAnnotationRejectOutput::Ok {
            clean_content: Vec::new(),
        })
    }

    async fn accept_all(
        &self,
        input: InlineAnnotationAcceptAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationAcceptAllOutput, Box<dyn std::error::Error>> {
        let all_annotations = storage.find("annotation", Some(&json!({
            "contentRef": input.content_ref,
            "status": "pending",
        }))).await?;

        let mut count: i64 = 0;
        for ann in &all_annotations {
            if let Some(id) = ann.get("annotationId").and_then(|v| v.as_str()) {
                let mut updated = ann.clone();
                updated["status"] = json!("accepted");
                storage.put("annotation", id, updated).await?;
                count += 1;
            }
        }

        Ok(InlineAnnotationAcceptAllOutput::Ok {
            clean_content: Vec::new(),
            count,
        })
    }

    async fn reject_all(
        &self,
        input: InlineAnnotationRejectAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationRejectAllOutput, Box<dyn std::error::Error>> {
        let all_annotations = storage.find("annotation", Some(&json!({
            "contentRef": input.content_ref,
            "status": "pending",
        }))).await?;

        let mut count: i64 = 0;
        for ann in &all_annotations {
            if let Some(id) = ann.get("annotationId").and_then(|v| v.as_str()) {
                let mut updated = ann.clone();
                updated["status"] = json!("rejected");
                storage.put("annotation", id, updated).await?;
                count += 1;
            }
        }

        Ok(InlineAnnotationRejectAllOutput::Ok {
            clean_content: Vec::new(),
            count,
        })
    }

    async fn toggle_tracking(
        &self,
        input: InlineAnnotationToggleTrackingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationToggleTrackingOutput, Box<dyn std::error::Error>> {
        storage.put("tracking", &input.content_ref, json!({
            "contentRef": input.content_ref,
            "enabled": input.enabled,
        })).await?;

        Ok(InlineAnnotationToggleTrackingOutput::Ok)
    }

    async fn list_pending(
        &self,
        input: InlineAnnotationListPendingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationListPendingOutput, Box<dyn std::error::Error>> {
        let all_annotations = storage.find("annotation", Some(&json!({
            "contentRef": input.content_ref,
            "status": "pending",
        }))).await?;

        let annotations: Vec<String> = all_annotations.iter()
            .filter_map(|ann| {
                ann.get("annotationId").and_then(|v| v.as_str()).map(|s| s.to_string())
            })
            .collect();

        Ok(InlineAnnotationListPendingOutput::Ok { annotations })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_annotate_success() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let result = handler.annotate(
            InlineAnnotationAnnotateInput {
                content_ref: "doc-1".to_string(),
                change_type: "insert".to_string(),
                scope: b"new text".to_vec(),
                author: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationAnnotateOutput::Ok { annotation_id } => {
                assert!(!annotation_id.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_annotate_invalid_change_type() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let result = handler.annotate(
            InlineAnnotationAnnotateInput {
                content_ref: "doc-1".to_string(),
                change_type: "invalid-type".to_string(),
                scope: b"text".to_vec(),
                author: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationAnnotateOutput::InvalidChangeType { message } => {
                assert!(message.contains("invalid-type"));
            },
            _ => panic!("Expected InvalidChangeType variant"),
        }
    }

    #[tokio::test]
    async fn test_annotate_tracking_disabled() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        // Disable tracking for this content
        handler.toggle_tracking(
            InlineAnnotationToggleTrackingInput {
                content_ref: "doc-locked".to_string(),
                enabled: false,
            },
            &storage,
        ).await.unwrap();
        let result = handler.annotate(
            InlineAnnotationAnnotateInput {
                content_ref: "doc-locked".to_string(),
                change_type: "insert".to_string(),
                scope: b"text".to_vec(),
                author: "bob".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationAnnotateOutput::TrackingDisabled { message } => {
                assert!(message.contains("disabled"));
            },
            _ => panic!("Expected TrackingDisabled variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_success() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let ann_result = handler.annotate(
            InlineAnnotationAnnotateInput {
                content_ref: "doc-2".to_string(),
                change_type: "insert".to_string(),
                scope: b"added text".to_vec(),
                author: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        let annotation_id = match ann_result {
            InlineAnnotationAnnotateOutput::Ok { annotation_id } => annotation_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.accept(
            InlineAnnotationAcceptInput { annotation_id },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationAcceptOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_not_found() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let result = handler.accept(
            InlineAnnotationAcceptInput { annotation_id: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationAcceptOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_already_resolved() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let ann_result = handler.annotate(
            InlineAnnotationAnnotateInput {
                content_ref: "doc-3".to_string(),
                change_type: "delete".to_string(),
                scope: Vec::new(),
                author: "bob".to_string(),
            },
            &storage,
        ).await.unwrap();
        let annotation_id = match ann_result {
            InlineAnnotationAnnotateOutput::Ok { annotation_id } => annotation_id,
            _ => panic!("Expected Ok"),
        };
        // Accept once
        handler.accept(
            InlineAnnotationAcceptInput { annotation_id: annotation_id.clone() },
            &storage,
        ).await.unwrap();
        // Accept again
        let result = handler.accept(
            InlineAnnotationAcceptInput { annotation_id },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationAcceptOutput::AlreadyResolved { .. } => {},
            _ => panic!("Expected AlreadyResolved variant"),
        }
    }

    #[tokio::test]
    async fn test_reject_not_found() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let result = handler.reject(
            InlineAnnotationRejectInput { annotation_id: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationRejectOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_toggle_tracking() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let result = handler.toggle_tracking(
            InlineAnnotationToggleTrackingInput {
                content_ref: "doc-t".to_string(),
                enabled: true,
            },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationToggleTrackingOutput::Ok => {},
        }
    }

    #[tokio::test]
    async fn test_list_pending() {
        let storage = InMemoryStorage::new();
        let handler = InlineAnnotationHandlerImpl;
        let result = handler.list_pending(
            InlineAnnotationListPendingInput { content_ref: "doc-empty".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InlineAnnotationListPendingOutput::Ok { annotations } => {
                assert!(annotations.is_empty());
            },
        }
    }
}
