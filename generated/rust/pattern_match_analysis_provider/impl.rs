// PatternMatchAnalysisProvider concept implementation
// Analysis engine provider for structural pattern matching.
// Registers a pattern-match analysis engine instance in the plugin registry.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PatternMatchAnalysisProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("pattern-match-analysis-provider-{}", id)
}

pub struct PatternMatchAnalysisProviderHandlerImpl;

#[async_trait]
impl PatternMatchAnalysisProviderHandler for PatternMatchAnalysisProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: PatternMatchAnalysisProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatternMatchAnalysisProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "analysis-engine:pattern-match";
        let engine_type = "pattern-match";

        // Check if already registered
        let existing = storage.find("pattern-match-analysis-provider", Some(&json!({ "providerRef": provider_ref }))).await?;
        if !existing.is_empty() {
            if let Some(id) = existing[0]["id"].as_str() {
                return Ok(PatternMatchAnalysisProviderInitializeOutput::Ok {
                    instance: id.to_string(),
                });
            }
        }

        let id = next_id();

        // Register the engine provider
        storage.put("pattern-match-analysis-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
            "engineType": engine_type
        })).await?;

        // Register in plugin registry for discovery
        let plugin_key = format!("analysis-engine:{}", id);
        storage.put("plugin-registry", &plugin_key, json!({
            "id": plugin_key,
            "pluginKind": "analysis-engine",
            "engineType": engine_type,
            "providerRef": provider_ref,
            "instanceId": id
        })).await?;

        Ok(PatternMatchAnalysisProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize() {
        let storage = InMemoryStorage::new();
        let handler = PatternMatchAnalysisProviderHandlerImpl;
        let result = handler.initialize(
            PatternMatchAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            PatternMatchAnalysisProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = PatternMatchAnalysisProviderHandlerImpl;
        let result1 = handler.initialize(
            PatternMatchAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let result2 = handler.initialize(
            PatternMatchAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match (result1, result2) {
            (PatternMatchAnalysisProviderInitializeOutput::Ok { .. },
             PatternMatchAnalysisProviderInitializeOutput::Ok { .. }) => {}
            _ => panic!("Expected both to be Ok"),
        }
    }
}
