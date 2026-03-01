// ThemeSpecSymbolExtractor concept implementation
// Symbol extraction provider for Clef Surface theme spec files. Extracts token names,
// scale values, semantic aliases, and mode variants as symbols in the surface/* namespace.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ThemeSpecSymbolExtractorHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("theme-spec-symbol-extractor-{}", id)
}

pub struct ThemeSpecSymbolExtractorHandlerImpl;

#[async_trait]
impl ThemeSpecSymbolExtractorHandler for ThemeSpecSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: ThemeSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("theme-spec-symbol-extractor", &id, json!({
            "id": id,
            "extractorRef": "theme-spec-symbol-extractor",
            "handledExtensions": ".theme,.theme.yaml,.theme.json",
            "language": "theme-spec"
        })).await {
            Ok(_) => Ok(ThemeSpecSymbolExtractorInitializeOutput::Ok { instance: id }),
            Err(e) => Ok(ThemeSpecSymbolExtractorInitializeOutput::LoadError {
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
        let handler = ThemeSpecSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            ThemeSpecSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            ThemeSpecSymbolExtractorInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("theme-spec-symbol-extractor"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_creates_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = ThemeSpecSymbolExtractorHandlerImpl;
        let r1 = handler.initialize(
            ThemeSpecSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        let r2 = handler.initialize(
            ThemeSpecSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match (r1, r2) {
            (ThemeSpecSymbolExtractorInitializeOutput::Ok { instance: id1 },
             ThemeSpecSymbolExtractorInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
