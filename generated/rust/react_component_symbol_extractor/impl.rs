// ReactComponentSymbolExtractor concept implementation
// Symbol extraction provider for React component files (.tsx).
// Registers itself as a provider capable of extracting component names,
// prop type definitions, hook usages, and exported component symbols.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ReactComponentSymbolExtractorHandler;
use serde_json::json;

pub struct ReactComponentSymbolExtractorHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("react-component-symbol-extractor-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl ReactComponentSymbolExtractorHandler for ReactComponentSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: ReactComponentSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReactComponentSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("react-component-symbol-extractor", &id, json!({
            "id": id,
            "extractorRef": "react-component-symbol-extractor",
            "handledExtensions": ".tsx",
            "language": "react-tsx",
        })).await {
            Ok(_) => Ok(ReactComponentSymbolExtractorInitializeOutput::Ok {
                instance: id,
            }),
            Err(e) => Ok(ReactComponentSymbolExtractorInitializeOutput::LoadError {
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
    async fn test_initialize() {
        let storage = InMemoryStorage::new();
        let handler = ReactComponentSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            ReactComponentSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            ReactComponentSymbolExtractorInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("react-component-symbol-extractor"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
