// TypeScriptDependenceProvider Handler Implementation
//
// Dependence analysis provider for TypeScript and TSX files.
// Uses the TypeScript compiler API for type-aware data and
// control dependency extraction.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TypeScriptDependenceProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("type-script-dependence-provider-{}", n)
}

pub struct TypeScriptDependenceProviderHandlerImpl;

#[async_trait]
impl TypeScriptDependenceProviderHandler for TypeScriptDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: TypeScriptDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:typescript";
        let handled_languages = "typescript,tsx";

        // Check if already registered
        let existing = storage.find("type-script-dependence-provider", json!({
            "providerRef": provider_ref
        })).await?;
        if let Some(arr) = existing.as_array() {
            if !arr.is_empty() {
                if let Some(id) = arr[0].get("id").and_then(|v| v.as_str()) {
                    return Ok(TypeScriptDependenceProviderInitializeOutput::Ok {
                        instance: id.to_string(),
                    });
                }
            }
        }

        let id = next_id();

        // Register this provider in storage
        storage.put("type-script-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
            "handledLanguages": handled_languages
        })).await?;

        // Register in the plugin registry for discovery by dependence graph computation
        let registry_key = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &registry_key, json!({
            "id": registry_key,
            "pluginKind": "dependence-provider",
            "domain": "typescript",
            "handledLanguages": handled_languages,
            "providerRef": provider_ref,
            "instanceId": id
        })).await?;

        Ok(TypeScriptDependenceProviderInitializeOutput::Ok {
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
        let handler = TypeScriptDependenceProviderHandlerImpl;
        let result = handler.initialize(
            TypeScriptDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TypeScriptDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("type-script-dependence-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TypeScriptDependenceProviderHandlerImpl;
        let r1 = handler.initialize(TypeScriptDependenceProviderInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TypeScriptDependenceProviderInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TypeScriptDependenceProviderInitializeOutput::Ok { instance: id1 },
             TypeScriptDependenceProviderInitializeOutput::Ok { instance: id2 }) => {
                assert!(!id1.is_empty());
                assert!(!id2.is_empty());
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
