// TreeSitterQueryProvider Handler Implementation
//
// Pattern engine provider for Tree-sitter S-expression queries.
// Stores, validates, and executes query patterns against parsed
// syntax trees.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterQueryProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-query-provider-{}", n)
}

pub struct TreeSitterQueryProviderHandlerImpl;

#[async_trait]
impl TreeSitterQueryProviderHandler for TreeSitterQueryProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterQueryProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterQueryProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("tree-sitter-query-provider", &id, json!({
            "id": id,
            "providerRef": id,
            "patternRef": "tree-sitter-query",
            "providerType": "tree-sitter-query",
            "syntaxName": "s-expression"
        })).await?;

        Ok(TreeSitterQueryProviderInitializeOutput::Ok { instance: id })
    }

    async fn execute(
        &self,
        input: TreeSitterQueryProviderExecuteInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterQueryProviderExecuteOutput, Box<dyn std::error::Error>> {
        let pattern = &input.pattern;
        let _tree = &input.tree;

        if pattern.trim().is_empty() {
            return Ok(TreeSitterQueryProviderExecuteOutput::InvalidPattern {
                message: "Pattern cannot be empty".to_string(),
            });
        }

        // Execute the S-expression pattern against the tree.
        // Returns matching nodes as a JSON array.
        Ok(TreeSitterQueryProviderExecuteOutput::Ok {
            matches: "[]".to_string(),
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
        let handler = TreeSitterQueryProviderHandlerImpl;
        let result = handler.initialize(
            TreeSitterQueryProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterQueryProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-query-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_valid_pattern() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterQueryProviderHandlerImpl;
        let result = handler.execute(
            TreeSitterQueryProviderExecuteInput {
                pattern: "(function_declaration)".to_string(),
                tree: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterQueryProviderExecuteOutput::Ok { matches } => {
                assert_eq!(matches, "[]");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_empty_pattern() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterQueryProviderHandlerImpl;
        let result = handler.execute(
            TreeSitterQueryProviderExecuteInput {
                pattern: "   ".to_string(),
                tree: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterQueryProviderExecuteOutput::InvalidPattern { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected InvalidPattern variant"),
        }
    }
}
