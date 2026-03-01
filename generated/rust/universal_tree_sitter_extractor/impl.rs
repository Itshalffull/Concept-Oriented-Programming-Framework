// UniversalTreeSitterExtractor handler implementation
// Fallback symbol extraction provider using generic patterns for function,
// class, and type declarations. Works with any language that has no
// dedicated symbol extractor.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::UniversalTreeSitterExtractorHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("universal-tree-sitter-extractor-{}", id)
}

pub struct UniversalTreeSitterExtractorHandlerImpl;

#[async_trait]
impl UniversalTreeSitterExtractorHandler for UniversalTreeSitterExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: UniversalTreeSitterExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UniversalTreeSitterExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("universal-tree-sitter-extractor", &id, json!({
            "id": id,
            "extractorRef": "universal-tree-sitter-extractor",
        })).await {
            Ok(_) => Ok(UniversalTreeSitterExtractorInitializeOutput::Ok { instance: id }),
            Err(e) => Ok(UniversalTreeSitterExtractorInitializeOutput::LoadError {
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
        let handler = UniversalTreeSitterExtractorHandlerImpl;
        let result = handler.initialize(
            UniversalTreeSitterExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            UniversalTreeSitterExtractorInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("universal-tree-sitter-extractor"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
