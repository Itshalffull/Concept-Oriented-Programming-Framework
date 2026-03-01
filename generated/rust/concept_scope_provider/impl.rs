// Concept Scope Provider -- resolve concept scoping and visibility rules
// Initializes a provider that determines which concepts are visible in a given context
// based on suite membership, annotations, and deployment configuration.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConceptScopeProviderHandler;
use serde_json::json;

pub struct ConceptScopeProviderHandlerImpl;

#[async_trait]
impl ConceptScopeProviderHandler for ConceptScopeProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: ConceptScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptScopeProviderInitializeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("scope_provider", "concept").await?;
        if let Some(record) = existing {
            if record.get("status").and_then(|v| v.as_str()) == Some("ready") {
                return Ok(ConceptScopeProviderInitializeOutput::Ok {
                    instance: record["instance"].as_str().unwrap_or("concept-scope-0").to_string(),
                });
            }
        }

        let instance_id = "concept-scope-v1";

        storage.put("scope_provider", "concept", json!({
            "instance": instance_id,
            "kind": "concept",
            "status": "ready",
            "description": "Resolves concept visibility based on suite membership and annotations",
        })).await?;

        Ok(ConceptScopeProviderInitializeOutput::Ok {
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
        let handler = ConceptScopeProviderHandlerImpl;
        let result = handler.initialize(
            ConceptScopeProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            ConceptScopeProviderInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "concept-scope-v1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = ConceptScopeProviderHandlerImpl;

        handler.initialize(ConceptScopeProviderInitializeInput {}, &storage).await.unwrap();
        let result = handler.initialize(ConceptScopeProviderInitializeInput {}, &storage).await.unwrap();

        match result {
            ConceptScopeProviderInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "concept-scope-v1");
            },
            _ => panic!("Expected Ok variant on second call"),
        }
    }
}
