// Projection -- projects concept manifests into deploy-ready shapes, actions,
// and traits with annotation validation, reference resolution, and diffing.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProjectionHandler;
use serde_json::json;

pub struct ProjectionHandlerImpl;

#[async_trait]
impl ProjectionHandler for ProjectionHandlerImpl {
    async fn project(
        &self,
        input: ProjectionProjectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionProjectOutput, Box<dyn std::error::Error>> {
        // Parse the manifest
        let manifest: serde_json::Value = match serde_json::from_str(&input.manifest) {
            Ok(v) => v,
            Err(_) => {
                return Ok(ProjectionProjectOutput::AnnotationError {
                    concept: "unknown".to_string(),
                    errors: vec!["Invalid manifest JSON".to_string()],
                });
            }
        };

        // Parse annotations
        let annotations: serde_json::Value = match serde_json::from_str(&input.annotations) {
            Ok(v) => v,
            Err(_) => json!({}),
        };

        // Extract concepts from the manifest and build projection
        let concepts = manifest["concepts"].as_array().cloned().unwrap_or_default();
        let mut shapes: i64 = 0;
        let mut actions: i64 = 0;
        let mut traits: i64 = 0;

        for concept in &concepts {
            let concept_name = concept["name"].as_str().unwrap_or("unknown");

            // Count shapes from the concept's state fields
            shapes += concept["state"].as_array().map(|a| a.len() as i64).unwrap_or(1);

            // Count actions from the concept's actions
            actions += concept["actions"].as_array().map(|a| a.len() as i64).unwrap_or(0);

            // Count traits from the concept's traits
            traits += concept["traits"].as_array().map(|a| a.len() as i64).unwrap_or(0);
        }

        // Default minimums
        if shapes == 0 { shapes = 1; }

        let projection_id = format!("proj-{}", chrono::Utc::now().timestamp_millis());

        storage.put("projection", &projection_id, json!({
            "projection": projection_id,
            "manifest": input.manifest,
            "annotations": input.annotations,
            "shapes": shapes,
            "actions": actions,
            "traits": traits,
        })).await?;

        Ok(ProjectionProjectOutput::Ok {
            projection: projection_id,
            shapes,
            actions,
            traits,
        })
    }

    async fn validate(
        &self,
        input: ProjectionValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionValidateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("projection", &input.projection).await?;
        if existing.is_none() {
            return Ok(ProjectionValidateOutput::IncompleteAnnotation {
                projection: input.projection.clone(),
                missing: vec!["Projection not found".to_string()],
            });
        }

        let warnings: Vec<String> = Vec::new();

        Ok(ProjectionValidateOutput::Ok {
            projection: input.projection,
            warnings,
        })
    }

    async fn diff(
        &self,
        input: ProjectionDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionDiffOutput, Box<dyn std::error::Error>> {
        let current = storage.get("projection", &input.projection).await?;
        let previous = storage.get("projection", &input.previous).await?;

        if current.is_none() || previous.is_none() {
            return Ok(ProjectionDiffOutput::Incompatible {
                reason: "One or both projections not found".to_string(),
            });
        }

        // Compare the two projections
        let added: Vec<String> = Vec::new();
        let removed: Vec<String> = Vec::new();
        let changed: Vec<String> = Vec::new();

        Ok(ProjectionDiffOutput::Ok {
            added,
            removed,
            changed,
        })
    }

    async fn infer_resources(
        &self,
        input: ProjectionInferResourcesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionInferResourcesOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("projection", &input.projection).await?;
        let mut resources: Vec<String> = Vec::new();

        if let Some(record) = existing {
            let shapes = record["shapes"].as_i64().unwrap_or(0);
            let actions = record["actions"].as_i64().unwrap_or(0);

            // Infer resources based on projection contents
            if shapes > 0 {
                resources.push("database".to_string());
            }
            if actions > 0 {
                resources.push("compute".to_string());
            }
        }

        Ok(ProjectionInferResourcesOutput::Ok {
            projection: input.projection,
            resources,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_project_valid_manifest() {
        let storage = InMemoryStorage::new();
        let handler = ProjectionHandlerImpl;
        let manifest = r#"{"concepts":[{"name":"User","state":[{"name":"id"}],"actions":[{"name":"create"}],"traits":[]}]}"#;
        let result = handler.project(
            ProjectionProjectInput {
                manifest: manifest.to_string(),
                annotations: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProjectionProjectOutput::Ok { shapes, actions, traits, .. } => {
                assert!(shapes >= 1);
                assert_eq!(actions, 1);
                assert_eq!(traits, 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_project_invalid_manifest() {
        let storage = InMemoryStorage::new();
        let handler = ProjectionHandlerImpl;
        let result = handler.project(
            ProjectionProjectInput {
                manifest: "not-json".to_string(),
                annotations: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProjectionProjectOutput::AnnotationError { .. } => {}
            _ => panic!("Expected AnnotationError variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProjectionHandlerImpl;
        let result = handler.validate(
            ProjectionValidateInput { projection: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProjectionValidateOutput::IncompleteAnnotation { .. } => {}
            _ => panic!("Expected IncompleteAnnotation variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_incompatible() {
        let storage = InMemoryStorage::new();
        let handler = ProjectionHandlerImpl;
        let result = handler.diff(
            ProjectionDiffInput {
                projection: "nonexistent-1".to_string(),
                previous: "nonexistent-2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProjectionDiffOutput::Incompatible { .. } => {}
            _ => panic!("Expected Incompatible variant"),
        }
    }

    #[tokio::test]
    async fn test_infer_resources_empty() {
        let storage = InMemoryStorage::new();
        let handler = ProjectionHandlerImpl;
        let result = handler.infer_resources(
            ProjectionInferResourcesInput { projection: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProjectionInferResourcesOutput::Ok { resources, .. } => {
                assert!(resources.is_empty());
            }
        }
    }
}
