// SelectionPipelineDependenceProvider concept implementation
// Cross-system dependence analysis provider for the Clef Surface selection pipeline.
// Computes the full dependency chain: concept state field -> interactor classification
// -> affordance matching -> widget resolution. Registers itself in the plugin registry
// for discovery by dependence graph computation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SelectionPipelineDependenceProviderHandler;
use serde_json::json;

pub struct SelectionPipelineDependenceProviderHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("selection-pipeline-dependence-provider-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SelectionPipelineDependenceProviderHandler for SelectionPipelineDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: SelectionPipelineDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SelectionPipelineDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:selection-pipeline".to_string();

        // Check if already registered
        let existing = storage.find(
            "selection-pipeline-dependence-provider",
            Some(&json!({"providerRef": provider_ref})),
        ).await?;

        if !existing.is_empty() {
            let instance_id = existing[0].get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            return Ok(SelectionPipelineDependenceProviderInitializeOutput::Ok {
                instance: instance_id,
            });
        }

        let id = next_id();

        // Register this provider in storage
        match storage.put("selection-pipeline-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
        })).await {
            Ok(_) => {}
            Err(e) => return Ok(SelectionPipelineDependenceProviderInitializeOutput::LoadError {
                message: e.to_string(),
            }),
        }

        // Register in the plugin registry for discovery by dependence graph computation
        let plugin_key = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &plugin_key, json!({
            "id": plugin_key,
            "pluginKind": "dependence-provider",
            "domain": "selection-pipeline",
            "providerRef": provider_ref,
            "instanceId": id,
        })).await?;

        Ok(SelectionPipelineDependenceProviderInitializeOutput::Ok {
            instance: id,
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
        let handler = SelectionPipelineDependenceProviderHandlerImpl;
        let result = handler.initialize(
            SelectionPipelineDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            SelectionPipelineDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("selection-pipeline-dependence-provider-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = SelectionPipelineDependenceProviderHandlerImpl;
        let result1 = handler.initialize(
            SelectionPipelineDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id1 = match result1 {
            SelectionPipelineDependenceProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok"),
        };
        let result2 = handler.initialize(
            SelectionPipelineDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id2 = match result2 {
            SelectionPipelineDependenceProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok"),
        };
        assert_eq!(id1, id2);
    }
}
