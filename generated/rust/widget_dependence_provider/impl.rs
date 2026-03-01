// WidgetDependenceProvider Handler Implementation
//
// Dependence analysis provider for .widget files. Computes
// compose -> composed widget, connect -> prop -> anatomy part,
// and affordance -> interactor dependency edges.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetDependenceProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("widget-dependence-provider-{}", n)
}

pub struct WidgetDependenceProviderHandlerImpl;

#[async_trait]
impl WidgetDependenceProviderHandler for WidgetDependenceProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: WidgetDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetDependenceProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "dependence-provider:widget";
        let handled_languages = "widget";

        // Check if already registered
        let existing = storage.find("widget-dependence-provider", json!({
            "providerRef": provider_ref
        })).await?;
        if let Some(arr) = existing.as_array() {
            if !arr.is_empty() {
                if let Some(id) = arr[0].get("id").and_then(|v| v.as_str()) {
                    return Ok(WidgetDependenceProviderInitializeOutput::Ok {
                        instance: id.to_string(),
                    });
                }
            }
        }

        let id = next_id();

        // Register this provider in storage
        storage.put("widget-dependence-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
            "handledLanguages": handled_languages
        })).await?;

        // Register in the plugin registry for discovery by dependence graph computation
        let registry_key = format!("dependence-provider:{}", id);
        storage.put("plugin-registry", &registry_key, json!({
            "id": registry_key,
            "pluginKind": "dependence-provider",
            "domain": "widget",
            "handledLanguages": handled_languages,
            "providerRef": provider_ref,
            "instanceId": id
        })).await?;

        Ok(WidgetDependenceProviderInitializeOutput::Ok {
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
        let handler = WidgetDependenceProviderHandlerImpl;
        let result = handler.initialize(
            WidgetDependenceProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            WidgetDependenceProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("widget-dependence-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
