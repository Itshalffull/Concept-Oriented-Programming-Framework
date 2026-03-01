// BindingDependenceProvider concept implementation
// Dependence analysis provider for runtime data bindings. Computes the full binding chain:
// concept state field -> reactive signal -> widget prop.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BindingDependenceProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("binding-dependence-provider-{}", id)
}

pub struct BindingDependenceProviderHandlerImpl;

#[async_trait]
impl BindingDependenceProviderHandler for BindingDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: BindingDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:binding".to_string();

        // Check if already registered
        let existing = storage.find("binding-dependence-provider", Some(&json!({
            "providerRef": provider_ref,
        }))).await?;

        if !existing.is_empty() {
            return Ok(BindingDependenceProviderInitializeOutput::Ok {
                instance: existing[0]["id"].as_str().unwrap_or("").to_string(),
            });
        }

        let id = next_id();

        // Register this provider in storage
        storage.put("binding-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
        })).await?;

        // Register in the plugin registry for discovery by dependence graph computation
        let plugin_id = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &plugin_id, json!({
            "id": plugin_id,
            "pluginKind": "dependence-provider",
            "domain": "binding",
            "providerRef": provider_ref,
            "instanceId": id,
        })).await?;

        Ok(BindingDependenceProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_provider() {
        let storage = InMemoryStorage::new();
        let handler = BindingDependenceProviderHandlerImpl;
        let result = handler.initialize(
            BindingDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            BindingDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = BindingDependenceProviderHandlerImpl;
        let result1 = handler.initialize(
            BindingDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id1 = match result1 {
            BindingDependenceProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok"),
        };
        let result2 = handler.initialize(
            BindingDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id2 = match result2 {
            BindingDependenceProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok"),
        };
        assert_eq!(id1, id2);
    }
}
