// SyncSpecSymbolExtractor concept implementation
// Extracts symbols (sync names, concept references, variable bindings)
// from sync specification files for the symbol index.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncSpecSymbolExtractorHandler;
use serde_json::json;

pub struct SyncSpecSymbolExtractorHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("sync-spec-extractor-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SyncSpecSymbolExtractorHandler for SyncSpecSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: SyncSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("sync-spec-symbol-extractor", &id, json!({
            "id": &id,
            "providerRef": &id,
            "extractorRef": "sync-spec",
            "fileExtensions": [".sync"],
            "symbolKinds": [
                "sync-definition",
                "concept-reference",
                "action-reference",
                "variable-binding",
                "variant-reference",
            ],
            "status": "active",
        })).await?;

        Ok(SyncSpecSymbolExtractorInitializeOutput::Ok {
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
        let handler = SyncSpecSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            SyncSpecSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            SyncSpecSymbolExtractorInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("sync-spec-extractor-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
