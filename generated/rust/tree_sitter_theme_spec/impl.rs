// TreeSitterThemeSpec Handler Implementation
//
// Grammar provider for Clef Surface theme spec files.
// Registers the theme spec parser for .theme file extensions
// with LanguageGrammar.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterThemeSpecHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-theme-spec-{}", n)
}

pub struct TreeSitterThemeSpecHandlerImpl;

#[async_trait]
impl TreeSitterThemeSpecHandler for TreeSitterThemeSpecHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterThemeSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterThemeSpecInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("tree-sitter-theme-spec", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-theme-spec",
            "wasmPath": "tree-sitter-theme-spec.wasm",
            "language": "theme-spec",
            "extensions": "[\".theme\"]"
        })).await?;

        Ok(TreeSitterThemeSpecInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterThemeSpecHandlerImpl;
        let result = handler.initialize(
            TreeSitterThemeSpecInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterThemeSpecInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-theme-spec"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterThemeSpecHandlerImpl;
        let r1 = handler.initialize(TreeSitterThemeSpecInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterThemeSpecInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterThemeSpecInitializeOutput::Ok { instance: id1 },
             TreeSitterThemeSpecInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
