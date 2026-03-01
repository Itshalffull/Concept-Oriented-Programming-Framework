// UniversalTreeSitterDependenceProvider handler implementation
// Fallback dependence analysis provider using generic Tree-sitter queries.
// Provides basic import and call analysis for any language with a grammar.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::UniversalTreeSitterDependenceProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("universal-tree-sitter-dependence-provider-{}", id)
}

pub struct UniversalTreeSitterDependenceProviderHandlerImpl;

#[async_trait]
impl UniversalTreeSitterDependenceProviderHandler for UniversalTreeSitterDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: UniversalTreeSitterDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UniversalTreeSitterDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:universal-tree-sitter";

        // Check if already registered
        let existing = storage.find("universal-tree-sitter-dependence-provider", Some(&json!({"providerRef": provider_ref}))).await?;
        if !existing.is_empty() {
            if let Some(id) = existing[0].get("id").and_then(|v| v.as_str()) {
                return Ok(UniversalTreeSitterDependenceProviderInitializeOutput::Ok {
                    instance: id.to_string(),
                });
            }
        }

        let id = next_id();

        storage.put("universal-tree-sitter-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
        })).await?;

        // Register in plugin registry as a fallback dependence provider
        let plugin_key = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &plugin_key, json!({
            "id": plugin_key,
            "pluginKind": "dependence-provider",
            "domain": "universal",
            "fallback": true,
            "providerRef": provider_ref,
            "instanceId": id,
        })).await?;

        Ok(UniversalTreeSitterDependenceProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = UniversalTreeSitterDependenceProviderHandlerImpl;
        let result = handler.initialize(
            UniversalTreeSitterDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            UniversalTreeSitterDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("universal-tree-sitter-dependence-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
