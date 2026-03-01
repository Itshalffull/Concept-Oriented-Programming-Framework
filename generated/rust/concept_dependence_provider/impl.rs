// Concept Dependence Provider -- analyze inter-concept dependencies
// Initializes a provider that can extract dependency relationships between concepts
// based on their sync rules and shared type parameters.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConceptDependenceProviderHandler;
use serde_json::json;

pub struct ConceptDependenceProviderHandlerImpl;

#[async_trait]
impl ConceptDependenceProviderHandler for ConceptDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: ConceptDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        // Check for existing instance
        let existing = storage.get("dependence_provider", "concept").await?;
        if let Some(record) = existing {
            if record.get("status").and_then(|v| v.as_str()) == Some("ready") {
                return Ok(ConceptDependenceProviderInitializeOutput::Ok {
                    instance: record["instance"].as_str().unwrap_or("concept-dep-0").to_string(),
                });
            }
        }

        let instance_id = "concept-dependence-v1";

        // Initialize the provider by building an index of known concepts
        // and their sync participation
        storage.put("dependence_provider", "concept", json!({
            "instance": instance_id,
            "kind": "concept",
            "status": "ready",
            "description": "Extracts concept-level dependencies from sync rules and type bindings",
        })).await?;

        Ok(ConceptDependenceProviderInitializeOutput::Ok {
            instance: instance_id.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = ConceptDependenceProviderHandlerImpl;
        let result = handler.initialize(
            ConceptDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            ConceptDependenceProviderInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "concept-dependence-v1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = ConceptDependenceProviderHandlerImpl;

        handler.initialize(ConceptDependenceProviderInitializeInput {}, &storage).await.unwrap();
        let result = handler.initialize(ConceptDependenceProviderInitializeInput {}, &storage).await.unwrap();

        match result {
            ConceptDependenceProviderInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "concept-dependence-v1");
            },
            _ => panic!("Expected Ok variant on second call"),
        }
    }
}
