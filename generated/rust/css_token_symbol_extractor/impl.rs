// CssTokenSymbolExtractor Handler Implementation
//
// Symbol extraction provider for CSS files. Extracts custom property
// definitions (--token-*), class names, keyframe names, and media
// query identifiers as symbols. Supports design token tracing from
// theme specs through CSS custom properties.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CssTokenSymbolExtractorHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("css-token-symbol-extractor-{}", id)
}

pub struct CssTokenSymbolExtractorHandlerImpl;

#[async_trait]
impl CssTokenSymbolExtractorHandler for CssTokenSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: CssTokenSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CssTokenSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("css-token-symbol-extractor", &id, json!({
            "id": id,
            "extractorRef": "css-token-symbol-extractor",
            "handledExtensions": ".css",
            "language": "css",
        })).await {
            Ok(_) => Ok(CssTokenSymbolExtractorInitializeOutput::Ok {
                instance: id,
            }),
            Err(e) => Ok(CssTokenSymbolExtractorInitializeOutput::LoadError {
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
        let handler = CssTokenSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            CssTokenSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            CssTokenSymbolExtractorInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("css-token-symbol-extractor-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_returns_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = CssTokenSymbolExtractorHandlerImpl;

        let result1 = handler.initialize(CssTokenSymbolExtractorInitializeInput {}, &storage).await.unwrap();
        let result2 = handler.initialize(CssTokenSymbolExtractorInitializeInput {}, &storage).await.unwrap();

        let id1 = match result1 {
            CssTokenSymbolExtractorInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok"),
        };
        let id2 = match result2 {
            CssTokenSymbolExtractorInitializeOutput::Ok { instance } => instance,
            _ => panic!("Expected Ok"),
        };
        assert_ne!(id1, id2);
    }
}
