// TreeSitterTypeScript Handler Implementation
//
// Grammar provider for TypeScript files. Registers the
// TypeScript WASM parser for .ts and .tsx file extensions
// with LanguageGrammar.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterTypeScriptHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-typescript-{}", n)
}

pub struct TreeSitterTypeScriptHandlerImpl;

#[async_trait]
impl TreeSitterTypeScriptHandler for TreeSitterTypeScriptHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterTypeScriptInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterTypeScriptInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("tree-sitter-typescript", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-typescript",
            "wasmPath": "tree-sitter-typescript.wasm",
            "language": "typescript",
            "extensions": "[\".ts\", \".tsx\"]"
        })).await?;

        Ok(TreeSitterTypeScriptInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterTypeScriptHandlerImpl;
        let result = handler.initialize(
            TreeSitterTypeScriptInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterTypeScriptInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-typescript"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterTypeScriptHandlerImpl;
        let r1 = handler.initialize(TreeSitterTypeScriptInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterTypeScriptInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterTypeScriptInitializeOutput::Ok { instance: id1 },
             TreeSitterTypeScriptInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
