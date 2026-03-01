// DatalogAnalysisProvider Handler Implementation
//
// Analysis engine provider for Datalog-based rules. Registers a
// Datalog evaluation engine in the plugin registry so that other
// concepts can discover and use it for fixpoint computation
// over extracted program facts.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DatalogAnalysisProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("datalog-analysis-provider-{}", id)
}

pub struct DatalogAnalysisProviderHandlerImpl;

#[async_trait]
impl DatalogAnalysisProviderHandler for DatalogAnalysisProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: DatalogAnalysisProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DatalogAnalysisProviderInitializeOutput, Box<dyn std::error::Error>> {
        let provider_ref = "analysis-engine:datalog";

        // Check if already registered
        let existing = storage.find("datalog-analysis-provider", Some(&json!({ "providerRef": provider_ref }))).await?;
        if !existing.is_empty() {
            let instance_id = existing[0].get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            return Ok(DatalogAnalysisProviderInitializeOutput::Ok { instance: instance_id });
        }

        let id = next_id();

        // Register provider in storage
        storage.put("datalog-analysis-provider", &id, json!({
            "id": id,
            "providerRef": provider_ref,
            "engineType": "datalog",
        })).await?;

        // Register in plugin registry for discovery
        let registry_key = format!("analysis-engine:{}", id);
        storage.put("plugin-registry", &registry_key, json!({
            "id": registry_key,
            "pluginKind": "analysis-engine",
            "engineType": "datalog",
            "providerRef": provider_ref,
            "instanceId": id,
        })).await?;

        Ok(DatalogAnalysisProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_provider() {
        let storage = InMemoryStorage::new();
        let handler = DatalogAnalysisProviderHandlerImpl;
        let result = handler.initialize(
            DatalogAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            DatalogAnalysisProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = DatalogAnalysisProviderHandlerImpl;
        let result1 = handler.initialize(
            DatalogAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id1 = match result1 {
            DatalogAnalysisProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok variant"),
        };
        let result2 = handler.initialize(
            DatalogAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let id2 = match result2 {
            DatalogAnalysisProviderInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok variant"),
        };
        assert_eq!(id1, id2);
    }
}
