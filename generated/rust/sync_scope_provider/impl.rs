// SyncScopeProvider concept implementation
// Provides scope analysis for sync spec files within the scope graph.
// Initializes a provider instance that defines how sync definitions
// create and consume scoped bindings.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncScopeProviderHandler;
use serde_json::json;

pub struct SyncScopeProviderHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("sync-scope-provider-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SyncScopeProviderHandler for SyncScopeProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: SyncScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncScopeProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("sync-scope-provider", &id, json!({
            "id": &id,
            "providerRef": &id,
            "scopeKind": "sync-binding",
            "fileExtensions": [".sync"],
            "scopeRules": [
                {"pattern": "when", "creates": "variable-binding"},
                {"pattern": "where", "creates": "intermediate-binding"},
                {"pattern": "then", "consumes": "variable-binding"},
            ],
            "status": "active",
        })).await?;

        Ok(SyncScopeProviderInitializeOutput::Ok {
            instance: id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize() {
        let storage = InMemoryStorage::new();
        let handler = SyncScopeProviderHandlerImpl;
        let result = handler.initialize(
            SyncScopeProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            SyncScopeProviderInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("sync-scope-provider-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
