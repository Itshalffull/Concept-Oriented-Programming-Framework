// TypeScriptSymbolExtractor handler implementation
// Symbol extraction provider for TypeScript and TSX files.
// Extracts functions, classes, types, interfaces, variables,
// and module exports as symbols using regex-based pattern matching.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TypeScriptSymbolExtractorHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("type-script-symbol-extractor-{}", id)
}

pub struct TypeScriptSymbolExtractorHandlerImpl;

#[async_trait]
impl TypeScriptSymbolExtractorHandler for TypeScriptSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: TypeScriptSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put(
            "type-script-symbol-extractor",
            &id,
            json!({
                "id": id,
                "extractorRef": "type-script-symbol-extractor",
                "handledExtensions": ".ts,.tsx",
                "language": "typescript",
            }),
        ).await {
            Ok(_) => Ok(TypeScriptSymbolExtractorInitializeOutput::Ok { instance: id }),
            Err(e) => Ok(TypeScriptSymbolExtractorInitializeOutput::LoadError {
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
        let handler = TypeScriptSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            TypeScriptSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TypeScriptSymbolExtractorInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("type-script-symbol-extractor"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TypeScriptSymbolExtractorHandlerImpl;
        let r1 = handler.initialize(TypeScriptSymbolExtractorInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TypeScriptSymbolExtractorInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TypeScriptSymbolExtractorInitializeOutput::Ok { instance: id1 },
             TypeScriptSymbolExtractorInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
