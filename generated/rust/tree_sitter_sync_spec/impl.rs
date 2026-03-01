// TreeSitterSyncSpec Handler Implementation
//
// Grammar provider for Clef sync spec files. Registers the
// YAML WASM parser for .sync file extensions with LanguageGrammar.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterSyncSpecHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-sync-spec-{}", n)
}

pub struct TreeSitterSyncSpecHandlerImpl;

#[async_trait]
impl TreeSitterSyncSpecHandler for TreeSitterSyncSpecHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterSyncSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterSyncSpecInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("tree-sitter-sync-spec", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-sync-spec",
            "wasmPath": "tree-sitter-yaml.wasm",
            "language": "sync-spec",
            "extensions": "[\".sync\"]"
        })).await?;

        Ok(TreeSitterSyncSpecInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterSyncSpecHandlerImpl;
        let result = handler.initialize(
            TreeSitterSyncSpecInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterSyncSpecInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-sync-spec"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterSyncSpecHandlerImpl;
        let r1 = handler.initialize(TreeSitterSyncSpecInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterSyncSpecInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterSyncSpecInitializeOutput::Ok { instance: id1 },
             TreeSitterSyncSpecInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
