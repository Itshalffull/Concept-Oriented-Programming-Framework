// DatalogDependenceProvider Handler Implementation
//
// Dependence analysis provider using Datalog for declarative
// dependency analysis from extracted program facts. Registers
// in the plugin registry for discovery by dependence graph
// computation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DatalogDependenceProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("datalog-dependence-provider-{}", id)
}

pub struct DatalogDependenceProviderHandlerImpl;

#[async_trait]
impl DatalogDependenceProviderHandler for DatalogDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: DatalogDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DatalogDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:datalog";

        // Check if already registered
        let existing = storage.find("datalog-dependence-provider", Some(&json!({ "providerRef": provider_ref }))).await?;
        if !existing.is_empty() {
            let instance_id = existing[0].get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            return Ok(DatalogDependenceProviderInitializeOutput::Ok { instance: instance_id });
        }

        let id = next_id();

        // Register provider in storage
        storage.put("datalog-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
        })).await?;

        // Register in plugin registry for discovery
        let registry_key = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &registry_key, json!({
            "id": registry_key,
            "pluginKind": "dependence-provider",
            "domain": "datalog",
            "providerRef": provider_ref,
            "instanceId": id,
        })).await?;

        Ok(DatalogDependenceProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_provider() {
        let storage = InMemoryStorage::new();
        let handler = DatalogDependenceProviderHandlerImpl;
        let result = handler.initialize(
            DatalogDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            DatalogDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = DatalogDependenceProviderHandlerImpl;
        let result1 = handler.initialize(
            DatalogDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id1 = match result1 {
            DatalogDependenceProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok variant"),
        };
        let result2 = handler.initialize(
            DatalogDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id2 = match result2 {
            DatalogDependenceProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok variant"),
        };
        assert_eq!(id1, id2);
    }
}
