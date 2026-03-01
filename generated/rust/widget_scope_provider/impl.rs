// WidgetScopeProvider Handler Implementation
//
// Scope resolution provider for .widget spec files. Models
// widget-level scopes containing anatomy parts, states,
// transitions, props, slots, and composed widget references.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetScopeProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("widget-scope-provider-{}", n)
}

pub struct WidgetScopeProviderHandlerImpl;

#[async_trait]
impl WidgetScopeProviderHandler for WidgetScopeProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: WidgetScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetScopeProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("widget-scope-provider", &id, json!({
            "id": id,
            "providerRef": "widget-scope-provider",
            "handledLanguages": "widget-spec"
        })).await {
            Ok(_) => Ok(WidgetScopeProviderInitializeOutput::Ok {
                instance: id,
            }),
            Err(e) => Ok(WidgetScopeProviderInitializeOutput::LoadError {
                message: e.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetScopeProviderHandlerImpl;
        let result = handler.initialize(
            WidgetScopeProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            WidgetScopeProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("widget-scope-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
