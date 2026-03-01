// ThemeDependenceProvider concept implementation
// Dependence analysis provider for .theme files. Computes extends -> parent theme,
// role -> palette color, and token reference chain dependency edges.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ThemeDependenceProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("theme-dependence-provider-{}", id)
}

pub struct ThemeDependenceProviderHandlerImpl;

#[async_trait]
impl ThemeDependenceProviderHandler for ThemeDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: ThemeDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:theme";
        let handled_languages = "theme";

        // Check if already registered
        let existing = storage.find(
            "theme-dependence-provider",
            Some(&json!({"providerRef": provider_ref})),
        ).await?;

        if !existing.is_empty() {
            let id = existing[0]["id"].as_str().unwrap_or("").to_string();
            return Ok(ThemeDependenceProviderInitializeOutput::Ok { instance: id });
        }

        let id = next_id();

        storage.put("theme-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
            "handledLanguages": handled_languages
        })).await?;

        // Register in the plugin registry for discovery
        let plugin_key = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &plugin_key, json!({
            "id": plugin_key,
            "pluginKind": "dependence-provider",
            "domain": "theme",
            "handledLanguages": handled_languages,
            "providerRef": provider_ref,
            "instanceId": id
        })).await?;

        Ok(ThemeDependenceProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = ThemeDependenceProviderHandlerImpl;
        let result = handler.initialize(
            ThemeDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            ThemeDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("theme-dependence-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = ThemeDependenceProviderHandlerImpl;
        let result1 = handler.initialize(
            ThemeDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let result2 = handler.initialize(
            ThemeDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match (result1, result2) {
            (ThemeDependenceProviderInitializeOutput::Ok { instance: id1 },
             ThemeDependenceProviderInitializeOutput::Ok { instance: id2 }) => {
                assert_eq!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
