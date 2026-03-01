// Annotation concept implementation (Clef Bind)
// Attach metadata (examples, references, tool permissions, argument templates)
// to concepts and their actions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AnnotationHandler;
use serde_json::json;

pub struct AnnotationHandlerImpl;

#[async_trait]
impl AnnotationHandler for AnnotationHandlerImpl {
    async fn annotate(
        &self,
        input: AnnotationAnnotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnnotationAnnotateOutput, Box<dyn std::error::Error>> {
        // Parse metadata JSON
        let parsed: serde_json::Value = match serde_json::from_str(&input.content) {
            Ok(v) => v,
            Err(_) => return Ok(AnnotationAnnotateOutput::InvalidScope {
                scope: input.scope,
            }),
        };

        // Validate scope: must be non-empty
        if input.scope.trim().is_empty() {
            return Ok(AnnotationAnnotateOutput::InvalidScope {
                scope: input.scope,
            });
        }

        let parsed_obj = parsed.as_object().cloned().unwrap_or_default();
        let field_count = parsed_obj.len() as i64;

        // Build annotation identifier from concept + scope
        let annotation_id = format!("{}::{}", input.concept, input.scope);

        // Retrieve existing annotation or start fresh
        let existing = storage.get("annotation", &annotation_id).await?;

        let examples = parsed_obj.get("examples")
            .cloned()
            .unwrap_or_else(|| {
                existing.as_ref()
                    .and_then(|e| e["examples"].as_str())
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(json!([]))
            });

        let references = parsed_obj.get("references")
            .cloned()
            .unwrap_or_else(|| {
                existing.as_ref()
                    .and_then(|e| e["references"].as_str())
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(json!([]))
            });

        let tool_permissions = parsed_obj.get("toolPermissions")
            .cloned()
            .unwrap_or_else(|| {
                existing.as_ref()
                    .and_then(|e| e["toolPermissions"].as_str())
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(json!([]))
            });

        let argument_template = parsed_obj.get("argumentTemplate")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                existing.as_ref()
                    .and_then(|e| e["argumentTemplate"].as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();

        let related_items = parsed_obj.get("relatedItems")
            .cloned()
            .unwrap_or_else(|| {
                existing.as_ref()
                    .and_then(|e| e["relatedItems"].as_str())
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(json!([]))
            });

        storage.put("annotation", &annotation_id, json!({
            "annotationId": annotation_id,
            "targetConcept": input.concept,
            "scope": input.scope,
            "examples": serde_json::to_string(&examples)?,
            "references": serde_json::to_string(&references)?,
            "toolPermissions": serde_json::to_string(&tool_permissions)?,
            "argumentTemplate": argument_template,
            "relatedItems": serde_json::to_string(&related_items)?,
        })).await?;

        Ok(AnnotationAnnotateOutput::Ok {
            annotation: annotation_id,
            key_count: field_count,
        })
    }

    async fn resolve(
        &self,
        input: AnnotationResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnnotationResolveOutput, Box<dyn std::error::Error>> {
        let all_annotations = storage.find("annotation", None).await?;
        let mut matching: Vec<&serde_json::Value> = all_annotations.iter()
            .filter(|a| a["targetConcept"].as_str() == Some(&input.concept))
            .collect();

        if matching.is_empty() {
            return Ok(AnnotationResolveOutput::NotFound {
                concept: input.concept,
            });
        }

        // Sort by scope: "concept" first, then alphabetical action names
        matching.sort_by(|a, b| {
            let sa = a["scope"].as_str().unwrap_or("");
            let sb = b["scope"].as_str().unwrap_or("");
            if sa == "concept" { return std::cmp::Ordering::Less; }
            if sb == "concept" { return std::cmp::Ordering::Greater; }
            sa.cmp(sb)
        });

        let annotations: Vec<String> = matching.iter().map(|a| {
            let obj = json!({
                "targetConcept": a["targetConcept"],
                "scope": a["scope"],
                "examples": serde_json::from_str::<serde_json::Value>(a["examples"].as_str().unwrap_or("[]")).unwrap_or(json!([])),
                "references": serde_json::from_str::<serde_json::Value>(a["references"].as_str().unwrap_or("[]")).unwrap_or(json!([])),
                "toolPermissions": serde_json::from_str::<serde_json::Value>(a["toolPermissions"].as_str().unwrap_or("[]")).unwrap_or(json!([])),
                "argumentTemplate": if a["argumentTemplate"].as_str().unwrap_or("").is_empty() { serde_json::Value::Null } else { json!(a["argumentTemplate"]) },
                "relatedItems": serde_json::from_str::<serde_json::Value>(a["relatedItems"].as_str().unwrap_or("[]")).unwrap_or(json!([])),
            });
            serde_json::to_string(&obj).unwrap_or_default()
        }).collect();

        Ok(AnnotationResolveOutput::Ok {
            annotations,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_annotate_success() {
        let storage = InMemoryStorage::new();
        let handler = AnnotationHandlerImpl;
        let result = handler.annotate(
            AnnotationAnnotateInput {
                concept: "article".to_string(),
                scope: "concept".to_string(),
                content: r#"{"examples":["example1"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnnotationAnnotateOutput::Ok { annotation, key_count } => {
                assert_eq!(annotation, "article::concept");
                assert_eq!(key_count, 1);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_annotate_empty_scope_returns_invalid() {
        let storage = InMemoryStorage::new();
        let handler = AnnotationHandlerImpl;
        let result = handler.annotate(
            AnnotationAnnotateInput {
                concept: "article".to_string(),
                scope: "".to_string(),
                content: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnnotationAnnotateOutput::InvalidScope { .. } => {}
            _ => panic!("Expected InvalidScope variant"),
        }
    }

    #[tokio::test]
    async fn test_annotate_invalid_json_returns_invalid() {
        let storage = InMemoryStorage::new();
        let handler = AnnotationHandlerImpl;
        let result = handler.annotate(
            AnnotationAnnotateInput {
                concept: "article".to_string(),
                scope: "action".to_string(),
                content: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnnotationAnnotateOutput::InvalidScope { .. } => {}
            _ => panic!("Expected InvalidScope variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_existing_annotations() {
        let storage = InMemoryStorage::new();
        let handler = AnnotationHandlerImpl;
        handler.annotate(
            AnnotationAnnotateInput {
                concept: "user".to_string(),
                scope: "concept".to_string(),
                content: r#"{"examples":["ex1"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            AnnotationResolveInput { concept: "user".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AnnotationResolveOutput::Ok { annotations } => {
                assert!(!annotations.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_nonexistent_concept_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = AnnotationHandlerImpl;
        let result = handler.resolve(
            AnnotationResolveInput { concept: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AnnotationResolveOutput::NotFound { concept } => {
                assert_eq!(concept, "nonexistent");
            }
            _ => panic!("Expected NotFound variant"),
        }
    }
}
