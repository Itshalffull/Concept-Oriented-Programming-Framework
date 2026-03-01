// TreeSitterConceptSpec Handler Implementation
//
// Grammar provider for Clef concept spec files. Registers the YAML WASM
// parser for .concept file extensions with LanguageGrammar. Each call to
// initialize creates a distinct provider instance tracked in storage.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterConceptSpecHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-concept-spec-{}", n)
}

pub struct TreeSitterConceptSpecHandlerImpl;

#[async_trait]
impl TreeSitterConceptSpecHandler for TreeSitterConceptSpecHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterConceptSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterConceptSpecInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("tree-sitter-concept-spec", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-concept-spec",
            "wasmPath": "tree-sitter-concept-spec.wasm",
            "language": "concept-spec",
            "extensions": "[\".concept\"]",
        })).await?;

        Ok(TreeSitterConceptSpecInitializeOutput::Ok {
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
        let handler = TreeSitterConceptSpecHandlerImpl;
        let result = handler.initialize(
            TreeSitterConceptSpecInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterConceptSpecInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-concept-spec"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterConceptSpecHandlerImpl;
        let r1 = handler.initialize(TreeSitterConceptSpecInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterConceptSpecInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterConceptSpecInitializeOutput::Ok { instance: id1 },
             TreeSitterConceptSpecInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
