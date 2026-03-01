// TreeSitterJson Handler Implementation
//
// Grammar provider for JSON files. Registers the JSON WASM parser for
// .json file extensions with LanguageGrammar. Each call to initialize
// creates a distinct provider instance tracked in storage.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterJsonHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-json-{}", n)
}

pub struct TreeSitterJsonHandlerImpl;

#[async_trait]
impl TreeSitterJsonHandler for TreeSitterJsonHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterJsonInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterJsonInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("tree-sitter-json", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-json",
            "wasmPath": "tree-sitter-json.wasm",
            "language": "json",
            "extensions": "[\".json\"]",
        })).await?;

        Ok(TreeSitterJsonInitializeOutput::Ok {
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
        let handler = TreeSitterJsonHandlerImpl;
        let result = handler.initialize(
            TreeSitterJsonInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterJsonInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-json"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterJsonHandlerImpl;
        let r1 = handler.initialize(TreeSitterJsonInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterJsonInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterJsonInitializeOutput::Ok { instance: id1 },
             TreeSitterJsonInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
