// SyncDependenceProvider concept implementation
// Provides dependency analysis for sync spec files.
// Initializes a provider instance that can resolve cross-file
// sync dependencies within the dependence graph.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncDependenceProviderHandler;
use serde_json::json;

pub struct SyncDependenceProviderHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("sync-dep-provider-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SyncDependenceProviderHandler for SyncDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: SyncDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("sync-dependence-provider", &id, json!({
            "id": &id,
            "providerRef": &id,
            "grammarRef": "sync-spec",
            "fileExtensions": [".sync"],
            "dependenceKind": "sync-trigger",
            "status": "active",
        })).await?;

        Ok(SyncDependenceProviderInitializeOutput::Ok {
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
        let handler = SyncDependenceProviderHandlerImpl;
        let result = handler.initialize(
            SyncDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            SyncDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("sync-dep-provider-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
