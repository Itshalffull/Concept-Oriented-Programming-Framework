// TreeSitterYaml Handler Implementation
//
// Grammar provider for YAML files. Registers the YAML WASM
// parser for .yaml and .yml file extensions with LanguageGrammar.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterYamlHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-yaml-{}", n)
}

pub struct TreeSitterYamlHandlerImpl;

#[async_trait]
impl TreeSitterYamlHandler for TreeSitterYamlHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterYamlInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterYamlInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("tree-sitter-yaml", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-yaml",
            "wasmPath": "tree-sitter-yaml.wasm",
            "language": "yaml",
            "extensions": "[\".yaml\", \".yml\"]"
        })).await?;

        Ok(TreeSitterYamlInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterYamlHandlerImpl;
        let result = handler.initialize(
            TreeSitterYamlInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterYamlInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-yaml"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterYamlHandlerImpl;
        let r1 = handler.initialize(TreeSitterYamlInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterYamlInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterYamlInitializeOutput::Ok { instance: id1 },
             TreeSitterYamlInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
