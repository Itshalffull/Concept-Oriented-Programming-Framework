// Concept Entity -- registry of parsed concept definitions
// Stores concept ASTs, supports lookup by name, capability, and suite membership.
// Checks cross-concept compatibility via shared type parameters.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConceptEntityHandler;
use serde_json::json;

pub struct ConceptEntityHandlerImpl;

#[async_trait]
impl ConceptEntityHandler for ConceptEntityHandlerImpl {
    async fn register(
        &self,
        input: ConceptEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityRegisterOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("concept_entity", &input.name).await?;
        if let Some(record) = existing {
            return Ok(ConceptEntityRegisterOutput::AlreadyRegistered {
                existing: record["entity"].as_str().unwrap_or(&input.name).to_string(),
            });
        }

        // Parse the AST to extract capabilities
        let ast: serde_json::Value = serde_json::from_str(&input.ast).unwrap_or(json!({}));
        let capabilities: Vec<String> = ast
            .get("actions")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a["name"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let type_params: Vec<String> = ast
            .get("typeParams")
            .and_then(|t| t.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let kit = ast.get("kit").and_then(|k| k.as_str()).unwrap_or("").to_string();

        storage.put("concept_entity", &input.name, json!({
            "entity": input.name,
            "name": input.name,
            "source": input.source,
            "ast": input.ast,
            "capabilities": capabilities,
            "typeParams": type_params,
            "kit": kit,
            "artifacts": [],
            "syncs": [],
        })).await?;

        Ok(ConceptEntityRegisterOutput::Ok {
            entity: input.name,
        })
    }

    async fn get(
        &self,
        input: ConceptEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("concept_entity", &input.name).await?;
        match record {
            Some(r) => Ok(ConceptEntityGetOutput::Ok {
                entity: r.to_string(),
            }),
            None => Ok(ConceptEntityGetOutput::Notfound),
        }
    }

    async fn find_by_capability(
        &self,
        input: ConceptEntityFindByCapabilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityFindByCapabilityOutput, Box<dyn std::error::Error>> {
        let all = storage.find("concept_entity", None).await?;
        let matching: Vec<String> = all
            .iter()
            .filter(|e| {
                e.get("capabilities")
                    .and_then(|c| c.as_array())
                    .map(|arr| arr.iter().any(|v| v.as_str() == Some(&input.capability)))
                    .unwrap_or(false)
            })
            .filter_map(|e| e["name"].as_str().map(|s| s.to_string()))
            .collect();

        Ok(ConceptEntityFindByCapabilityOutput::Ok {
            entities: serde_json::to_string(&matching)?,
        })
    }

    async fn find_by_kit(
        &self,
        input: ConceptEntityFindByKitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityFindByKitOutput, Box<dyn std::error::Error>> {
        let all = storage.find("concept_entity", Some(&json!({ "kit": input.kit }))).await?;
        let names: Vec<String> = all
            .iter()
            .filter_map(|e| e["name"].as_str().map(|s| s.to_string()))
            .collect();

        Ok(ConceptEntityFindByKitOutput::Ok {
            entities: serde_json::to_string(&names)?,
        })
    }

    async fn generated_artifacts(
        &self,
        input: ConceptEntityGeneratedArtifactsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityGeneratedArtifactsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("concept_entity", &input.entity).await?;
        let artifacts = record
            .and_then(|r| r.get("artifacts").cloned())
            .unwrap_or(json!([]));

        Ok(ConceptEntityGeneratedArtifactsOutput::Ok {
            artifacts: artifacts.to_string(),
        })
    }

    async fn participating_syncs(
        &self,
        input: ConceptEntityParticipatingSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityParticipatingSyncsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("concept_entity", &input.entity).await?;
        let syncs = record
            .and_then(|r| r.get("syncs").cloned())
            .unwrap_or(json!([]));

        Ok(ConceptEntityParticipatingSyncsOutput::Ok {
            syncs: syncs.to_string(),
        })
    }

    async fn check_compatibility(
        &self,
        input: ConceptEntityCheckCompatibilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityCheckCompatibilityOutput, Box<dyn std::error::Error>> {
        let entity_a = storage.get("concept_entity", &input.a).await?;
        let entity_b = storage.get("concept_entity", &input.b).await?;

        let (a_record, b_record) = match (entity_a, entity_b) {
            (Some(a), Some(b)) => (a, b),
            _ => {
                return Ok(ConceptEntityCheckCompatibilityOutput::Incompatible {
                    reason: "One or both concepts not found".to_string(),
                });
            }
        };

        // Extract type parameters and find shared ones
        let a_params: Vec<String> = a_record
            .get("typeParams")
            .and_then(|t| t.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let b_params: Vec<String> = b_record
            .get("typeParams")
            .and_then(|t| t.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let shared: Vec<String> = a_params
            .iter()
            .filter(|p| b_params.contains(p))
            .cloned()
            .collect();

        if shared.is_empty() {
            Ok(ConceptEntityCheckCompatibilityOutput::Incompatible {
                reason: "No shared type parameters".to_string(),
            })
        } else {
            Ok(ConceptEntityCheckCompatibilityOutput::Compatible {
                shared_type_params: serde_json::to_string(&shared)?,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;
        let result = handler.register(
            ConceptEntityRegisterInput {
                name: "Comment".to_string(),
                source: "comment.concept".to_string(),
                ast: r#"{"actions":[{"name":"create"}],"typeParams":["T"],"kit":"collaboration"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityRegisterOutput::Ok { entity } => {
                assert_eq!(entity, "Comment");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_already_registered() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;

        handler.register(
            ConceptEntityRegisterInput {
                name: "Comment".to_string(),
                source: "comment.concept".to_string(),
                ast: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.register(
            ConceptEntityRegisterInput {
                name: "Comment".to_string(),
                source: "comment.concept".to_string(),
                ast: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityRegisterOutput::AlreadyRegistered { .. } => {},
            _ => panic!("Expected AlreadyRegistered variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;
        let result = handler.get(
            ConceptEntityGetInput { name: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;

        handler.register(
            ConceptEntityRegisterInput {
                name: "Tag".to_string(),
                source: "tag.concept".to_string(),
                ast: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get(
            ConceptEntityGetInput { name: "Tag".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityGetOutput::Ok { entity } => {
                assert!(entity.contains("Tag"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_compatibility_incompatible() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;
        let result = handler.check_compatibility(
            ConceptEntityCheckCompatibilityInput {
                a: "nonexistent-a".to_string(),
                b: "nonexistent-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityCheckCompatibilityOutput::Incompatible { reason } => {
                assert!(reason.contains("not found"));
            },
            _ => panic!("Expected Incompatible variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_capability() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;
        let result = handler.find_by_capability(
            ConceptEntityFindByCapabilityInput { capability: "create".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityFindByCapabilityOutput::Ok { .. } => {},
        }
    }

    #[tokio::test]
    async fn test_generated_artifacts() {
        let storage = InMemoryStorage::new();
        let handler = ConceptEntityHandlerImpl;
        let result = handler.generated_artifacts(
            ConceptEntityGeneratedArtifactsInput { entity: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConceptEntityGeneratedArtifactsOutput::Ok { artifacts } => {
                assert_eq!(artifacts, "[]");
            },
        }
    }
}
